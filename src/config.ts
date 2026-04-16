import type { VerityConfig } from "./types";

const ENV_PREFIX = "VERITY_";

function env(key: string): string | undefined {
	return process.env[key] || process.env[`${ENV_PREFIX}${key}`];
}

function envInt(key: string, fallback: number): number {
	const raw = env(key);
	if (raw === undefined) return fallback;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
	const raw = env(key);
	if (raw === undefined) return fallback;
	return raw === "true" || raw === "1";
}

export function resolveConfig(overrides?: Partial<VerityConfig>): VerityConfig {
	const searxngBaseUrl =
		overrides?.searxngBaseUrl ??
		process.env.SEARXNG_BASE_URL ??
		"";

	return {
		searxngBaseUrl,
		maxResults: overrides?.maxResults ?? envInt("MAX_RESULTS", 10),
		topN: overrides?.topN ?? envInt("TOP_N", 5),
		requireResearchForWrite: overrides?.requireResearchForWrite ?? envBool("REQUIRE_RESEARCH", true),
		researchCacheTtlMs: overrides?.researchCacheTtlMs ?? envInt("CACHE_TTL_MS", 300_000),
	};
}
