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

All commands, agents, skills, and MCP server definitions are authored once in
`configs/common/` and synced to each CLI's system directory via an
agent-driven workflow.

## How It Works

There is no sync engine. No Python scripts. No build step.

Instead, the repo contains a **playbook** (`SYNC.md`) and a **slash command**
(`/zz-sync-agent-configs`) that any of the four CLIs can run. The agent reads the
playbook, computes diffs, shows them to you, and applies changes one at a time
with your confirmation.

```
configs/common/          SYNC.md           CLI system dirs
  commands/*.md    -->   (playbook)   -->   ~/.claude/commands/
  agents/*.md      -->   read by the  -->   ~/.config/opencode/command/
  skills/          -->   agent at     -->   ~/.gemini/commands/
  mcp/*.json       -->   sync time    -->   ~/.codex/prompts/
```

### Push (Repo to System)

The agent reads canonical sources, transforms them to each CLI's native
format (Markdown, TOML, JSON), injects secrets from `.env`, and writes to
system directories. You see every diff and approve every write.

### Pull (System to Repo)

The agent reads system files, reverse-transforms to canonical format, redacts
secrets, and presents diffs against the repo. You choose what to accept.

### Check (Drift Detection)

Read-only comparison. The agent renders canonical sources and diffs against
system state. Reports drift without modifying anything.

## Key Design Decisions

**Agent as sync engine**: The four CLIs are AI coding agents. They can read
files, compute diffs, transform formats, and write files. Why maintain a
separate program to do what they already do?

**Interactive by default**: Every write requires confirmation. The agent shows
diffs, explains changes, and asks before proceeding. No silent bulk operations.

**Playbook over code**: Format specifications, merge rules, and per-CLI
quirks are documented in `SYNC.md` as structured prose. The agent reads and
follows it. Changes to sync behavior are documentation edits, not code changes.

**Canonical source**: `configs/common/` is the single source of truth. System
directories are derived. Pull operations extract from system back to canonical.

**Secret separation**: Real values live in `.env` (gitignored). Repo files
use `${VAR}` placeholders. The agent handles injection (push) and redaction
(pull) at the boundary.

## Architecture

```
agents/
  AGENTS.md                   Ground truth agent operating system
  SYNC.md                     Sync playbook (format specs, merge rules, per-CLI quirks)
  .env                        Secrets (gitignored)
  configs/
    common/
      commands/*.md            17 slash commands (canonical)
      agents/*.md              8 agent definitions (canonical)
      skills/                  2 skill directories (canonical)
      mcp/*.json               6 MCP server definitions (canonical)
      settings/*.json          2 settings definitions (claude, opencode)
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

v2 replaces all of that with ~400 lines of playbook + slash commands. The
agent does the work interactively. No code to maintain. No tests needed
for a document. No rendered output committed to the repo.
