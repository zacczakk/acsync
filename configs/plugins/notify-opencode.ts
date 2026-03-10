// OpenCode Notification Plugin — macOS alerter for idle/permission/error.
// Requires: brew install vjeantet/tap/alerter
import type { Plugin } from "@opencode-ai/plugin"

let loaded = false

const ALERTER = "/opt/homebrew/bin/alerter"
const ICON = "~/Repos/acsync/configs/assets/opencode-icon.png"

function notify($: any, title: string, message: string, opts?: { sound?: string; timeout?: number; group?: string }) {
  const args = ["--title", title, "--message", message, "--app-icon", ICON, "--sender", "com.googlecode.iterm2"]
  if (opts?.sound) args.push("--sound", opts.sound)
  args.push("--timeout", String(opts?.timeout ?? 10))
  if (opts?.group) args.push("--group", opts.group)
  $`${ALERTER} ${args}`.nothrow().then(() => {}).catch(() => {})
}

export const NotifyPlugin: Plugin = async ({ $ }) => {
  if (loaded) return {}
  loaded = true

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        notify($, "OpenCode", "Waiting for input", { timeout: 10, group: "oc-idle" })
      }
      if (event.type === "permission.asked") {
        notify($, "Permission needed", "Action requires approval", { sound: "Ping", timeout: 0, group: "oc-permission" })
      }
      if (event.type === "session.error") {
        notify($, "OpenCode", "Session error", { sound: "Basso", timeout: 15, group: "oc-error" })
      }
    },
  }
}
