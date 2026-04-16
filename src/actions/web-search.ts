import type { SearchDoc, VerityConfig } from "../types";
import { SearXNGClient } from "../searxng/client";
import { normalizeSearXNGResponse } from "../searxng/normalize";

/**
 * Execute a web search via SearXNG and return normalized results.
 */
export async function webSearch(
	query: string,
	config: VerityConfig,
	opts?: { categories?: string; engines?: string },
): Promise<SearchDoc[]> {
	const client = new SearXNGClient(config);
	const response = await client.search(query, opts, config.maxResults);
	return normalizeSearXNGResponse(response.results);
}
