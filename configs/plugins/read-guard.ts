// Read-before-edit guard — blocks Write/Edit on existing files the agent hasn't read.
// Ported from GSD v1's gsd-read-guard.js (PreToolUse → tool.execute.before).
//
// OpenCode's built-in tools already enforce this, but this plugin acts as
// defense-in-depth: if a model tries to bypass via tool name variants or
// future tool changes, this catches it at the plugin layer.
//
// Tracks reads per-session via an in-memory Set. Resets on plugin reload.

import type { Plugin } from "@opencode-ai/plugin"
import { existsSync } from "fs"
import { resolve } from "path"

export const ReadGuardPlugin: Plugin = async ({ directory }) => {
  const readPaths = new Set<string>()

  return {
    "tool.execute.after": async (input) => {
      const tool = String(input?.tool ?? "").toLowerCase()
      if (tool !== "read") return

      const args = input?.args as Record<string, unknown> | undefined
      const filePath = args?.filePath ?? args?.file_path ?? args?.path
      if (typeof filePath !== "string") return

      readPaths.add(resolve(directory, filePath))
    },

    "tool.execute.before": async (input, output) => {
      const tool = String(input?.tool ?? "").toLowerCase()
      if (tool !== "edit" && tool !== "write") return

      const args = output?.args as Record<string, unknown> | undefined
      const filePath =
        args?.filePath ?? args?.file_path ?? args?.path
      if (typeof filePath !== "string") return

      const absolute = resolve(directory, filePath)

      // Only guard existing files — new files don't need a prior read
      if (!existsSync(absolute)) return

      // Already read this file — allow
      if (readPaths.has(absolute)) return

      throw new Error(
        `Edit blocked: "${filePath}" has not been read in this session.\n` +
          `Use the Read tool on this file first, then retry your edit.`,
      )
    },
  }
}
