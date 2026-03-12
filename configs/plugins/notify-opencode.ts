// OpenCode Notification Plugin — macOS alerter for idle/permission/question/error.
// Requires: brew install vjeantet/tap/alerter
import type { Plugin } from "@opencode-ai/plugin"

let loaded = false

const ALERTER = "/opt/homebrew/bin/alerter"
const ICON = new URL("../assets/opencode-icon.png", import.meta.url).pathname

function focusItermPane($: any) {
  const sessionId = process.env.ITERM_SESSION_ID
  if (!sessionId) return
  const uuid = sessionId.split(":")[1]
  if (!uuid) return
  const script = `tell application "iTerm2"
    activate
    repeat with w in windows
      repeat with t in tabs of w
        repeat with s in sessions of t
          if unique ID of s is "${uuid}" then
            select t
            select s
            return
          end if
        end repeat
      end repeat
    end repeat
  end tell`
  $`osascript -e ${script}`.quiet().nothrow().catch(() => {})
}

function notify($: any, title: string, message: string, opts?: { sound?: string; timeout?: number; group?: string }) {
  const args = ["--title", title, "--message", message, "--app-icon", ICON]
  if (opts?.sound) args.push("--sound", opts.sound)
  args.push("--timeout", String(opts?.timeout ?? 10))
  if (opts?.group) args.push("--group", opts.group)
  $`${ALERTER} ${args}`.quiet().nothrow().then((r: any) => {
    if (r.text().trim() === "@ACTIONCLICKED") focusItermPane($)
  }).catch(() => {})
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
      if (event.type === "question.asked") {
        notify($, "Question", "Agent is asking a question", { sound: "Ping", timeout: 0, group: "oc-question" })
      }
      if (event.type === "session.error") {
        notify($, "OpenCode", "Session error", { sound: "Basso", timeout: 15, group: "oc-error" })
      }
    },
  }
}
