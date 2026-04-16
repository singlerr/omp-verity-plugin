import type { ResearchCacheEntry, AnswerWithCitations } from "../types";

/**
 * In-memory research cache, keyed by session ID.
 * Each session stores the most recent research result.
 */
export class ResearchCache {
	private readonly entries = new Map<string, ResearchCacheEntry>();
	private readonly ttlMs: number;

	constructor(ttlMs: number = 300_000) {
		this.ttlMs = ttlMs;
	}

	/**
	 * Get the most recent valid cache entry for a session.
	 * Returns undefined if no entry exists or it has expired.
	 */
	get(sessionId: string): ResearchCacheEntry | undefined {
		const entry = this.entries.get(sessionId);
		if (!entry) return undefined;

		const age = Date.now() - entry.timestamp;
		if (age > this.ttlMs) {
			this.entries.delete(sessionId);
			return undefined;
		}

		return entry;
	}

	/**
	 * Store a research result for a session.
	 */
	set(sessionId: string, question: string, answer: AnswerWithCitations): void {
		this.entries.set(sessionId, {
			question,
			answer,
			timestamp: Date.now(),
			sessionId,
		});
	}

	/**
	 * Check if a session has recent (non-expired) research.
	 */
	hasRecent(sessionId: string): boolean {
		return this.get(sessionId) !== undefined;
	}

	/**
	 * Mark that research was performed for a session (by the auto-research guard).
	 * Stores a lightweight entry with the formatted text result.
	 */
	markResearched(sessionId: string, question: string, result: string): void {
		this.entries.set(sessionId, {
			question,
			answer: { text: result, docs: [] },
			timestamp: Date.now(),
			sessionId,
		});
	}

	/**
	 * Invalidate cache for a session.
	 */
	invalidate(sessionId: string): void {
		this.entries.delete(sessionId);
	}

	/**
	 * Clear all cache entries.
	 */
	clear(): void {
		this.entries.clear();
	}
}
