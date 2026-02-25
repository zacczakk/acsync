# acsync

Single source of truth for AI coding assistant configurations.
Code-driven sync across Claude Code, OpenCode, Gemini CLI, and Codex.

## First-Time Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/zacczakk/acsync.git ~/Repos/acsync
   cd ~/Repos/acsync
   ```

2. Install dependencies and link the CLI:
   ```bash
   bun install && bun link
   ```

3. Copy `.env.example` to `.env` and fill in secrets:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. Push configs to all CLIs:
   ```bash
   acsync push --force --delete
   ```

## Quick Start

```bash
acsync check --pretty            # drift detection (read-only)
acsync diff                      # unified diff of all drift
acsync push --force --delete     # push all + delete stale files
acsync pull -s claude            # pull from Claude to canonical
```

## Directory Layout

```
.env                         Secrets (gitignored)

configs/
  commands/*.md              8 slash commands
  agents/                    Agent definitions (currently empty)
  skills/                    2 skill directories
  mcp/*.json                 3 MCP server definitions
  settings/*.json            2 settings definitions (claude, opencode)
  instructions/AGENTS.md     Unified agent operating system (ground truth)
  instructions/TOOLS.md      Tool-use reference

src/                         TypeScript sync engine
  cli/                       check, push, pull, diff, render, helpers commands
  adapters/                  Per-CLI renderers (claude, opencode, gemini, codex)
  core/                      Diff engine, formatter, manifest tracking
  formats/                   Parsers (markdown, JSON, JSONC, TOML)
  secrets/                   .env injection/redaction
  infra/                     Atomic writes, exclusion filters

scripts/
  committer                  Git commit helper
  generate-docs.py           Docs catalog generator
  browser-tools.ts           Chrome DevTools CLI

docs/                        Operational docs
backups/                     Pre-sync backups (gitignored)
```

## How It Works

The `acsync` CLI handles all sync operations programmatically:

- Reads canonical configs from `configs/`
- Transforms to each CLI's native format (Markdown, TOML, JSON)
- Injects secrets from `.env` on push, redacts on pull
- Subset-merges settings (preserves user-added keys)
- Tracks sync state via `.acsync/manifest.json` (3-way hash comparison)
- Atomic writes with backup/rollback on failure

## Helper Scripts

Copy canonical helper scripts into another repo:

```bash
acsync helpers -p ~/Repos/my-project          # interactive confirm
acsync helpers -p ~/Repos/my-project --force   # no prompt
acsync helpers -p . --dry-run                  # preview only
```

Writes all files from `scripts/` into `<path>/scripts/`, skipping files
already up to date (SHA-256 match). Supports `--json` for machine output.

## Secrets

Copy `.env.example` to `.env` and fill in:

```
TAVILY_API_KEY=
CONTEXT7_API_KEY=
UPTIMIZE_BEDROCK_API_KEY=
PALANTIR_FOUNDRY_TOKEN=
```

Secrets are injected during push and redacted during pull. Never committed.

## Docs

Run `python scripts/generate-docs.py` for the full docs catalog.

| Doc | When to Read |
|-----|-------------|
| `docs/overview.md` | First time in the repo |
| `docs/architecture.md` | Understanding repo structure |
| `docs/subagent.md` | Writing new commands or agents |
| `docs/tools.md` | Understanding available tools |
| `docs/tavily-reference.md` | Configuring Tavily MCP |
| `docs/runbooks/mcp-incident.md` | MCP server outage |
