// Conventional Commits gate — blocks git commit with non-conforming messages.
// Ported from GSD v1's gsd-validate-commit.sh (PreToolUse → tool.execute.before).
//
// Valid: feat(auth): add login flow
// Invalid: added login flow
//
// Types: feat fix docs style refactor perf test build ci chore
// Subject: <=72 chars after the colon

import type { Plugin } from "@opencode-ai/plugin"

const TYPES = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "perf",
  "test",
  "build",
  "ci",
  "chore",
]
const PATTERN = new RegExp(
  `^(${TYPES.join("|")})(\\(.+\\))?(!)?:\\s.+`,
)
const MAX_SUBJECT = 72

function extractCommitMessage(command: string): string | null {
  // Match -m "...", -m '...', or -m ... (unquoted until next flag)
  const double = command.match(/-m\s+"([^"]+)"/)
  if (double) return double[1]
  const single = command.match(/-m\s+'([^']+)'/)
  if (single) return single[1]
  // Unquoted (rare, but handle simple cases)
  const bare = command.match(/-m\s+(\S+)/)
  if (bare) return bare[1]
  return null
}

export const ValidateCommitPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      const tool = String(input?.tool ?? "").toLowerCase()
      if (tool !== "bash" && tool !== "shell") return

      const args = output?.args as Record<string, unknown> | undefined
      const command = args?.command
      if (typeof command !== "string") return

      // Only intercept git commit
      if (!/^\s*git\s+commit\b/.test(command)) return

      // Allow --amend without -m (reuses previous message)
      if (/--amend/.test(command) && !/-m\s/.test(command)) return

      const message = extractCommitMessage(command)
      if (!message) return // No message flag — might be interactive or --amend

      const subject = message.split("\n")[0]

      if (!PATTERN.test(subject)) {
        throw new Error(
          `Commit blocked: message does not follow Conventional Commits.\n` +
            `Got: "${subject}"\n` +
            `Expected: <type>(<scope>): <subject>\n` +
            `Types: ${TYPES.join(", ")}`,
        )
      }

      if (subject.length > MAX_SUBJECT) {
        throw new Error(
          `Commit blocked: subject is ${subject.length} chars (max ${MAX_SUBJECT}).\n` +
            `Got: "${subject}"`,
        )
      }
    },
  }
}
