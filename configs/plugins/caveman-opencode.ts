import type { Plugin } from "@opencode-ai/plugin"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

type CavemanMode = "off" | "lite" | "full" | "ultra"

type CommandInput = {
  command?: string
  arguments?: string
  sessionID?: string
}

type SessionCreatedEvent = {
  type: "session.created"
  properties: {
    info: {
      id: string
      parentID?: string | null
    }
  }
}

type EventInput = {
  event?: SessionCreatedEvent | { type: string; properties?: unknown }
}

type PromptPart = {
  type: "text"
  text: string
}

type PromptOutput = {
  parts?: PromptPart[]
}

type ClientSession = {
  prompt?: (payload: { path: { id: string }; body: { noReply: true; parts: PromptPart[] } }) => Promise<void>
}

type PluginContext = {
  client?: {
    session?: ClientSession
  }
}

type ParsedRequest =
  | { kind: "activate-default" }
  | { kind: "activate-explicit"; mode: Exclude<CavemanMode, "off"> }
  | { kind: "deactivate"; mode: "off" }

const VALID_MODES = new Set<CavemanMode>(["off", "lite", "full", "ultra"])
const STATE_FILENAME = ".caveman-active"

function getConfigPath() {
  if (process.env.METRONOME_CAVEMAN_CONFIG_PATH) {
    return process.env.METRONOME_CAVEMAN_CONFIG_PATH
  }
  const repoRoot = process.env.METRONOME_REPO_ROOT ?? path.join(os.userInfo().homedir, "Repos", "zacczakk", "metronome")
  return path.join(repoRoot, "configs", "settings", "caveman.json")
}

function getStatePath() {
  return path.join(os.homedir(), ".config", "opencode", STATE_FILENAME)
}

function readDefaultMode(): CavemanMode {
  try {
    const parsed = JSON.parse(readFileSync(getConfigPath(), "utf8")) as { defaultMode?: string }
    return VALID_MODES.has(parsed.defaultMode as CavemanMode) ? (parsed.defaultMode as CavemanMode) : "off"
  } catch {
    return "off"
  }
}

function parseRequestedMode(text: string): ParsedRequest | null {
  const input = text.trim().toLowerCase()

  if (input === "/caveman") {
    return { kind: "activate-default" }
  }

  const slashMatch = /^\/caveman\s+(lite|full|ultra|off|stop)$/.exec(input)
  if (!slashMatch) {
    return null
  }

  const mode = slashMatch[1]
  if (mode === "off" || mode === "stop") {
    return { kind: "deactivate", mode: "off" }
  }

  return { kind: "activate-explicit", mode }
}

function resolveActivationMode(defaultMode: CavemanMode): Exclude<CavemanMode, "off"> {
  return defaultMode === "off" ? "full" : defaultMode
}

function readState(statePath: string): CavemanMode {
  try {
    const value = readFileSync(statePath, "utf8").trim()
    return VALID_MODES.has(value as CavemanMode) ? (value as CavemanMode) : "off"
  } catch {
    return "off"
  }
}

function writeState(statePath: string, mode: CavemanMode) {
  mkdirSync(path.dirname(statePath), { recursive: true })
  writeFileSync(statePath, mode)
}

function renderReminder(mode: CavemanMode) {
  if (mode === "off") return ""
  return `CAVEMAN REMINDER: level=${mode}. Compressed reply style active. Use normal clarity for safety, destructive actions, multi-step ambiguity, or explicit clarification requests.`
}

function normalizeMode(input: CommandInput): CavemanMode | null {
  const rawArguments = typeof input.arguments === "string" ? input.arguments.trim() : ""
  const requestText = rawArguments.length > 0 ? `/caveman ${rawArguments}` : "/caveman"
  const parsed = parseRequestedMode(requestText)

  if (!parsed) return null
  if (parsed.kind === "deactivate") return "off"
  if (parsed.kind === "activate-explicit") return parsed.mode

  return resolveActivationMode(readDefaultMode())
}

async function injectReminder(clientSession: ClientSession | undefined, sessionID: string | undefined, mode: CavemanMode, output: PromptOutput) {
  const reminder = renderReminder(mode)
  if (!reminder) return

  output.parts ??= []
  output.parts.push({ type: "text", text: reminder })

  if (!clientSession?.prompt || !sessionID) return

  await clientSession.prompt({
    path: { id: sessionID },
    body: {
      noReply: true,
      parts: [{ type: "text", text: reminder }],
    },
  })
}

function resolveStartupMode(statePath: string): CavemanMode {
  const persisted = readState(statePath)
  if (persisted !== "off") return persisted
  return readDefaultMode()
}

export const CavemanOpenCodePlugin: Plugin = async ({ client }: PluginContext = {}) => {
  const statePath = getStatePath()
  writeState(statePath, readState(statePath))

  return {
    event: async (input: EventInput = {}) => {
      const event = input.event
      if (!event || event.type !== "session.created") return

      const info = (event as SessionCreatedEvent).properties?.info
      if (!info?.id) return
      if (info.parentID) return

      const mode = resolveStartupMode(statePath)
      if (mode === "off") return

      await injectReminder(client?.session, info.id, mode, {})
    },
    "command.execute.before": async (input: CommandInput, output: PromptOutput = {}) => {
      if (input.command !== "caveman") return

      const mode = normalizeMode(input)
      if (!mode) return

      writeState(statePath, mode)

      if (mode === "off") return

      await injectReminder(client?.session, input.sessionID, mode, output)
    },
  }
}
