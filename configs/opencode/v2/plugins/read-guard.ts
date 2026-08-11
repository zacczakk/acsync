import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { Plugin } from "@opencode-ai/plugin"

function inputPath(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined
  for (const key of ["filePath", "file_path", "path"]) {
    if (key in input && typeof input[key as keyof typeof input] === "string") {
      return input[key as keyof typeof input] as string
    }
  }
  return undefined
}

export default Plugin.define({
  id: "metronome.read-guard",
  setup: async (ctx) => {
    const reads = new Map<string, Set<string>>()

    await ctx.tool.hook("execute.after", (event) => {
      if (event.status !== "completed" || event.tool !== "read") return
      const path = inputPath(event.input)
      if (!path) return
      const sessionReads = reads.get(event.sessionID) ?? new Set<string>()
      sessionReads.add(resolve(path))
      reads.set(event.sessionID, sessionReads)
    })

    await ctx.tool.hook("execute.before", (event) => {
      if (event.tool !== "edit" && event.tool !== "write" && event.tool !== "patch") return
      const path = inputPath(event.input)
      if (!path) return
      const absolute = resolve(path)
      if (!existsSync(absolute) || reads.get(event.sessionID)?.has(absolute)) return
      throw new Error(`Edit blocked: "${path}" has not been read in this session.`)
    })
  },
})
