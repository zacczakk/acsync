---
summary: "Canonical subagent model and cross-CLI rendering contract."
read_when:
  - "Adding or changing subagents"
  - "Debugging prompt/subagent drift across Claude, Codex, Gemini, OpenCode"
---

# Subagent and Command System

## Canonical sources
- Canonical subagent specs: `configs/agents/*.md`.
- Canonical command specs: `configs/commands/*.md`.
- Agent specs use OpenCode-style frontmatter as the source of truth:
  - required: `description`
  - common: `mode`, `model`, `permission`, `color`
  - body: verbatim agent instructions
- Commands remain markdown with frontmatter plus body instructions.

## Render targets — agents
- Claude Code: derive portable frontmatter (`name`, `description`, optional `model`, derived `allowed-tools`), copy to `~/.claude/agents/`.
- Gemini CLI: same portable frontmatter plus `kind: local`, copy to `~/.gemini/agents/`.
- OpenCode: pass through OpenCode-compatible frontmatter, force `mode: subagent`, copy to `~/.config/opencode/agents/`.
- Codex: flat Markdown as `~/.codex/prompts/agent-{name}.md` with derived `Role` and `Allowed Tools` lines.

## Portable tool derivation
- Non-OpenCode targets do not consume OpenCode `permission` blocks directly.
- Adapters derive a best-effort portable `allowed-tools` list from canonical metadata:
  - always include `Read`, `Glob`, `Grep`
  - add `Edit` and `Write` when `permission.edit != deny`
  - add `Bash` when `permission.bash != deny`
  - add `WebFetch` when `permission.webfetch != deny`
- OpenCode-only keys like `permission`, `color`, and `mode` are dropped when the target does not support them.

## Render targets — commands
- Claude Code: strip `zz-` prefix, nest under `~/.claude/commands/zz/` (invoked as `/zz:name`).
- Gemini CLI: convert to TOML (`description` + `prompt = """..."""`), copy to `~/.gemini/commands/`.
- OpenCode: rebuild frontmatter (`description`, `argument-hint`, translate `allowed-tools` to `tools` map), copy to `~/.config/opencode/command/`.
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
