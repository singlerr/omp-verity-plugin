import type { SearchDoc } from "../types";

/**
 * Tokenize a string into lowercase word tokens.
 * Strips punctuation, collapses whitespace.
 */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter(t => t.length > 1);
}

/**
 * Compute keyword-overlap relevance score for a document against a query.
 *
 * Counts how many query terms appear in the title + snippet,
 * weighted by title matches. Returns a score >= 0.
 */
function relevanceScore(query: string, doc: SearchDoc): number {
	const queryTokens = tokenize(query);
	if (queryTokens.length === 0) return 0;

	const titleTokens = new Set(tokenize(doc.title));
	const snippetTokens = new Set(tokenize(doc.snippet));

	let score = 0;
	for (const token of queryTokens) {
		if (titleTokens.has(token)) {
			score += 2; // Title match is worth more
		} else if (snippetTokens.has(token)) {
			score += 1;
		}
	}

	return score;
}

/**
 * Rerank documents by keyword relevance to the query.
 * Returns top N sorted by descending relevance.
 */
export function rerank(docs: SearchDoc[], query: string, topN: number): SearchDoc[] {
	const scored = docs.map(doc => ({ doc, score: relevanceScore(query, doc) }));
	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, topN).map(s => s.doc);
}
