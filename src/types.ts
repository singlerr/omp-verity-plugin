/** Normalized search result from any source. */
export interface SearchDoc {
	id: string;
	title: string;
	url: string;
	snippet: string;
	source: "searxng" | "local-doc";
	engine?: string;
	publishedDate?: string;
}

/** LLM-generated answer with inline citations. */
export interface AnswerWithCitations {
	text: string;
	docs: SearchDoc[];
	reasoning?: string;
}

/** Research pipeline config. */
export interface VerityConfig {
	searxngBaseUrl: string;
	maxResults: number;
	topN: number;
	requireResearchForWrite: boolean;
	researchCacheTtlMs: number;
}

/** Cache entry per session. */
export interface ResearchCacheEntry {
	question: string;
	answer: AnswerWithCitations;
	timestamp: number;
	sessionId: string;
}

/** SearXNG raw result item from the JSON API. */
export interface SearXNGResultItem {
	title?: string;
	url?: string;
	content?: string;
	engine?: string;
	publishedDate?: string;
	score?: number;
	category?: string;
}

/** SearXNG JSON API response. */
export interface SearXNGResponse {
	query: string;
	number_of_results: number;
	results: SearXNGResultItem[];
	unresponsive_engines?: string[];
}

/** Options for SearXNG search. */
export interface SearXNGSearchOptions {
	categories?: string;
	engines?: string;
	language?: string;
	timeRange?: string;
}

/** Research pipeline context, passed through all stages. */
export interface ResearchContext {
	cwd: string;
	sessionId: string;
}
