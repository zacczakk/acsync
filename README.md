<p align="center">
  <img src="assets/logo.svg" width="128" height="128" alt="metronome logo">
</p>

<h1 align="center">metronome</h1>

<p align="center">Single source of truth for AI coding assistant configurations.</p>
Code-driven sync across Claude Code, OpenCode, Gemini CLI, and Codex.

## First-Time Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/zacczakk/metronome.git ~/Repos/zacczakk/metronome
   cd ~/Repos/zacczakk/metronome
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
   metronome push --force --delete
   ```

## Quick Start

```bash
metronome check                     # show only drifted items (default)
metronome check --verbose           # include up-to-date items
metronome diff                      # interactive diff picker (TTY) or all (piped)
metronome diff --all                # unified diff of all drift
metronome push --force --delete     # push all + delete stale files
metronome pull -s claude            # pull from Claude to canonical
```

## Directory Layout

```
.env                         Secrets (gitignored)

configs/
  commands/*.md              Slash commands
  agents/                    Agent definitions
  skills/                    Skill directories (30+, with upstream sync)
  plugins/*.ts               OpenCode plugins (identity-rendered)
  mcp/*.json                 MCP server definitions
  settings/*.json            Settings definitions (claude, opencode)
  instructions/AGENTS.md     Unified agent operating system (ground truth)
  instructions/TOOLS.md      Tool-use reference

evals/
  runner.ts                  CLI-agnostic skill eval runner
  adapters/                  opencode, claude execution backends
  sets/*.json                Eval query sets per skill
  improve.ts                 Description optimization loop
  report.ts                  HTML report generator

src/                         TypeScript sync engine
  cli/                       check, push, pull, diff, render, helpers commands
  adapters/                  Per-CLI renderers (claude, opencode, gemini, codex)
  core/                      Diff engine, formatter, manifest tracking
  formats/                   Parsers (markdown, JSON, JSONC, TOML)
  secrets/                   .env injection/redaction
  infra/                     Atomic writes, exclusion filters

scripts/
  committer                  Git commit helper
  ask-model                  Cross-model consultation (Claude/Codex/Gemini)
  sessions                   Session history search/export/browse (OpenCode + Claude)
  sync-upstream-skills.ts    Nightly upstream skill sync
  docs-list.ts               Docs catalog generator
  browser-tools.ts           Chrome DevTools CLI

docs/                        Operational docs
backups/                     Pre-sync backups (gitignored)
```

## How It Works

The `metronome` CLI handles all sync operations programmatically:

- Reads canonical configs from `configs/`
- Transforms to each CLI's native format (Markdown, TOML, JSON)
- Injects secrets from `.env` on push, redacts on pull
- Subset-merges settings (preserves user-added keys)
- Tracks sync state via `.metronome/manifest.json` (3-way hash comparison)
- Atomic writes with backup/rollback on failure

## Helper Scripts

Copy canonical helper scripts into another repo:

```bash
metronome helpers -p ~/Repos/my-project          # interactive confirm
metronome helpers -p ~/Repos/my-project --force   # no prompt
metronome helpers -p . --dry-run                  # preview only
```

Writes all files from `scripts/` into `<path>/scripts/`, skipping files
already up to date (SHA-256 match). Supports `--json` for machine output.

## Secrets

Copy `.env.example` to `.env` and fill in:

```
TAVILY_API_KEY=
CONTEXT7_API_KEY=
# Add your own provider keys as needed
```

Secrets are injected during push and redacted during pull. Never committed.

## Skill Evals

Test whether skill descriptions trigger correctly:

```bash
# Run evals for a skill (opencode adapter, default)
bun evals/runner.ts --skill session-notes --verbose

# Use claude adapter
bun evals/runner.ts --skill session-notes --adapter claude

# Auto-improve the description (eval + iterate)
bun evals/runner.ts --skill session-notes --improve --iterations 3

# Custom eval set, parallel workers, custom report path
bun evals/runner.ts --skill my-skill --eval-set path/to/set.json --workers 4 --report out.html
```

Eval sets live in `evals/sets/<skill-name>.json`:

```json
[
  { "query": "A prompt that should trigger the skill", "should_trigger": true },
  { "query": "A prompt that should NOT trigger it", "should_trigger": false }
]
```

The runner spawns `opencode run` (or `claude -p`) per query, streams the output,
and detects whether the skill was loaded. Results go to stdout as JSON + an HTML report.

## Docs

Run `bin/docs-list` (or `bun scripts/docs-list.ts`) for the full docs catalog.

| Doc | When to Read |
|-----|-------------|
| `docs/overview.md` | First time in the repo |
| `docs/architecture.md` | Repo layout, hooks, OpenCode plugins (incl. Cursor OAuth) |
| `docs/subagent.md` | Writing new commands or agents |
| `configs/instructions/TOOLS.md` | Understanding available tools |
| `docs/tavily-reference.md` | Configuring Tavily MCP |
| `docs/runbooks/mcp-incident.md` | MCP server outage |
