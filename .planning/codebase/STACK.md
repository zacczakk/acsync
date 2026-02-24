# Technology Stack

**Analysis Date:** 2026-02-19

## Languages

**Primary:**
- TypeScript — Browser automation CLI (`scripts/browser-tools.ts`, ~1045 lines)
- Markdown — All commands, agents, skills, instruction files (`configs/common/`)

**Secondary:**
- Bash — Git commit helper (`scripts/committer`, ~112 lines)
- Python 3 — Docs catalog generator (`scripts/generate-docs.py`, ~113 lines)
- JSON — MCP server definitions, settings (`configs/common/mcp/`, `configs/common/settings/`)

## Runtime

**Environment:**
- Node.js (via Bun) — Used for TypeScript compilation and `npx` invocations
- Bun — Primary JavaScript runtime and package manager
- Python 3 — For `generate-docs.py` and Tavily MCP server (`python -m tavily_mcp`)

**Package Manager:**
- Bun (`bun.lock` present, gitignored)
- No `npm`/`pnpm`/`yarn` lockfiles

## Frameworks

**Core:**
- Commander.js `^14.0.3` — CLI argument parsing for `browser-tools.ts`
- Puppeteer-Core `^24.37.3` — Chrome DevTools Protocol client for browser automation

**Testing:**
- Not detected — No test framework configured; no test files present

**Build/Dev:**
- Bun compile — `bun build scripts/browser-tools.ts --compile --target bun --outfile bin/browser-tools`
- No bundler, no transpiler config, no `tsconfig.json`

## Key Dependencies

**Critical (from `package.json`):**
- `commander` `^14.0.3` — CLI framework for `browser-tools`
- `puppeteer-core` `^24.37.3` — Headless Chrome control (no bundled Chromium; connects to existing Chrome)

**Transitive (from `bun.lock`):**
- `@puppeteer/browsers` `2.12.1` — Browser binary management
- `@mozilla/readability` (loaded at runtime via CDN) — Content extraction
- `turndown` (loaded at runtime via CDN) — HTML-to-Markdown conversion
- `turndown-plugin-gfm` (loaded at runtime via CDN) — GFM table support for Turndown

**Infrastructure (MCP servers, installed globally or via `npx`):**
- `tavily-mcp` — Python package, run via `python -m tavily_mcp`
- `foundry-mcp` — Run via `npx -y foundry-mcp`
- `@modelcontextprotocol/server-sequential-thinking` — Run via `npx`
- `chrome-devtools-mcp` — Run via `npx -y chrome-devtools-mcp@latest`
- `shadcn@latest` — Run via `npx shadcn@latest mcp`
- `liquid-carbon-mcp` — Standalone binary on PATH

## Configuration

**Environment:**
- `.env` file at repo root (gitignored) — Holds API keys and tokens
- `.env.example` — Template with required variable names
- Required env vars: `TAVILY_API_KEY`, `CONTEXT7_API_KEY`, `CORP_BEDROCK_API_KEY`, `FOUNDRY_TOKEN`, `FOUNDRY_HOST`, `CORP_BASE_URL`
- SSL: `SSL_CERT_FILE` and `NODE_EXTRA_CA_CERTS` → `~/.claude/cacert.pem` (corporate proxy)

**Build:**
- No build config files (`tsconfig.json`, `vite.config.*`, etc.)
- `browser-tools` is compiled via single Bun command; output is `bin/browser-tools` (gitignored)

**Per-CLI Settings (canonical sources):**
- `configs/common/settings/claude.json` — Permissions (allow/deny lists) + env vars
- `configs/common/settings/opencode.json` — AI providers, model config, plugins, permissions

**Per-CLI Instructions (canonical sources):**
- `configs/common/instructions/claude.md` — Claude Code addendum
- `configs/common/instructions/opencode.md` — OpenCode addendum
- `configs/common/instructions/gemini.md` — Gemini CLI addendum
- `configs/common/instructions/codex.md` — Codex addendum

## Platform Requirements

**Development:**
- macOS (primary target; `darwin` platform detected)
- Chrome installed at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Bun runtime installed
- Python 3 installed (for `generate-docs.py` and `tavily_mcp`)
- Git, `gh` CLI, `rg` (ripgrep) on PATH
- `committer` script on PATH (or symlinked from `scripts/committer`)

**Production:**
- Not applicable — This is a config management repo, not a deployed service
- Runs locally on developer machines only
- Syncs configs to four CLI system directories (`~/.claude/`, `~/.config/opencode/`, `~/.gemini/`, `~/.codex/`)

---

*Stack analysis: 2026-02-19*
