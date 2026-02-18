---
summary: "Canonical subagent model and cross-CLI rendering contract."
read_when:
  - "Adding or changing subagents"
  - "Debugging prompt/subagent drift across Claude, Codex, Gemini, OpenCode"
---

# Subagent and Command System

## Canonical sources
- Canonical subagent specs: `configs/common/agents/*.md`.
- Canonical command specs: `configs/common/commands/*.md`.
- Each spec uses front-matter (`name`, `description`, optional `model`, optional `allowed-tools`) plus body instructions.

## Render targets — agents
- Claude Code: verbatim copy to `~/.claude/agents/`.
- Gemini CLI: add `kind: local` to frontmatter, copy to `~/.gemini/agents/`.
- OpenCode: rebuild frontmatter (`mode: subagent`, translate `allowed-tools` to `tools` map), copy to `~/.config/opencode/agents/`.
- Codex: flat Markdown as `~/.codex/prompts/agent-{name}.md`.

## Render targets — commands
- Claude Code: strip `zz-` prefix, nest under `~/.claude/commands/zz/` (invoked as `/zz:name`).
- Gemini CLI: convert to TOML (`description` + `prompt = """..."""`), copy to `~/.gemini/commands/`.
- OpenCode: rebuild frontmatter (`description`, `argument-hint`, translate `allowed-tools` to `tools` map), copy to `~/.config/opencode/command/`.
- Codex: flat Markdown with `# /{name}` heading, copy to `~/.codex/prompts/`.

## Instruction addendums
- Canonical source: `configs/common/instructions/{cli}.md`.
- System locations: `~/.claude/CLAUDE.md`, `~/.config/opencode/OPENCODE.md`, `~/.gemini/GEMINI.md`, `~/.codex/AGENTS.md`.
- These point to `~/Repos/agents/AGENTS.md` and add CLI-specific notes (paths, quirks, restrictions).
- Synced via `/zz-sync-agent-configs push` alongside commands, agents, and MCP.

## Operational rules
- Update only `configs/common/agents/` and `configs/common/commands/` for shared behavior changes.
- Do not hand-edit system files; use `/zz-sync-agent-configs push` to distribute.
- If you need CLI-specific behavior, edit `configs/common/instructions/{cli}.md` and push.
- Full format specification lives in `SYNC.md` sections 2.1 through 2.5.
