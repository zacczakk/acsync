# External Integrations

**Analysis Date:** 2026-02-19

## APIs & External Services

**Web Search & Content Extraction:**
- Tavily — Web search, content extraction, URL crawling
  - SDK/Client: `tavily-mcp` Python package (MCP server)
  - Auth: `TAVILY_API_KEY` env var
  - Transport: stdio (`python -m tavily_mcp`)
  - Config: `configs/mcp/tavily.json`

**Library Documentation:**
- Context7 — Programming library documentation retrieval
  - SDK/Client: HTTP MCP endpoint
  - Auth: `CONTEXT7_API_KEY` env var (sent as header)
  - Transport: HTTP (`https://mcp.context7.com/mcp`)
  - Config: `configs/mcp/context7.json`

**Enterprise Data Platform:**
- Foundry Platform — Ontology access, dataset queries, builds
  - SDK/Client: `foundry-mcp` npm package (MCP server)
  - Auth: `FOUNDRY_TOKEN` env var
  - Transport: stdio (`npx -y foundry-mcp --foundry-api-url ${FOUNDRY_HOST}`)
  - Config: `configs/mcp/foundry-mcp.json`
  - Disabled for: Codex

**AI Model Providers (OpenCode only):**
- Corp Proxy Bedrock — Corporate proxy to AWS Bedrock models
  - SDK/Client: `@ai-sdk/openai-compatible` npm package
  - Auth: `CORP_BEDROCK_API_KEY` env var
  - Base URL: `${CORP_BASE_URL}/model/`
  - Models: Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4.5
  - Config: `configs/settings/opencode.json` → `provider.corp-proxy-bedrock`

- Corp Proxy Foundry — Corporate proxy to Anthropic via Foundry LMS
  - SDK/Client: `@ai-sdk/anthropic` npm package
  - Auth: `ANTHROPIC_AUTH_TOKEN` env var (Bearer token)
  - Base URL: `{env:ANTHROPIC_BASE_URL}/v1`
  - Models: Claude Opus 4.6, Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 4.5
  - Config: `configs/settings/opencode.json` → `provider.corp-proxy-foundry`

**Browser Automation:**
- Chrome DevTools Protocol — Direct browser control
  - SDK/Client: `puppeteer-core` `^24.37.3` (in `scripts/browser-tools.ts`)
  - Auth: None (local connection via `http://localhost:9222`)
  - Connects to Chrome launched with `--remote-debugging-port`

- Chrome DevTools MCP — MCP-based browser automation (alternative to local script)
  - SDK/Client: `chrome-devtools-mcp` npm package
  - Auth: None
  - Transport: stdio (`npx -y chrome-devtools-mcp@latest`)
  - Config: `configs/mcp/chrome-devtools-mcp.json`
  - Disabled for: Codex

**Component Libraries:**
- Liquid Carbon — Domain-specific component library
  - SDK/Client: `liquid-carbon-mcp` binary on PATH
  - Auth: None
  - Transport: stdio
  - Config: `configs/mcp/liquid-carbon.json`
  - Disabled for: Codex

- shadcn/ui — UI component library
  - SDK/Client: `shadcn@latest` npm package
  - Auth: None
  - Transport: stdio (`npx shadcn@latest mcp`)
  - Config: `configs/mcp/shadcn.json`
  - Disabled for: Codex

**Reasoning Tools:**
- Sequential Thinking MCP — Structured reasoning
  - SDK/Client: `@modelcontextprotocol/server-sequential-thinking` npm package
  - Auth: None
  - Transport: stdio
  - Config: `configs/mcp/sequential-thinking.json`
  - Disabled for: Codex

## Data Storage

**Databases:**
- None — No database; all state is files on disk

**File Storage:**
- Local filesystem only
- Config files in `configs/`
- Secrets in `.env` (gitignored)
- Backups in `backups/` (gitignored)
- Compiled binaries in `bin/` (gitignored)

**Caching:**
- Chrome user data dir: `~/.cache/scraping` (created by `browser-tools start`)

## Authentication & Identity

**Auth Provider:**
- No user authentication system — This is a developer tool, not a service

**Secret Management:**
- `.env` file at repo root (gitignored)
- Secrets injected during push operations, redacted during pull
- Placeholder format: `${VAR_NAME}` in canonical files
- OpenCode runtime refs: `{env:VAR_NAME}` syntax (not secret placeholders; resolved at runtime)

**Secret Variables:**

| Variable | Used By | Injection Target |
|----------|---------|-----------------|
| `TAVILY_API_KEY` | Tavily MCP | `env` block in MCP config |
| `CONTEXT7_API_KEY` | Context7 MCP | `headers` block in MCP config |
| `CORP_BEDROCK_API_KEY` | OpenCode settings | `provider.corp-proxy-bedrock.options.apiKey` |
| `FOUNDRY_TOKEN` | Foundry MCP | `env` block in MCP config |
| `FOUNDRY_HOST` | Foundry MCP | CLI arg `--foundry-api-url` |
| `CORP_BASE_URL` | OpenCode settings | `provider.corp-proxy-bedrock.options.baseURL` |

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Console output only (no structured logging)
- `browser-tools console` command captures Chrome console logs with color-coded types

## CI/CD & Deployment

**Hosting:**
- Not deployed — Local developer tool only

**CI Pipeline:**
- GitHub Actions (referenced via `gh run list/view` in AGENTS.md)
- No CI config files in repo (`.github/workflows/` not present)

**Version Control:**
- Git with GitHub remote (`https://github.com/zacczakk/acsync.git`)
- `gh` CLI for PR management, issue tracking, CI interaction

## Environment Configuration

**Required env vars (from `.env.example`):**
- `TAVILY_API_KEY` — Tavily web search
- `CONTEXT7_API_KEY` — Context7 docs retrieval
- `CORP_BEDROCK_API_KEY` — Corporate AI proxy (Bedrock)
- `FOUNDRY_TOKEN` — Foundry Platform access
- `FOUNDRY_HOST` — Foundry Platform API URL
- `CORP_BASE_URL` — Corporate AI proxy base URL

**Secrets location:**
- `.env` at repo root (gitignored, never committed)
- Validated before sync push: all 4 core secret vars must be present and non-empty

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## CDN Dependencies (Runtime)

The `browser-tools.ts` script loads libraries from unpkg CDN at runtime during content extraction:
- `https://unpkg.com/@mozilla/readability@0.4.4/Readability.js`
- `https://unpkg.com/turndown@7.1.2/dist/turndown.js`
- `https://unpkg.com/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js`

These are injected into the browser page context, not installed as npm dependencies.

## MCP Server Availability by CLI

| MCP Server | Claude | OpenCode | Gemini | Codex |
|------------|--------|----------|--------|-------|
| Tavily | Yes | Yes | Yes | No (stdio) |
| Context7 | Yes | Yes | Yes | Yes (HTTP) |
| Foundry | Yes | Yes | Yes | No (disabled) |
| Sequential Thinking | Yes | Yes | Yes | No (disabled) |
| Chrome DevTools | Yes | Yes | Yes | No (disabled) |
| Liquid Carbon | Yes | Yes | Yes | No (disabled) |
| shadcn | Yes | Yes | Yes | No (disabled) |

Codex supports HTTP transport only; all stdio MCP servers are silently skipped.

---

*Integration audit: 2026-02-19*
