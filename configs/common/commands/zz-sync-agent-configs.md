---
description: Sync agent configs between this repo and CLI system directories. Interactive, step-by-step.
argument-hint: [push|pull|check]
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---

# /zz-sync-agent-configs — Agent Config Sync

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Interactive, step-by-step sync of agent configurations between this repo
(the canonical source) and four AI coding CLI system directories: Claude Code,
OpenCode, Gemini CLI, and Codex.

This command replaces a Python sync engine with an agent-driven workflow.
You ARE the sync engine. Read the playbook. Follow it precisely. Show diffs.
Ask before every write.

## Playbook

Read `~/Repos/agents/SYNC.md` in full before proceeding. It contains:
- Exact system paths per CLI
- Format transformation rules per CLI
- MCP server rendering specs
- Secret management rules
- Subset merge rules
- Per-CLI specialties

You must follow SYNC.md as your authoritative reference for all
transformations and merge logic.

## Procedure

### Step 1: Initialize

1. Read `~/Repos/agents/SYNC.md` (the playbook). If missing, stop.
2. Load `~/Repos/agents/.env`. Validate all 4 secret vars are present
   and non-empty: `TAVILY_API_KEY`, `CONTEXT7_API_KEY`,
   `UPTIMIZE_BEDROCK_API_KEY`, `PALANTIR_FOUNDRY_TOKEN`.
   If any are missing, stop and list what's needed.
3. Detect operation from `$ARGUMENTS`:
   - `push` — repo to system
   - `pull` — system to repo
   - `check` — drift detection (read-only)
   - No argument — ask the user which operation to run.

Present: "Ready to run **{operation}** across 4 CLIs. Proceeding step by step."

### Step 2: Inventory

Scan all 4 CLIs and build an inventory of what exists:

For each CLI (Claude, OpenCode, Gemini, Codex):
- Count commands in system dir vs canonical
- Count agents in system dir vs canonical
- Count skills in system dir vs canonical
- Check instruction addendum against canonical
- Check MCP server entries in system config vs canonical
- Note any system-only items (not in canonical)

Present an inventory table:
```
CLI          Commands   Agents   Skills   Instructions   MCP Servers
Claude       17/17      8/8      5 (3*)   1/1            5/5
OpenCode     17/17      8/8      2/2      1/1            4/4
Gemini       17/17      8/8      2/2      1/1            2/2
Codex        17/17      8/8      2/2      1/1            1/1

* = includes non-canonical items (e.g., ralph-tui skills in Claude)
```

Ask: "Proceed with {operation} for all CLIs, or select specific CLIs?"
Options: All CLIs / Select specific CLIs

### Step 3: Process Each CLI

For each selected CLI, process sequentially:

**Announce**: "Processing **{CLI name}**..."

#### 3a. Commands

Compare canonical commands against system directory.

For **push**: Render each canonical command to CLI-specific format (see
SYNC.md section 2.1). Compare rendered output to system file.

For **pull**: Read each system command. Reverse-transform to canonical
format. Compare to canonical file.

For each changed file:
- Show the filename and change type (added/modified/deleted)
- Show a unified diff (contextual, not the full file)
- Ask: "Apply this change?" with options:
  - **Yes** — apply this change
  - **Skip** — skip this file
  - **Show full diff** — show the complete file diff, then ask again

After all commands for this CLI:
- Summarize: "Commands: {N} applied, {M} skipped, {K} unchanged"

#### 3b. Agents

Same pattern as commands. Render/reverse per SYNC.md section 2.2.

#### 3c. Skills

Compare skill directories. Skills are copied verbatim (no transformation).

Check skill-MCP dependencies per SYNC.md section 2.3:
- If a skill references an MCP server that is `disabled_for` this CLI,
  warn: "Skill '{name}' depends on MCP server '{server}' which is disabled
  for {CLI}. Force-enable it?"

#### 3d. Instruction Addendums

Build rendered instruction files by concatenating `AGENTS.md` + CLI addendum
per SYNC.md section 2.4.

