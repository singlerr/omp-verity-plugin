import type { Model, Context, AssistantMessage } from "@oh-my-pi/pi-ai";
import type { AnswerWithCitations, SearchDoc, ResearchContext } from "../types";

const SYSTEM_PROMPT = `You are a research assistant that produces concise, accurate answers with inline citations.

Rules:
- Answer the user's question using ONLY the provided sources.
- Cite sources using [N] notation where N matches the source number.
- If the sources do not contain enough information, say so explicitly.
- Do NOT fabricate information or cite sources not provided.
- Be concise but thorough. Use bullet points for multi-part answers.
- Format: plain text with [N] inline citations.`;

function buildSourceBlock(docs: SearchDoc[]): string {
	return docs
		.map((doc, i) => `[${i + 1}] ${doc.title}\nURL: ${doc.url}\n${doc.snippet}`)
		.join("\n\n");
}

function buildUserPrompt(question: string, docs: SearchDoc[]): string {
	const sources = buildSourceBlock(docs);
	return `## Question
${question}

## Sources
${sources}

## Instructions
Answer the question using the sources above. Use [N] citations. Do not add information not found in the sources.`;
}

/**
 * Extract text content from an AssistantMessage.
 * Concatenates all TextContent blocks into a single string.
 */
function extractText(msg: AssistantMessage): string {
	return msg.content
		.filter((block): block is { type: "text"; text: string } => block.type === "text")
		.map(block => block.text)
		.join("\n");
}

/**
 * Generate a cited answer using the session's model via the pi-ai SDK.
 *
 * If no model is available, falls back to returning the raw prompt + sources
 * so the caller can still display something useful.
 */
export async function generateCitedAnswer(
	question: string,
	docs: SearchDoc[],
	_context: ResearchContext,
	model?: Model,
	signal?: AbortSignal,
): Promise<AnswerWithCitations> {
	// No model available — return source summary as the answer.
	if (!model) {
		return {
			text: buildUserPrompt(question, docs),
			docs,
			reasoning: "No model available; returning raw source summary.",
		};
	}

	// Dynamically import to avoid hard dependency at load time.
	const { completeSimple } = await import("@oh-my-pi/pi-ai");

	const llmContext: Context = {
		systemPrompt: SYSTEM_PROMPT,
		messages: [
			{
				role: "user" as const,
				content: [{ type: "text" as const, text: buildUserPrompt(question, docs) }],
				timestamp: Date.now(),
			},
		],
	};

	const response = await completeSimple(model, llmContext, {
		signal,
		temperature: 0.3,
		maxTokens: 2048,
	});

	const text = extractText(response);

	return {
		text,
		docs,
		reasoning: `Used model ${response.model} via ${response.provider}`,
	};
}

/**
 * Extract the system prompt and user prompt for external LLM invocation.
 * Useful when the caller wants to manage the LLM call themselves.
 */
export function buildLLMPrompts(
	question: string,
	docs: SearchDoc[],
): { systemPrompt: string; userPrompt: string } {
	return {
		systemPrompt: SYSTEM_PROMPT,
		userPrompt: buildUserPrompt(question, docs),
	};
}
