import type { ExtensionFactory, ToolDefinition } from "@oh-my-pi/pi-coding-agent";
import type { AgentToolResult } from "@oh-my-pi/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { resolveConfig } from "./config";
import type { ResearchCacheEntry, ResearchContext } from "./types";
import { runResearchPipeline } from "./pipeline/researcher";
import { formatAnswer } from "./format";
import { ResearchCache } from "./policy/cache";
import { createToolCallGuard } from "./policy/guard";

/**
 * Verity: Perplexity/Vane-style research extension for oh-my-pi.
 *
 * Provides:
 * - `verity_research` tool for LLM-initiated research
 * - `/verity` slash command for direct CLI invocation
 * - Research-before-action policy guard for dangerous tool calls
 */
const createVerityExtension: ExtensionFactory = api => {
	const config = resolveConfig();
	const cache = new ResearchCache(config.researchCacheTtlMs);

	// Warn early if SearXNG is not configured
	if (!config.searxngBaseUrl) {
		api.logger.warn("[verity] SEARXNG_BASE_URL is not set. Research features will be unavailable.");
	}

	// ---------------------------------------------------------------------------
	// Tool: verity_research
	// ---------------------------------------------------------------------------

	const VerityResearchParams = Type.Object({
		question: Type.String({
			description: "The research question to search for.",
		}),
		contextFiles: Type.Optional(
			Type.Array(Type.String(), {
				description: "Optional list of file paths for local context.",
			}),
		),
	});

	const verityResearchTool: ToolDefinition<typeof VerityResearchParams> = {
		name: "verity_research",
		label: "Verity Research",
		description:
			"Search the web for information and return a cited answer with sources. " +
			"Use this tool to research topics, find documentation, verify facts, or gather context " +
			"before making changes. Results include inline [N] citations matched to source URLs.",
		parameters: VerityResearchParams,
		hidden: false,

		async execute(_toolCallId, params, signal, _onUpdate, ctx): Promise<AgentToolResult> {
			if (!config.searxngBaseUrl) {
				return {
					content: [{ type: "text" as const, text: "Verity is not configured. Set the SEARXNG_BASE_URL environment variable to enable research." }],
				};
			}

			const sessionId = ctx.sessionManager.getSessionId();
			const researchContext: ResearchContext = {
				cwd: ctx.cwd,
				sessionId,
			};

			// Check cache first
			const cached = cache.get(sessionId);
			if (cached && cached.question === params.question) {
				return { content: [{ type: "text" as const, text: formatAnswer(cached.question, cached.answer) }] };
			}

			try {
				const answer = await runResearchPipeline(
					params.question,
					researchContext,
					config,
					ctx.model,
					signal,
				);

				cache.set(sessionId, params.question, answer);

				// Persist to session
				api.appendEntry("verity-research", {
					question: params.question,
					answer: {
						text: answer.text,
						docs: answer.docs.map(d => ({ title: d.title, url: d.url })),
					},
				} satisfies Pick<ResearchCacheEntry, "question"> & { answer: { text: string; docs: Array<{ title: string; url: string }> } });

				return { content: [{ type: "text" as const, text: formatAnswer(params.question, answer) }] };
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return {
					content: [{ type: "text" as const, text: `Research failed: ${message}` }],
				};
			}
		},
	};

	api.registerTool(verityResearchTool);

	// ---------------------------------------------------------------------------
	// Slash Command: /verity
	// ---------------------------------------------------------------------------

	api.registerCommand("verity", {
		description: "Run a research query using Verity (SearXNG-powered search with citations).",
		async handler(args, ctx) {
			const question = args.trim();
			if (!question) {
				ctx.ui.notify("Usage: /verity <question>", "warning");
				return;
			}

			if (!config.searxngBaseUrl) {
				ctx.ui.notify("Verity is not configured. Set SEARXNG_BASE_URL.", "error");
				return;
			}

			const sessionId = ctx.sessionManager.getSessionId();

			// Check cache
			const cached = cache.get(sessionId);
			if (cached && cached.question === question) {
				const formatted = formatAnswer(question, cached.answer);
				api.sendMessage({
					customType: "verity-result",
					content: formatted,
					display: true,
					attribution: "agent",
				});
				return;
			}

			ctx.ui.notify("Researching...", "info");

			try {
				const answer = await runResearchPipeline(
					question,
					{ cwd: ctx.cwd, sessionId },
					config,
					ctx.model,
				);

				cache.set(sessionId, question, answer);

				const formatted = formatAnswer(question, answer);
				api.sendMessage({
					customType: "verity-result",
					content: formatted,
					display: true,
					attribution: "agent",
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				ctx.ui.notify(`Research failed: ${message}`, "error");
			}
		},
	});

	// ---------------------------------------------------------------------------
	// Policy Guard: block dangerous tools without prior research
	// ---------------------------------------------------------------------------

	api.on("tool_call", (event, ctx) => {
		const guard = createToolCallGuard(config, cache, async (question, innerCtx) => {
			const answer = await runResearchPipeline(
				question,
				{ cwd: innerCtx.cwd, sessionId: innerCtx.sessionManager.getSessionId() },
				config,
				innerCtx.model,
			);
			return formatAnswer(question, answer);
		});
		// ToolCallEvent has discriminated union input types — widen for the guard
		return guard({ toolName: event.toolName, input: event.input as Record<string, unknown> }, ctx);
	});

	// ---------------------------------------------------------------------------
	// Session lifecycle: rehydrate cache on session start/switch
	// ---------------------------------------------------------------------------

	api.on("session_start", (_event) => {
		// Cache is in-memory; clear stale entries for fresh sessions
		// but keep entries if this is a resume (sessionId matches)
	});

	api.on("session_switch", (_event) => {
		// Different session — existing cache entries for old session
		// remain valid if not expired
	});

	api.on("session_shutdown", (_event, ctx) => {
		const sessionId = ctx.sessionManager.getSessionId();
		cache.invalidate(sessionId);
	});
};

export default createVerityExtension;
export { createVerityExtension };
