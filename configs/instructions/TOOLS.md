# Tools

Canonical tool-use documentation for agents. Read on demand — not rendered to any CLI target.

## acsync

Agent Config Sync CLI. Syncs canonical configs to AI CLI targets (claude-code, opencode, gemini, codex).

- **Source:** `~/Repos/acsync/src/cli/`
- **Canonical configs:** `~/Repos/acsync/configs/`
- **Installed via:** `bun link` (available on PATH as `acsync`)

### Subcommands
- `acsync check --pretty` — Show drift between canonical and rendered configs.
- `acsync push --force --delete` — Push all canonical configs to targets; delete stale rendered files.
- `acsync pull` — Pull rendered configs back to canonical (reverse sync).
- `acsync render` — Render canonical to target format without writing.
- `acsync diff` — Show detailed diff of changes.

### Quick ref
```bash
acsync check --pretty       # What's drifted?
acsync push --force --delete # Sync everything
acsync diff                  # Detailed changes
```

## committer

Safe git commit helper. Stages only listed paths — never `git add .`.

- **Location:** PATH (system-wide). Repo may also ship `./scripts/committer`.
- **Usage:** `committer "commit message" file1 file2 ...`

```bash
committer "fix: update config" src/app.ts README.md
committer "feat(08-01): add TOOLS.md" configs/instructions/TOOLS.md
```

## trash

Move files to macOS Trash instead of `rm`. Required for safe deletes.

```bash
trash path/to/file
trash path/to/directory
```

## generate-docs

Lists `docs/` catalog and enforces front-matter compliance.

- **Location:** `~/Repos/acsync/scripts/generate-docs.py`
- **Usage:** `python scripts/generate-docs.py`
- **Run:** After adding/modifying docs; honors `read_when` hints in front-matter.

## browser-tools

Lightweight Chrome DevTools helper for browser automation.

- **Source:** `~/Repos/acsync/scripts/browser-tools.ts`
- **Binary:** `~/Repos/acsync/bin/browser-tools`
- **Rebuild:** `bun build scripts/browser-tools.ts --compile --target bun --outfile bin/browser-tools`

### Subcommands
- `start` — Launch Chrome with DevTools protocol.
- `nav <url>` — Navigate to URL.
- `eval <js>` — Evaluate JavaScript in page context.
- `screenshot` — Capture page screenshot.
- `pick` — DOM element picker.
- `cookies` — View/manage cookies.
- `inspect` — Open DevTools inspector.
- `kill` — Close Chrome instance.

## gh

GitHub CLI for PRs, issues, CI, and releases.

- Given a GitHub URL or `/pull/N`: use `gh`, not web search.
- Prefer `gh pr view/diff` over URL fetching.

```bash
gh issue view <url> --comments -R owner/repo
gh pr view <url> --comments --files -R owner/repo
gh pr create --title "title" --body "body"
gh run list --limit 5
gh run view <id>
```

## tmux

Terminal multiplexer. Use only for persistence/interaction (debugger, server).

```bash
tmux new -d -s codex-shell        # Create detached session
tmux attach -t codex-shell        # Attach to session
tmux list-sessions                # List active sessions
tmux kill-session -t codex-shell  # Kill session
```

## mcporter

MCP launcher for non-native servers. Keeps chrome-devtools warm via daemon.

- **Config:** `~/.mcporter/mcporter.json`
- **Daemon:** Auto-starts on first keep-alive call; `mcporter daemon stop` to tear down.

### Usage
```bash
mcporter call <server>.<tool> <args>   # Call a tool
mcporter list <server>                 # List server tools
```

### Available Servers
- `chrome-devtools` (daemon) — Browser automation via DevTools protocol.
- `palantir-mcp` — Foundry access (requires `PALANTIR_FOUNDRY_TOKEN`).
- `liquid-carbon` — Domain-specific MCP server.
- `shadcn` — shadcn/ui component library (disabled by default).

## MCP Servers

Configured MCP servers across CLI targets:

| Server | CLIs | Notes |
|--------|------|-------|
| `tavily` | Claude, OpenCode, Gemini | Web search/extract |
| `context7` | All | Library documentation retrieval |
| `sequential-thinking` | Claude only | Structured reasoning |
| `palantir-mcp` | Claude only | Requires `PALANTIR_FOUNDRY_TOKEN` |
| `liquid-carbon` | Claude, OpenCode | Domain-specific |
| `shadcn` | Disabled by default | shadcn/ui components |

Incident response: `docs/runbooks/mcp-incident.md`

## Common CLI

Standard tools available in all environments:

- `git` — Version control. Safe by default (see AGENTS.md ## Git).
- `rg` (ripgrep) — Fast content search. Preferred over `grep`.
- `bun` — JS/TS runtime and package manager (this repo's PM).
- `node` — Node.js runtime.
- `python3` — Python interpreter. Use with `ruff`, `uv`, `pyproject.toml`.
- `pytest` — Python test runner.

## Evaluated (not adopted)

### oracle (@steipete/oracle)
- CLI tool: bundles prompt + files, sends to AI model for one-shot answer.
- Supports custom `ANTHROPIC_BASE_URL` and `ANTHROPIC_API_KEY`.
- **Does NOT work with Foundry LMS** (two blockers):
  1. Hardcodes `x-api-key` header; Foundry requires `Authorization: Bearer`.
  2. Mangles model names (`claude-4.5-sonnet` -> `claude-sonnet-4-5`); Foundry needs exact names.
- Fixable with throttle-proxy header translation (~5 LOC) + exact model names. Not implemented; low priority.
- Evaluated: 2026-02-19.
