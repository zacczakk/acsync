import { Plugin } from "@opencode-ai/plugin"

const EXPLORATORY_TOOLS = new Set([
  "grep",
  "glob",
  "subagent",
  "tavily_search",
  "context7_resolve-library-id",
])

const ADVISORY =
  "\n<system-reminder>Check Memory vault first: " +
  '`rg \'^summary:.*topic\' ~/Vaults/Memory/ --glob \'*.md\' -i` (summary scan) or ' +
  '`qmd query "..." -c memory` (semantic). Read the winning file directly; do not launch the Obsidian app CLI. ' +
  "If no match, fall back to session history: " +
  '`sessions search "..."` (keyword, FTS5) or `sessions find "..."` (semantic, qmd -c sessions). ' +
  "`sessions list` is always live; `search`/`find` need periodic `sessions export`.</system-reminder>"

function isExploreSubagent(input: unknown): boolean {
  if (typeof input !== "object" || input === null || !("agent" in input)) return false
  return input.agent === "explore"
}

export default Plugin.define({
  id: "memory-vault-advisor",
  setup: async (ctx) => {
    const pending = new Map<string, number>()

    await ctx.tool.hook("execute.after", (event) => {
      if (event.status !== "completed" || !EXPLORATORY_TOOLS.has(event.tool)) return
      if (event.tool === "subagent" && !isExploreSubagent(event.input)) return
      pending.set(event.sessionID, (pending.get(event.sessionID) ?? 0) + 1)
    })

    await ctx.session.hook("context", (event) => {
      const count = pending.get(event.sessionID)
      if (!count) return
      pending.delete(event.sessionID)
      for (let index = 0; index < count; index += 1) {
        event.system.push({ type: "text", text: ADVISORY })
      }
    })
  },
})
