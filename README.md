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
metronome codex-provider tux        # switch Codex Desktop to Tux
metronome codex-provider enterprise # switch back; OpenAI chats become visible
```

## Directory Layout

```
.env                         Secrets (gitignored)

configs/
  commands/*.md              Slash commands (7)
  agents/                    Agent definitions (2)
  skills/                    Skill directories (36 active, with upstream sync)
  plugins/*.ts               OpenCode V1 plugins (3, identity-rendered)
  opencode/v2/plugins/       OpenCode V2 profile-owned plugins
  mcp/*.json                 MCP server definitions
  settings/*.json            Settings definitions (claude, opencode, token-tracker)
  hooks/*.js                 Hook scripts (absolute-path refs, not deployed)
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
  adapters/                  Per-CLI renderers (claude, opencode, antigravity, codex)
  core/                      Diff engine, formatter, manifest tracking
  formats/                   Parsers (markdown, JSON, JSONC, TOML)
  secrets/                   .env injection/redaction
  infra/                     Atomic writes, exclusion filters

scripts/
  committer                  Git commit helper
  ask-model                  Cross-model consultation (Claude/Codex/Gemini)
  sessions                   Session history search/export/browse (OpenCode V1/V2 + Claude + Codex)
  sessions_opencode.py       OpenCode V2 session database adapter
  sync-upstream-skills.ts    Upstream skill sync
  docs-list.ts               Docs catalog generator

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

### OpenCode V1/V2 profiles

OpenCode V1 remains the canonical authoring format. Metronome can render and
atomically activate either runtime profile:

```sh
metronome opencode use v1
metronome opencode use v2
metronome opencode status
metronome opencode update-v2
```

`metronome opencode use v1|v2` persists the active profile in
`~/.config/opencode/migration-manifest.json`. `metronome opencode status` reports
that profile; it is unrelated to `metronome status`, which remains the drift
check alias.

For generic `check`, `push`, `pull`, `render`, and `diff` operations, target
`opencode` reads that manifest and follows the active profile. An absent or
invalid manifest safely defaults to V1. Use `opencode2` to force native V2 in
scripts and CI (`metronome check -t opencode2`,
`metronome push -t opencode2 --force`). Both names resolve the same
`~/.config/opencode/` paths and cannot be combined. `opencode2` is intentionally
not in the default `ALL_TARGETS` list.

Generic V2 sync covers settings, agents, MCP, commands, skills, and
instructions. V2 plugin files are profile-owned and deployed by
`metronome opencode use v2`; generic V2 plugin sync intentionally does nothing.

Canonical `configs/settings/opencode.json` includes `./chatgpt-websearch` and
`websearch.provider: chatgpt`. V2 retains both, and runtime verification
requires the `opencode.chatgpt-websearch` plugin. Muxy is an optional V2
integration, so a Muxy load problem never aborts profile activation. V1
rendering omits these V2-only integrations.

The native V2 Muxy port is deployed as
`~/.config/opencode/plugins/metronome-muxy-notify.js`; Muxy's app-owned
`muxy-notify.js` file is left untouched because Muxy regenerates it.
The canonical global profile sets `autoupdate: false`; use
`metronome opencode update-v2` for trusted, verified CLI updates.

Every switch creates a complete compatibility backup under
`~/.config/opencode-backups/metronome/` and appends hashes, plugin status, SDK
version, and the restore source to
`~/.config/opencode/migration-manifest.json`. Ordinary `use v2` waits for the
hot-reloaded plugin catalog without restarting the shared service; `update-v2`
refreshes the Bun-installed `@opencode-ai/cli@beta`, pins the local plugin SDK
to the exact resolved build, restarts the V2 service because hot reload does
not reliably register newly deployed plugin files, and verifies the plugin
API. The package metadata and `opencode2 --version` must agree; older builds
returned by the beta channel are not activated; the current build is retained.
Failed activation restores and re-verifies the previous exact global CLI build.

Profile switches print timed stages and compact plugin retry details to stderr.
Required-plugin state changes are shown immediately; unchanged retries are
periodic. Optional-plugin gaps are reported as warnings, not failures. SDK
alignment skips `bun add` when the global CLI, local package manifest, and
installed `@opencode-ai/plugin` already match. Use `--no-align-sdk` to skip
alignment explicitly; plugin readiness still runs. `update-v2` also reports
the current and resolved global CLI builds, service restart, and exact global
rollback if activation fails.

Profile switches use atomic writes with rollback on failure.

## Helper Scripts

Copy canonical helper scripts into another repo:

```bash
metronome helpers -p ~/Repos/my-project          # interactive confirm
metronome helpers -p ~/Repos/my-project --force   # no prompt
metronome helpers -p . --dry-run                  # preview only
```

Writes all files from `scripts/` into `<path>/scripts/`, skipping files
already up to date (SHA-256 match). Supports `--json` for machine output.

The `sessions` helper reads OpenCode V1 from
`~/.local/share/opencode/opencode.db` and OpenCode V2 from
`~/.local/share/opencode-v2/opencode/opencode.db`. Use
`sessions latest --source opencode2` or `sessions list --source opencode2` to
target V2 explicitly; `--source` selects the runtime/database, while
`--project` filters the project directory. Default list/export/stats flows
include both when the databases exist.

## Secrets

Copy `.env.example` to `.env` and fill in:

```
TAVILY_API_KEY=
UPTIMIZE_ENV=dev
CONTEXT7_API_KEY=
GITHUB_PERSONAL_ACCESS_TOKEN=
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

Run `bin/docs-list` (or `bun scripts/docs-list.ts`) from a repo to list that repo's `docs/` catalog. The compiled binary resolves `docs/` from the current directory or its parents, so it works from nested paths too.

| Doc | When to Read |
|-----|-------------|
| `docs/overview.md` | First time in the repo |
| `docs/architecture.md` | Repo layout, hooks, OpenCode plugins (incl. Cursor OAuth) |
| `docs/subagent.md` | Writing new commands or agents |
| `configs/instructions/TOOLS.md` | Understanding available tools |
| `docs/tavily-reference.md` | Configuring Tavily MCP |
| `docs/runbooks/mcp-incident.md` | MCP server outage |
