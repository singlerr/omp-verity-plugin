import type { AnswerWithCitations, SearchDoc } from "./types";

/**
 * Format a research answer with inline citations into a readable string.
 */
export function formatAnswer(question: string, answer: AnswerWithCitations): string {
	const parts: string[] = [];

	parts.push(`## Research: ${question}`);
	parts.push("");
	parts.push(answer.text);
	parts.push("");

	if (answer.docs.length > 0) {
		parts.push("### Sources");
		for (let i = 0; i < answer.docs.length; i++) {
			const doc = answer.docs[i]!;
			parts.push(`[${i + 1}] ${doc.title} — ${doc.url}`);
		}
	}

	return parts.join("\n");
}

/**
 * Format source references for commit messages.
 */
export function formatCommitRefs(docs: SearchDoc[]): string {
	if (docs.length === 0) return "";
	const refs = docs
		.slice(0, 3)
		.map((doc, i) => `[${i + 1}] ${doc.title} (${doc.url})`);
	return `Refs: ${refs.join(", ")}`;
}

/**
 * Format a short summary for inline display (e.g. policy guard notifications).
 */
export function formatSummary(answer: AnswerWithCitations, maxChars: number = 500): string {
	const text = answer.text;
	if (text.length <= maxChars) return text;
	return text.slice(0, maxChars).replace(/\s+\S*$/, "") + "...";
}
