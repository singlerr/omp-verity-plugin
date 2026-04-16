import type { SearchDoc, SearXNGResultItem } from "../types";

let nextId = 0;

function uniqueId(): string {
	return `doc-${++nextId}`;
}

/**
 * Normalize a raw SearXNG result item into a SearchDoc.
 * Skips items without a URL (e.g., suggestions, infoboxes).
 */
function normalizeItem(item: SearXNGResultItem): SearchDoc | null {
	if (!item.url) return null;

	return {
		id: uniqueId(),
		title: item.title?.trim() || item.url,
		url: item.url,
		snippet: item.content?.trim() || "",
		source: "searxng",
		engine: item.engine,
		publishedDate: item.publishedDate || undefined,
	};
}

/**
 * Normalize a full SearXNG response into a deduplicated SearchDoc[].
 */
export function normalizeSearXNGResponse(results: SearXNGResultItem[]): SearchDoc[] {
	const seen = new Set<string>();
	const docs: SearchDoc[] = [];

	for (const item of results) {
		const doc = normalizeItem(item);
		if (!doc) continue;

		const key = doc.url;
		if (seen.has(key)) continue;
		seen.add(key);
		docs.push(doc);
	}

	return docs;
}
