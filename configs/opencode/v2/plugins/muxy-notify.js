import { access } from "node:fs/promises"
import { spawn } from "node:child_process"
import { Plugin } from "@opencode-ai/plugin"

function record(value) {
  return typeof value === "object" && value !== null ? value : {}
}

function sessionID(event) {
  const properties = record(event.properties)
  const info = record(properties.info)
  return typeof properties.sessionID === "string" ? properties.sessionID : info.id
}

async function notify(phase, body = "") {
  const binary = process.env.MUXY_HOOK_BIN
    ?? (process.env.HOME ? `${process.env.HOME}/Library/Application Support/Muxy/hooks/muxy-hook` : "")
  if (!binary) return
  try {
    await access(binary, 1)
  } catch {
    return
  }
  const type = phase === "working" ? "user-prompt-submit" : phase === "waiting" ? "notification" : "stop"
  const input = type === "notification"
    ? { notification_type: "permission_prompt", message: body || "Needs attention" }
    : type === "stop" ? { last_assistant_message: body || "Session completed" } : {}
  const child = spawn(binary, ["agent-event", "--provider", "opencode", "--provider-title", "OpenCode", "--event", type], {
    env: process.env,
    stdio: ["pipe", "ignore", "ignore"],
  })
  child.stdin.on("error", () => {})
  child.stdin.end(JSON.stringify(input))
}

export default Plugin.define({
  id: "metronome.muxy-notify",
  setup: async (ctx) => {
    const controller = new AbortController()
    const children = new Set()
    const task = (async () => {
      try {
        for await (const raw of ctx.event.subscribe({ signal: controller.signal })) {
          const event = record(raw)
          const properties = record(event.properties)
          const info = record(properties.info)
          const id = sessionID(event)
          if (event.type === "session.created" && typeof id === "string" && info.parentID) children.add(id)
          if (typeof id === "string" && children.has(id)) continue
          if (event.type === "permission.asked" || event.type === "question.asked") await notify("waiting", "OpenCode needs attention")
          else if (event.type === "permission.replied" || event.type === "question.replied") await notify("working")
          else if (event.type === "session.status" && record(properties.status).type === "idle") await notify("finished")
          else if (event.type === "session.error") await notify("finished", "Session failed")
          if (event.type === "session.deleted" && typeof id === "string") children.delete(id)
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error("[metronome.muxy-notify]", error)
      }
    })()
    return async () => {
      controller.abort()
      await task
    }
  },
})
