/**
 * Rule-based classifier for whether a question needs web research.
 *
 * For MVP, always returns true. Can be extended with LLM-based
 * classification or heuristic patterns later.
 */
export function needsWebResearch(_question: string): boolean {
	return true;
}
