READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# OpenCode Addendum

## Paths
- Canonical rules: `~/Repos/agents/AGENTS.md`
- Canonical commands: `~/Repos/agents/configs/common/commands`
- Canonical subagents: `~/Repos/agents/configs/common/agents`
- OpenCode commands (rendered): `~/.config/opencode/command/`
- OpenCode subagents (rendered): `~/.config/opencode/agents/`
- OpenCode skills (rendered): `~/.config/opencode/skill/`
- Helper scripts: `~/Repos/agents/scripts`

## Naming Quirks
- Singular directories: `command/`, `skill/` (not `commands/`, `skills/`).
- MCP env key: `environment` (not `env`).
- MCP transport types: `local`/`remote` (not `stdio`/`http`).
- MCP command: always an array (not string + args).
- Provider env vars: `{env:VAR_NAME}` syntax (OpenCode resolves at startup).

## Web Access
- WebFetch works in OpenCode (not blocked by corporate proxy, unlike Claude Code).
- Still prefer Tavily MCP for search (structured results, topic/date filtering).
- Use WebFetch for fetching specific URLs.

## Config Management
- Global configs are managed in `~/Repos/agents`.
- Use `/zz-sync-agent-configs` to sync configs across CLIs.
- Keep secrets in `.env`; never commit them.
