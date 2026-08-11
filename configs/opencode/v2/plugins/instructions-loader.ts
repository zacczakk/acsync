import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { resolve } from "node:path"
import { Plugin } from "@opencode-ai/plugin"

const DEFAULT_PATHS = [
  "~/Vaults/Memory/SOUL.md",
  "~/Vaults/Memory/IDENTITY.md",
  "~/Vaults/Memory/USER.md",
  "~/Vaults/Memory/MEMORY.md",
]

function instructionPaths(options: Readonly<Record<string, unknown>>): string[] {
  if (!Array.isArray(options.paths)) return DEFAULT_PATHS
  return options.paths.filter((value): value is string => typeof value === "string")
}

function expandHome(path: string): string {
  if (path === "~") return homedir()
  if (path.startsWith("~/")) return resolve(homedir(), path.slice(2))
  return resolve(path)
}

export default Plugin.define({
  id: "metronome.instructions-loader",
  setup: async (ctx) => {
    const contents = (await Promise.all(
      instructionPaths(ctx.options).map(async (path) => {
        try {
          return { path, text: await readFile(expandHome(path), "utf8") }
        } catch {
          return undefined
        }
      }),
    )).filter((value): value is { path: string; text: string } => value !== undefined)

    await ctx.session.hook("context", (event) => {
      for (const instruction of contents) {
        event.system.push({
          type: "text",
          text: `<instruction-source path="${instruction.path}">\n${instruction.text}\n</instruction-source>`,
        })
      }
    })
  },
})
