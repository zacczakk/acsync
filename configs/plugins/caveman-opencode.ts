import type { Plugin } from "@opencode-ai/plugin"

type CavemanMode = "lite" | "full" | "ultra"

type CommandInput = {
  command?: string
  arguments?: string
  sessionID?: string
}

type SystemTransformInput = {
  sessionID?: string
}

type SystemTransformOutput = {
  system?: string[]
}

type EventInput = {
  event?: {
    type: string
    properties?: { info?: { id?: string } } & Record<string, unknown>
  }
}

const VALID_MODES = new Set<CavemanMode>(["lite", "full", "ultra"])

const sessionModes = new Map<string, CavemanMode>()

function parseMode(rawArguments: string | undefined): CavemanMode | "off" | null {
  const arg = (rawArguments ?? "").trim().toLowerCase()
  if (arg === "" || arg === "full") return "full"
  if (arg === "lite" || arg === "ultra") return arg
  if (arg === "off" || arg === "stop") return "off"
  return null
}

function renderReminder(mode: CavemanMode): string {
  return `<caveman-mode level="${mode}">
Compressed reply style is ACTIVE for this session at level "${mode}".

Levels:
- lite: short sentences, grammar intact, cut filler
- full: telegraph style, noun phrases ok, drop articles when safe
- ultra: maximal compression, fragments ok, shortest unambiguous wording

Apply to the current reply. Fall back to normal clarity for safety warnings, destructive or irreversible actions, multi-step procedures where compression risks ambiguity, or explicit user requests for clarification.

The user toggles this with /caveman lite|full|ultra and disables it with /caveman off.
</caveman-mode>`
}

export const CavemanOpenCodePlugin: Plugin = async () => {
  return {
    "command.execute.before": async (input: CommandInput) => {
      if (input.command !== "caveman") return
      if (!input.sessionID) return

      const mode = parseMode(input.arguments)
      if (!mode) return

      if (mode === "off") {
        sessionModes.delete(input.sessionID)
        return
      }

      if (!VALID_MODES.has(mode)) return

      sessionModes.set(input.sessionID, mode)
    },
    "experimental.chat.system.transform": async (
      input: SystemTransformInput,
      output: SystemTransformOutput,
    ) => {
      if (!input.sessionID) return
      const mode = sessionModes.get(input.sessionID)
      if (!mode) return

      output.system ??= []
      output.system.push(renderReminder(mode))
    },
    event: async (input: EventInput) => {
      const event = input.event
      if (!event || event.type !== "session.deleted") return
      const id = event.properties?.info?.id
      if (id) sessionModes.delete(id)
    },
  }
}
