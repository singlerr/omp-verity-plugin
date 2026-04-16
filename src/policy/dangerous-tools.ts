/** Tool names considered "dangerous" — modifying files or executing commands. */
export const DANGEROUS_TOOL_NAMES = new Set([
	"edit",
	"write",
	"ast_edit",
]);

/** Patterns in bash commands that indicate destructive intent. */
const DESTRUCTIVE_BASH_PATTERNS = [
	/\brm\s+-rf\b/,
	/\brm\s+-r\b/,
	/\bgit\s+push\s+--force\b/,
	/\bgit\s+reset\s+--hard\b/,
	/\bDROP\s+TABLE\b/i,
	/\bTRUNCATE\s+TABLE\b/i,
	/\bDELETE\s+FROM\b/i,
];

/**
 * Check if a bash command contains destructive patterns.
 * Returns true if the command looks destructive.
 */
export function isDestructiveBashCommand(command: string): boolean {
	return DESTRUCTIVE_BASH_PATTERNS.some(pattern => pattern.test(command));
}

/**
 * Check if a tool call should be guarded.
 * Returns true for write tools and destructive bash commands.
 */
export function isDangerousToolCall(toolName: string, input: Record<string, unknown>): boolean {
	if (DANGEROUS_TOOL_NAMES.has(toolName)) return true;
	if (toolName === "bash") {
		const command = typeof input.command === "string" ? input.command : "";
		return isDestructiveBashCommand(command);
	}
	return false;
}
