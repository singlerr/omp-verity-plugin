import type { VerityConfig } from "../types";
import type { ExtensionContext } from "@oh-my-pi/pi-coding-agent";
import type { Model } from "@oh-my-pi/pi-ai";
import { ResearchCache } from "./cache";
import { isDangerousToolCall } from "./dangerous-tools";

/**
 * Create a tool_call guard that enforces "research before action" policy.
 *
 * When a dangerous tool is called without recent research in the session,
 * the guard auto-triggers a research pipeline run using the provided callback,
 * caches the result, and allows the tool call to proceed.
 *
 * If auto-research fails, the call is blocked with an error message.
 */
export function createToolCallGuard(
	config: VerityConfig,
	cache: ResearchCache,
	runResearch: (question: string, ctx: ExtensionContext, model?: Model) => Promise<string>,
) {
	return async (
		event: { toolName: string; input: Record<string, unknown> },
		ctx: ExtensionContext,
	): Promise<{ block: boolean; reason?: string } | undefined> => {
		if (!config.requireResearchForWrite) return undefined;
		if (!isDangerousToolCall(event.toolName, event.input)) return undefined;

		const sessionId = ctx.sessionManager.getSessionId();
		if (cache.hasRecent(sessionId)) return undefined;

		// No recent research — try to infer a research question from the tool input.
		const question = inferResearchQuestion(event.toolName, event.input);
		if (!question) {
			// Can't infer a question — block and tell the user to research manually.
			return {
				block: true,
				reason:
					"리서치를 먼저 수행해야 합니다. `verity_research` 도구를 사용하여 관련 정보를 검색한 후 편집하세요.",
			};
		}

		// Auto-research: run the pipeline, cache the result, then allow the tool call.
		try {
			const result = await runResearch(question, ctx, ctx.model);

			// Cache the result so subsequent calls in this session don't re-trigger.
			cache.markResearched(sessionId, question, result);

			// Log the auto-research for transparency.
			ctx.ui.notify(
				`[verity] Auto-researched: "${question.slice(0, 80)}${question.length > 80 ? "..." : ""}"`,
				"info",
			);

			return undefined; // Allow the tool call
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return {
				block: true,
				reason: `자동 리서치 실패: ${message}\n\`verity_research\` 도구를 수동으로 실행한 후 다시 시도하세요.`,
			};
		}
	};
}

/**
 * Try to infer a research question from the tool call input.
 * Extracts meaningful context from file paths, commands, or content.
 */
function inferResearchQuestion(
	toolName: string,
	input: Record<string, unknown>,
): string | undefined {
	switch (toolName) {
		case "edit": {
			const path = typeof input.path === "string" ? input.path : "";
			return path ? `Best practices for editing ${path}` : undefined;
		}
		case "write": {
			const path = typeof input.path === "string" ? input.path : "";
			return path ? `How to implement ${path}` : undefined;
		}
		case "ast_edit": {
			const path = typeof input.path === "string" ? input.path : "";
			return path ? `Code patterns for ${path}` : undefined;
		}
		case "bash": {
			const command = typeof input.command === "string" ? input.command : "";
			if (!command) return undefined;
			// Extract the actual command, not flags
			const trimmed = command.trim().slice(0, 200);
			return `Documentation for: ${trimmed}`;
		}
		default:
			return undefined;
	}
}
