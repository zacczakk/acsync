// OpenCode Notification Plugin — fires macOS alerter on idle/permission/error.
// Requires: brew install vjeantet/tap/alerter

import type { Plugin } from "@opencode-ai/plugin"

const ALERTER = "/opt/homebrew/bin/alerter"

export const NotifyPlugin: Plugin = async ({ client, $ }) => {
  await client.app.log({
    body: { service: "notify-opencode", level: "info", message: "Plugin loaded" },
  })

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        await $`${ALERTER} -title OpenCode -message "Waiting for input" -timeout 10 -group opencode-idle`.nothrow()
      }

      if (event.type === "permission.updated") {
        await $`${ALERTER} -title "Permission needed" -message "Action requires approval" -sound Ping -timeout 0 -group opencode-permission`.nothrow()
      }

      if (event.type === "session.error") {
        await $`${ALERTER} -title "OpenCode error" -message "Session hit an error" -sound Basso -timeout 15 -group opencode-error`.nothrow()
      }
    },
  }
}
