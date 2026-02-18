---
summary: "Catalog of local tools and MCP servers used by the agent setup."
read_when:
  - "Adding or updating MCP servers"
  - "Needing browser automation or web search"
---

# Tools

## MCP Servers
- `tavily`: Web search/extract (Claude, OpenCode, Gemini).
- `context7`: Documentation retrieval for coding libraries (all CLIs).
- `sequential-thinking`: Structured reasoning tool (Claude only).
- `palantir-mcp`: Foundry access (Claude only; requires `PALANTIR_FOUNDRY_TOKEN`).
- `liquid-carbon`: Domain-specific MCP (Claude, OpenCode).
- `shadcn`: shadcn/ui component library (disabled by default).
- Incident response: `docs/runbooks/mcp-incident.md`.

## Local Helpers (repo)
- `scripts/committer`: Safe commit helper; stages only listed paths.
- `scripts/generate-docs.py`: Lists `docs/` catalog and enforces front-matter.
- `scripts/browser-tools.ts`: Lightweight Chrome DevTools helper.

## Common CLI
- `git`, `rg`, `bun`, `node`, `python3`, `pytest`

## Related Docs
- Subagents: `docs/subagent.md`
- MCP incidents: `docs/runbooks/mcp-incident.md`
