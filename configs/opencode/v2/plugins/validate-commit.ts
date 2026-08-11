import { Plugin } from "@opencode-ai/plugin"

const TYPES = ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore"]
const PATTERN = new RegExp(`^(${TYPES.join("|")})(\\(.+\\))?(!)?:\\s.+`)

function shellCommand(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null || !("command" in input)) return undefined
  return typeof input.command === "string" ? input.command : undefined
}

function commitMessage(command: string): string | undefined {
  return command.match(/-m\s+"([^"]+)"/)?.[1]
    ?? command.match(/-m\s+'([^']+)'/)?.[1]
    ?? command.match(/-m\s+(\S+)/)?.[1]
}

export default Plugin.define({
  id: "metronome.validate-commit",
  setup: async (ctx) => {
    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool !== "shell") return
      const command = shellCommand(event.input)
      if (!command || !/^\s*git\s+commit\b/.test(command)) return
      if (/--amend/.test(command) && !/-m\s/.test(command)) return
      const message = commitMessage(command)
      if (!message) return
      const subject = message.split("\n")[0]
      if (!PATTERN.test(subject)) {
        throw new Error(`Commit blocked: "${subject}" does not follow Conventional Commits.`)
      }
      if (subject.length > 72) throw new Error(`Commit blocked: subject is ${subject.length} chars (max 72).`)
    })
  },
})
