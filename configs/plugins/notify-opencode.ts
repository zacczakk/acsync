// OpenCode Notification Plugin — fires macOS alerter notifications
// for permission prompts and idle sessions.
// Requires: brew install vjeantet/tap/alerter

import type { Plugin } from "@opencode-ai/plugin"
import { execFile, type ExecFileException } from "child_process"
import { accessSync } from "fs"
import { join } from "path"

const ALERTER_PATH = "/opt/homebrew/bin/alerter"
const ICON = join(__dirname, "..", "assets", "opencode-icon.png")

function alerterAvailable(): boolean {
  try {
    accessSync(ALERTER_PATH)
    return true
  } catch {
    return false
  }
}

function sendNotification(opts: {
  title: string
  message: string
  sound?: string
  timeout?: number
  group?: string
}) {
  if (!alerterAvailable()) return

  const args = ["-title", opts.title, "-message", opts.message, "-appIcon", ICON]
  if (opts.sound) args.push("-sound", opts.sound)
  if (opts.timeout !== undefined) args.push("-timeout", String(opts.timeout))
  if (opts.group) args.push("-group", opts.group)

  execFile(ALERTER_PATH, args, (err: ExecFileException | null) => {
    if (err) console.error(`notify-opencode: ${err.message}`)
  })
}

export const NotifyPlugin: Plugin = async ({ client }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        sendNotification({
          title: "OpenCode is waiting",
          message: "Session idle — awaiting input",
          timeout: 10,
          group: "opencode-idle",
        })
        await client.app.log({
          body: { service: "notify-opencode", level: "info", message: "Idle notification sent" },
        })
      }
    },
    middleware: {
      "permission.ask": async ({ next, event }) => {
        sendNotification({
          title: "Permission needed",
          message: (event as Record<string, unknown>).description as string || "Action requires approval",
          sound: "Ping",
          timeout: 0,
          group: "opencode-permission",
        })
        return next()
      },
    },
  }
}
