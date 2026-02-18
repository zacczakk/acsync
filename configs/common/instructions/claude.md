READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Claude Code Addendum

## Paths
- Canonical rules: `~/Repos/agents/AGENTS.md`
- Canonical commands: `~/Repos/agents/configs/common/commands`
- Canonical subagents: `~/Repos/agents/configs/common/agents`
- Claude commands (rendered): `~/.claude/commands/zz/`
- Claude subagents (rendered): `~/.claude/agents/`
- Helper scripts: `~/Repos/agents/scripts`

## Web Access
WebFetch is blocked by corporate proxy. Use the Tavily MCP server
(`mcp__tavily_*`) for all web lookups instead.

## SSL Certificates
SSL_CERT_FILE and NODE_EXTRA_CA_CERTS point to `~/.claude/cacert.pem`.
These are set in `~/.claude/settings.json` under the `env` key.

## Config Management
- Global configs are managed in `~/Repos/agents`.
- Use `/zz:sync-agent-configs` to sync configs across CLIs.
- Keep secrets in `.env`; never commit them.
