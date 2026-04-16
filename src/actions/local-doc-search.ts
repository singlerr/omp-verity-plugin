import * as fs from "node:fs";
import * as path from "node:path";
import type { SearchDoc } from "../types";

const MAX_RESULTS = 20;
const SNIPPET_RADIUS = 120; // chars around match
const MAX_FILE_BYTES = 512 * 1024; // skip files larger than 512KB

/**
 * Check if a file path looks like a text file worth searching.
 * Skips binary, generated, and dependency directories.
 */
function isSearchableFile(filePath: string): boolean {
	const normalized = filePath.replace(/\\/g, "/");
	// Skip dependency and build directories
	if (/\/(node_modules|\.git|dist|build|out|vendor|__pycache__|\.next|target)\//.test(normalized)) {
		return false;
	}
	// Skip binary-ish extensions
	const ext = path.extname(normalized).toLowerCase();
	const binaryExts = new Set([
		".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
		".woff", ".woff2", ".ttf", ".eot", ".otf",
		".zip", ".tar", ".gz", ".rar", ".7z",
		".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv",
		".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
		".exe", ".dll", ".so", ".dylib", ".wasm",
		".sqlite", ".db",
	]);
	return !binaryExts.has(ext);
}

/**
 * Walk a directory recursively, yielding relative file paths.
 * Skips unsearchable directories and respects the searchability filter.
 */
function* walkFiles(root: string): Generator<string> {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(root, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".") && entry.name !== ".env") continue;
		const fullPath = path.join(root, entry.name);
		if (entry.isDirectory()) {
			if (isSearchableFile(fullPath + "/")) {
				yield* walkFiles(fullPath);
			}
		} else if (entry.isFile() && isSearchableFile(fullPath)) {
			yield fullPath;
		}
	}
}

/**
 * Extract a snippet around a match position in the file content.
 */
function extractSnippet(content: string, matchIndex: number): string {
	const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
	const end = Math.min(content.length, matchIndex + SNIPPET_RADIUS);
	let snippet = content.slice(start, end);
	if (start > 0) snippet = "..." + snippet;
	if (end < content.length) snippet += "...";
	// Collapse whitespace for display
	return snippet.replace(/\s+/g, " ").trim();
}

/**
 * Tokenize a query into lowercase search terms.
 */
function tokenizeQuery(query: string): string[] {
	return query
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter(t => t.length > 1);
}

/**
 * Score a file's relevance to the query based on term frequency.
 * Higher score = more relevant.
 */
function scoreContent(content: string, terms: string[]): number {
	const lower = content.toLowerCase();
	let score = 0;
	for (const term of terms) {
		let idx = 0;
		let count = 0;
		while ((idx = lower.indexOf(term, idx)) !== -1) {
			count++;
			idx += term.length;
		}
		// Diminishing returns for repeated matches
		score += Math.min(count, 5);
	}
	return score;
}

/**
 * Search local files for content matching the query.
 * Returns ranked SearchDoc entries with snippets.
 */
export async function localDocSearch(
	query: string,
	cwd: string,
): Promise<SearchDoc[]> {
	const terms = tokenizeQuery(query);
	if (terms.length === 0) return [];

	type Candidate = { filePath: string; score: number; snippet: string };
	const candidates: Candidate[] = [];

	for (const filePath of walkFiles(cwd)) {
		let stat: fs.Stats;
		try {
			stat = fs.statSync(filePath);
		} catch {
			continue;
		}
		if (stat.size > MAX_FILE_BYTES) continue;

		let content: string;
		try {
			const buf = fs.readFileSync(filePath);
			// Quick binary check: if first 8KB contains null bytes, skip
			const checkSlice = buf.subarray(0, Math.min(buf.length, 8192));
			if (checkSlice.includes(0)) continue;
			content = buf.toString("utf-8");
		} catch {
			continue;
		}

		const score = scoreContent(content, terms);
		if (score === 0) continue;

		// Find the best snippet (first match of any term)
		let bestIdx = content.length;
		for (const term of terms) {
			const idx = content.toLowerCase().indexOf(term);
			if (idx !== -1 && idx < bestIdx) bestIdx = idx;
		}

		const relativePath = path.relative(cwd, filePath).replace(/\\/g, "/");
		candidates.push({
			filePath: relativePath,
			score,
			snippet: bestIdx < content.length ? extractSnippet(content, bestIdx) : "",
		});
	}

	// Sort by score descending, take top results
	candidates.sort((a, b) => b.score - a.score);
	const topCandidates = candidates.slice(0, MAX_RESULTS);

	return topCandidates.map((c, i) => ({
		id: `local-${i}`,
		title: c.filePath,
		url: `file://${c.filePath}`,
		snippet: c.snippet,
		source: "local-doc" as const,
	}));
}
