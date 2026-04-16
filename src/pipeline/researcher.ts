import type { Model } from "@oh-my-pi/pi-ai";
import type { AnswerWithCitations, SearchDoc, VerityConfig, ResearchContext } from "../types";
import { webSearch } from "../actions/web-search";
import { localDocSearch } from "../actions/local-doc-search";
import { rerank } from "./reranker";
import { generateCitedAnswer } from "./writer";

/**
 * Deduplicate documents by URL, preferring earlier occurrences
 * (which come from higher-ranked sources).
 */
function dedup(docs: SearchDoc[]): SearchDoc[] {
	const seen = new Set<string>();
	return docs.filter(doc => {
		if (seen.has(doc.url)) return false;
		seen.add(doc.url);
		return true;
	});
}

/**
 * Run the full research pipeline:
 * 1. Web search via SearXNG
 * 2. Local doc search (stub)
 * 3. Merge, deduplicate, rerank
 * 4. Generate cited answer via LLM
 */
export async function runResearchPipeline(
	question: string,
	context: ResearchContext,
	config: VerityConfig,
	model?: Model,
	signal?: AbortSignal,
): Promise<AnswerWithCitations> {
	const [webDocs, localDocs] = await Promise.all([
		webSearch(question, config).catch((err: Error) => {
			// Don't fail the entire pipeline if SearXNG is down — return empty.
			console.error(`[verity] Web search failed: ${err.message}`);
			return [] as SearchDoc[];
		}),
		localDocSearch(question, context.cwd),
	]);

	const merged = dedup([...webDocs, ...localDocs]);
	const topDocs = rerank(merged, question, config.topN);

	if (topDocs.length === 0) {
		return {
			text: "No relevant sources found for this query. Check your SearXNG configuration and try again.",
			docs: [],
		};
	}

	const answer = await generateCitedAnswer(question, topDocs, context, model, signal);
	return answer;
}
