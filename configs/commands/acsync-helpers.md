---
description: Sync helper scripts from the agents repo into the current working repo.
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash]
---

# /zz-sync-agent-helpers — Helper Script Sync

READ ~/Repos/acsync/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Copy helper scripts from `~/Repos/acsync/scripts/` into the current
working repo's `scripts/` directory. Helpers must be byte-identical across
repos. This command ensures that.

## Available Helpers

| Script | Description |
|--------|-------------|
| `committer` | Safe git commit helper — stages only listed paths, lock recovery |
| `generate-docs.py` | Walks `docs/`, prints catalog with frontmatter summary |
| `browser-tools.ts` | Chrome DevTools CLI — start/nav/eval/screenshot/pick/cookies/inspect/kill |

## Procedure

### Step 1: Detect Context

1. Identify the current working directory (the repo you are operating in).
2. Verify it is a git repo (`git rev-parse --git-dir`). If not, stop:
   "This command must be run from within a git repository."
3. Check if `scripts/` directory exists. If not, ask:
   "No `scripts/` directory found. Create it?"

### Step 2: Compare Each Helper

For each helper in the table above:

1. Read the canonical version from `~/Repos/acsync/scripts/{helper}`.
2. Read the local version from `{cwd}/scripts/{helper}` (if it exists).
3. Compare:
   - **Missing locally**: Show "New helper — will be copied."
   - **Identical**: Show "Already in sync." Skip.
   - **Different**: Show unified diff between canonical and local.

Present a summary:
```
Helper              Status
committer           differs (12 lines changed)
generate-docs.py    in sync
browser-tools.ts    missing locally
```

### Step 3: Confirm and Copy

For each helper that differs or is missing:
- Show the diff (or note it's new)
- Ask: "Sync this helper?" with options:
  - **Yes** — copy the canonical version
  - **Skip** — leave as-is
  - **Show full diff** — show the complete diff, then ask again

### Step 4: Summary

```
Synced: committer, browser-tools.ts
Skipped: none
Already in sync: generate-docs.py
```

## Guardrails

- **Source of truth**: `~/Repos/acsync/scripts/` is always canonical.
  This command only copies FROM agents TO the current repo. Never the
  reverse.
- **No partial edits**: Helpers are copied whole. No merging or patching.
- **Confirm each file**: Never batch-copy without showing diffs.