System locations:
- Claude: `~/.claude/CLAUDE.md`
- OpenCode: `~/.config/opencode/OPENCODE.md`
- Gemini: `~/.gemini/GEMINI.md`
- Codex: `~/.codex/AGENTS.md`

For **push**: Read `~/Repos/agents/AGENTS.md` and the canonical addendum
(`configs/common/instructions/{cli}.md`). Concatenate with `"\n\n"` separator.
Write the combined result to the system instruction file.
Show diff of rendered output vs current system file; ask before each write.

For **pull**: Read the system instruction file. Split at the CLI addendum
header (e.g., `# Claude Code Addendum`). Diff each portion independently
against `AGENTS.md` and the canonical addendum. Show diffs; ask before
writing back to repo.

#### 3e. MCP Servers

Render canonical MCP definitions to CLI-specific format per SYNC.md
section 2.5. This involves subset-merging into the system config file.

Show the full rendered MCP block for this CLI.
Show a diff against the current MCP entries in the system config.
Ask: "Apply MCP changes for {CLI}?"

For push: inject secrets from `.env` before writing.
For pull: redact secrets before showing/writing.

#### 3f. Settings

For CLIs with canonical settings files (see SYNC.md section 5):
- Claude `settings.json` vs `configs/common/settings/claude.json`
- OpenCode `opencode.json` vs `configs/common/settings/opencode.json`

For **push**: Render canonical settings (secrets injected, `~` expanded),
deep-merge or wholesale-replace managed keys into system file.

For **pull**: Extract managed keys from system file, redact secrets,
collapse `~` paths, diff against canonical settings file.

Ask before each settings file write.

### Step 4: Backup

Before writing any files (first time a "Yes" is confirmed in step 3):

1. Create `backups/{timestamp}/` in the repo directory.
2. Copy all affected system files to the backup directory, preserving
   CLI subdirectory structure:
   ```
   backups/2026-02-17T143000/
      claude/
        commands/zz/gate.md
        ...
      opencode/
        command/zz-gate.md
       ...
   ```
3. Confirm: "Backed up {N} files to backups/{timestamp}/. Proceeding."

Note: The backup step runs once, before the first write. Subsequent
writes in the same session do not create additional backups.

### Step 5: Apply

For each confirmed change from step 3:

1. **Write** the file to the system directory (push) or repo (pull).
2. **Verify**: Read the file back and confirm it matches expected content.
   For push: verify secrets are injected (no `${VAR}` remaining).
   For pull: verify secrets are redacted (no real values present).
3. If verification fails, stop and report the discrepancy.

### Step 6: Summary

After all CLIs are processed, present a final summary:

```
Sync Complete: push

CLI          Commands   Agents   Skills   Instrs   MCP      Settings
Claude       2 updated  0        0        0        1 updated 0
OpenCode     2 updated  1 added  0        0        1 updated 0
Gemini       2 updated  0        0        0        0         0
Codex        2 updated  0        0        0        0         0

Skipped: 1 file (opencode/command/zz-discuss.md)
Backed up to: backups/2026-02-17T143000/
```

Offer next step:
- After push: "Run `/zz-sync-agent-configs check` to verify no remaining drift."
- After pull: "Review the repo changes with `git diff`, then commit."
- After check: "Run `/zz-sync-agent-configs push` to apply fixes." (if drift found)
  or "All CLIs in sync." (if no drift)

## Guardrails

- **Never touch GSD files**: Skip `gsd-*` prefixed files, `gsd/` dirs,
  `.sync-manifest.json`, `.gsd-file-manifest.json`.
- **Never commit secrets**: After pull, always verify no real values in repo.
- **One file at a time**: Show diff and confirm before each write.
- **Backup first**: Always backup before the first write.
- **Preserve user config**: Only modify managed keys in subset-merged files.
  Never touch user-owned keys.
- **Scope redirect**: If the user asks to change something outside sync scope
  (e.g., "also update my model"), note it as out of scope and continue:
  "That's outside config sync scope. You can change it directly in
  {config file}. Back to sync: {current item}."
