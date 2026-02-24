---
summary: System overview — architecture, data flow, and design decisions.
read_when:
  - First time working in this repo
  - After a long break
---

# Overview

## What This Repo Is

Single source of truth for AI coding assistant configurations across four CLIs:
**Claude Code**, **OpenCode**, **Gemini CLI**, and **Codex**.

All commands, agents, skills, MCP server definitions, and the unified
`AGENTS.md` instruction file are authored once in `configs/` and synced to
each CLI's system directory via an agent-driven workflow.

## How It Works

The `acsync` CLI handles all sync operations programmatically:

```
configs/         acsync CLI        CLI system dirs
  commands/*.md   -->  (adapters)   -->   ~/.claude/commands/
  agents/         -->  transform    -->   ~/.config/opencode/command/
  skills/         -->  + secrets    -->   ~/.gemini/commands/
  mcp/*.json      -->  + merge      -->   ~/.codex/prompts/
```

### Push (Repo to System)

`acsync push` reads canonical sources, transforms them to each CLI's native
format (Markdown, TOML, JSON), injects secrets from `.env`, and writes to
system directories with atomic writes and rollback on failure.

### Pull (System to Repo)

`acsync pull` reads system files, reverse-transforms to canonical format,
redacts secrets, and writes back to the repo.

### Check (Drift Detection)

`acsync check` renders canonical sources and diffs against system state.
Read-only — reports drift without modifying anything.

## Key Design Decisions

**Code-driven sync**: A TypeScript CLI (`acsync`) implements all format
transformations, secret handling, and merge logic. Per-CLI adapters handle
the 4 different output shapes. Format spec: `docs/design/sync-spec.md`.

**Canonical source**: `configs/` is the single source of truth. System
directories are derived. Pull operations extract from system back to canonical.

**Secret separation**: Real values live in `.env` (gitignored). Repo files
use `${VAR}` placeholders. The CLI handles injection (push) and redaction
(pull) at the boundary.

**Manifest tracking**: `.acsync/manifest.json` tracks sync state for 3-way
hash comparison — detecting independent target modifications vs source changes.

## Architecture

```
acsync/
  src/                        TypeScript sync engine (adapters, diff, secrets, formats)
  .env                        Secrets (gitignored)
  configs/
    commands/*.md              8 slash commands (canonical)
    agents/                    Agent definitions (canonical, currently empty)
    skills/                    2 skill directories (canonical)
    mcp/*.json                 3 MCP server definitions (canonical)
    settings/*.json            2 settings definitions (claude, opencode)
    instructions/AGENTS.md     Unified agent operating system (ground truth)
    instructions/TOOLS.md      Tool-use reference
  scripts/
    committer                  Git commit helper
    generate-docs.py           Docs catalog generator
    browser-tools.ts           Chrome DevTools CLI
  docs/                        Operational documentation
  backups/                     Pre-sync backups (gitignored)
```

## What's Different From v1

v1 had a 3,500 LOC Python sync engine with 6,800 LOC of tests, rendered
output directories per CLI, a registry system, and overlay support.

v2 started as ~400 lines of playbook + slash commands (agent-driven). It has
since evolved into a full TypeScript CLI (`acsync`) with per-CLI adapters,
a diff engine, secret handling, and manifest-based drift detection.
