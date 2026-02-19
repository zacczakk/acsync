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

## Evaluated (not adopted)

### oracle (@steipete/oracle)
- CLI tool: bundles prompt + files → sends to AI model for one-shot answer.
- Supports custom `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY`.
- **Does NOT work with Foundry LMS** out of the box (two blockers):
  1. Hardcodes `x-api-key` header; Foundry requires `Authorization: Bearer`.
  2. Mangles model names (`claude-4.5-sonnet` → `claude-sonnet-4-5`); Foundry needs exact names like `claude-sonnet-4-5-20250929`.
- Fixable: add `x-api-key` → `Bearer` header translation in throttle-proxy (~5 LOC) + use exact Foundry model names. Not implemented; low priority.
- Evaluated: 2026-02-19.

## Common CLI
- `git`, `rg`, `bun`, `node`, `python3`, `pytest`

## Related Docs
- Subagents: `docs/subagent.md`
- MCP incidents: `docs/runbooks/mcp-incident.md`
