---
description: Sync agent configs between this repo and CLI system directories using the acsync CLI.
argument-hint: "[check|push|pull|diff] [flags]"
allowed-tools: [Read, Bash]
---

# /acsync-configs — Agent Config Sync

Use the `acsync` CLI to sync canonical configs to/from AI coding CLI targets.

## Quick Reference

```bash
acsync check --pretty                  # Drift detection (read-only)
acsync diff                            # Unified diff of all drift
acsync push --force --delete           # Push all + delete stale files
acsync push -t claude -t opencode      # Push to specific targets
acsync push --type commands --dry-run  # Dry-run commands only
acsync pull -s claude                  # Pull from Claude to canonical
acsync pull -s all --dry-run           # Preview pull from all targets
acsync render --type command --name gate -t opencode  # Inspect rendered output
```

## Procedure

1. Parse `$ARGUMENTS` to determine which acsync subcommand + flags to run.
   - No argument: run `acsync check --pretty` and present results.
2. Run the command and show output to user.
3. Based on results, suggest next action:
   - After **check** with drift: "Run `acsync diff` for details, or `acsync push --force --delete` to sync."
   - After **push**: "Run `acsync check --pretty` to verify zero drift."
   - After **pull**: "Review with `git diff`, then commit."
   - After **diff**: "Run `acsync push --force --delete` to apply."

## Commands

### `acsync check`

Detect drift between canonical configs and installed target files.

| Flag | Description |
|------|-------------|
| `--pretty` | Human-readable colored output (default: JSON) |
| `--json` | JSON output |
| `-t, --target <name>` | Scope to target (repeatable): `claude`, `gemini`, `codex`, `opencode` |
| `--type <name>` | Scope to type (repeatable): `commands`, `agents`, `mcps`, `instructions`, `skills` |

Exit codes: 0 = no drift, 2 = drift detected, 1 = error.

### `acsync push`

Render canonical configs and write to target CLI locations.

| Flag | Description |
|------|-------------|
| `--pretty` | Human-readable output |
| `-t, --target <name>` | Scope to target (repeatable) |
| `--type <name>` | Scope to type (repeatable) |
| `--dry-run` | Show plan without writing |
| `--force` | Skip confirmation prompt |
| `--delete` | Delete stale files not in canonical source |

Handles: format transformation, secret injection from `.env`, atomic writes, backup/rollback on failure.

### `acsync pull`

Pull configs from target CLI back to canonical format.

| Flag | Description |
|------|-------------|
| `-s, --source <target>` | **Required.** `all`, `claude`, `gemini`, `codex`, `opencode` |
| `--pretty` | Human-readable output |
| `--force` | Overwrite existing canonical items |
| `--dry-run` | Preview without writing |

Handles: reverse format transformation, secret redaction.

### `acsync diff`

Unified text diff between rendered canonical and on-disk target configs.

| Flag | Description |
|------|-------------|
| `-t, --target <name>` | Scope to target (repeatable) |
| `--type <name>` | Scope to type (repeatable) |

### `acsync render`

Render a single canonical item to target format (debug/inspection).

| Flag | Description |
|------|-------------|
| `--type <type>` | **Required.** `command`, `agent`, `mcp`, `instruction`, `skill` |
| `--name <name>` | **Required.** Canonical item name |
| `-t, --target <name>` | Target CLI (omit for all 4) |

## Architecture

- **Canonical source**: `~/Repos/acsync/configs/` (commands, agents, mcp, instructions, skills, settings)
- **Targets**: Claude Code, OpenCode, Gemini CLI, Codex — each with different formats
- **Exclusions**: `gsd-*` files always skipped (never synced, never flagged stale)
- **Secrets**: `.env` vars injected on push, redacted on pull
- **Manifest**: `.acsync/manifest.json` tracks sync state (3-way hash comparison)
- **Safety**: atomic writes, pre-write backups, rollback on failure

## Guardrails

- Never manually transform or write config files. Always use `acsync` CLI.
- Never commit secrets. After pull, verify no real values in repo files.
- For settings files (`configs/settings/`), use `acsync push/pull` — it handles subset merging.
- Scope narrowly when debugging: `-t opencode --type commands` instead of pushing everything.
