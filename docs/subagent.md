---
summary: "Canonical subagent model and cross-CLI rendering contract."
read_when:
  - "Adding or changing subagents"
  - "Debugging prompt/subagent drift across Claude, Codex, Antigravity, OpenCode"
---

# Subagent and Command System

## Canonical sources
- Canonical subagent specs: `configs/agents/*.md`.
- Canonical command specs: `configs/commands/*.md`.
- Agent specs use OpenCode-style frontmatter as the source of truth:
  - required: `description`
  - common: `mode`, `model`, `reasoningEffort`, `textVerbosity`, `permission`, `color`
  - optional: `targets` — target names that should receive the agent; omitted means all targets
  - body: verbatim agent instructions
- Commands remain markdown with frontmatter plus body instructions.

## Render targets — agents
- Claude Code: derive portable frontmatter (`name`, `description`, optional `model`, derived `allowed-tools`), copy to `~/.claude/agents/`.
- Gemini CLI: same portable frontmatter plus `kind: local`, copy to `~/.gemini/agents/`.
- OpenCode V1: pass through OpenCode-compatible frontmatter, force `mode: subagent`, copy to `~/.config/opencode/agents/`.
- OpenCode V2: convert `permission` to ordered `permissions`; move per-agent request options into a generated model variant, then copy to the same agents directory.
- OpenCode V2 agent sync also updates the shared settings catalog so every generated `agent-*` variant referenced by an agent file is registered under its base model.
- Codex: standalone TOML as `~/.codex/agents/{name}.toml` with `name`, `description`, and `developer_instructions`. `sandbox_mode` is preserved when explicit and derived as `read-only` when canonical metadata denies edits. An `openai/*-fast` model alias renders as the base model with `model_provider = "openai"` and `service_tier = "fast"`.

Target-scoped agents are filtered before rendering and stale-item detection. The
`targets` metadata is routing metadata, not agent frontmatter. Use it for
OpenCode-only specialists such as `foundry-sql`; list both `opencode` and
`opencode2` when the agent should survive either OpenCode profile.

## Current OpenCode routing
- `explore`, `execute`, `verify`: `tux/gpt-5.6-luna` with max reasoning effort.
- `docs`, `research`, `vault-ops`: `tux/gpt-5.6-luna` with max reasoning effort.
- `release`: `tux/gpt-5.6-luna` with xhigh reasoning effort.
- `api-review`, `infra-review`: `tux/gpt-5.6-terra` with medium reasoning effort.
- `security-review`: `tux/gpt-5.6-sol` with high reasoning effort.
- `foundry-sql`: `tux/gpt-5.6-luna` with max reasoning effort; OpenCode only.

## Portable tool derivation
- Non-OpenCode targets do not consume OpenCode `permission` blocks directly.
- Adapters derive a best-effort portable `allowed-tools` list from canonical metadata:
  - always include `Read`, `Glob`, `Grep`
  - add `Edit` and `Write` when `permission.edit != deny`
  - add `Bash` when `permission.bash != deny`
  - add `WebFetch` when `permission.webfetch != deny`
- OpenCode-only keys like `permission`, `color`, and `mode` are dropped when the target does not support them.
- OpenCode GPT model options use camelCase in canonical frontmatter. Codex renders `reasoningEffort` as `model_reasoning_effort` and `textVerbosity` as `model_verbosity`.

## Render targets — commands
- Claude Code: strip `zz-` prefix, nest under `~/.claude/commands/zz/` (invoked as `/zz:name`).
- Gemini CLI: convert to TOML (`description` + `prompt = '''...'''`), copy to `~/.gemini/commands/`.
- OpenCode: preserve supported frontmatter, strip canonical-only keys, and copy to `~/.config/opencode/commands/`.
- Codex: flat Markdown with `# /{name}` heading, copy to `~/.codex/prompts/`.

## Instructions
- Canonical source: `configs/instructions/AGENTS.md` (unified, all CLI notes included).
- System locations: `~/.claude/CLAUDE.md`, `~/.config/opencode/AGENTS.md`, `~/.gemini/AGENTS.md`, `~/.codex/AGENTS.md`.
- Written verbatim to each CLI's instruction path (no per-CLI addendums).
- Synced via `metronome push` alongside commands, agents, and MCP.

## Operational rules
- Update only `configs/agents/` and `configs/commands/` for shared behavior changes.
- Do not hand-edit system files; use `metronome push` to distribute.
- If you need CLI-specific behavior, add a section to `configs/instructions/AGENTS.md` and push.
- Full format specification lives in `docs/design/sync-spec.md` sections 2.1 through 2.5.
