# Claude Code Addendum

## Paths
- Canonical rules: `~/Repos/agents/AGENTS.md`
- Canonical commands: `~/Repos/agents/configs/common/commands`
- Canonical subagents: `~/Repos/agents/configs/common/agents`
- Claude commands (rendered): `~/.claude/commands/zz/`
- Claude subagents (rendered): `~/.claude/agents/`
- Helper scripts: `~/Repos/agents/scripts`

## Web Access
WebFetch blocked (corporate proxy). Use Tavily MCP
(`mcp__tavily_*`) for web lookups.

## SSL Certificates
SSL_CERT_FILE + NODE_EXTRA_CA_CERTS -> `~/.claude/cacert.pem`.
Set in `~/.claude/settings.json` under `env` key.

## MCPorter
Non-native MCP servers via `mcporter call`. See `## Tools` in AGENTS.md.

## Config Management
- Global configs are managed in `~/Repos/agents`.
- Use `/zz:sync-agent-configs` to sync configs across CLIs.
- Keep secrets in `.env`; never commit them.
