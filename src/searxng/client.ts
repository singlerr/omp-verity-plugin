import type { SearXNGResponse, SearXNGSearchOptions } from "../types";
import type { VerityConfig } from "../types";

export class SearXNGClient {
	private readonly baseURL: string;

	constructor(config: VerityConfig) {
		if (!config.searxngBaseUrl) {
			throw new Error(
				"SearXNG base URL is not configured. Set SEARXNG_BASE_URL or pass searxngBaseUrl in config.",
			);
		}
		this.baseURL = config.searxngBaseUrl.replace(/\/+$/, "");
	}

	async search(
		query: string,
		opts?: SearXNGSearchOptions,
		limit?: number,
	): Promise<SearXNGResponse> {
		const params = new URLSearchParams({
			q: query,
			format: "json",
		});

		if (opts?.categories) params.set("categories", opts.categories);
		if (opts?.engines) params.set("engines", opts.engines);
		if (opts?.language) params.set("language", opts.language);
		if (opts?.timeRange) params.set("time_range", opts.timeRange);

		const url = `${this.baseURL}/search?${params.toString()}`;

		let response: Response;
		try {
			response = await fetch(url, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(15_000),
			});
		} catch (err) {
			throw new Error(
				`SearXNG 인스턴스에 연결할 수 없습니다 (${this.baseURL}): ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		if (response.status === 403) {
			throw new Error(
				"SearXNG 설정에서 json 포맷을 활성화해야 합니다. 설정에서 'search.formats'에 'json'을 추가하세요.",
			);
		}

		if (!response.ok) {
			throw new Error(
				`SearXNG returned HTTP ${response.status}: ${response.statusText}`,
			);
		}

		const body = (await response.json()) as SearXNGResponse;
		if (limit && limit > 0 && body.results.length > limit) {
			body.results = body.results.slice(0, limit);
		}

		return body;
	}
}
