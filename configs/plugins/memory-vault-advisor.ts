// Memory Vault Advisor — advisory reminder on exploratory tool calls.
// Fires on grep, glob, task (explore), tavily_search, context7 resolve.
// Appends short reminder to tool output so the agent sees it inline.
//
// Search hierarchy: Memory vault (curated) → sessions (history) → web.
//
// Known limitation: output.output mutation doesn't propagate for MCP tools
// (tavily_search, context7_resolve-library-id). These tools still match but
// the advisory is silently dropped by OpenCode's MCP result pipeline.
// Built-in tools (grep, glob, task) work correctly.
import type { Plugin } from "@opencode-ai/plugin"

const EXPLORATORY_TOOLS = new Set([
  "grep",
  "glob",
  "task",
  "tavily_search",
  "context7_resolve-library-id",
])

const ADVISORY =
  "\n<system-reminder>Check Memory vault for prior notes before broad searches: " +
  '`qmd "query"` (semantic) or `obsidian search --vault Memory "query"` (structured). ' +
  "~/Vaults/Memory/ has sessions, patterns, projects, tools, system. " +
  "If Memory vault has no match, try `sessions search \"query\"` (keyword) or " +
  '`sessions find "query"` (semantic) for past session history.</system-reminder>'

export const MemoryVaultAdvisor: Plugin = async () => {
  return {
    "tool.execute.after": async (input, output) => {
      if (!EXPLORATORY_TOOLS.has(input.tool)) return
      if (input.tool === "task" && input.args?.subagent_type !== "explore") return
      output.output += ADVISORY
    },
  }
}
