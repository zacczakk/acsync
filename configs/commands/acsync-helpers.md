---
description: Sync helper scripts from the acsync repo into the current working repo.
allowed-tools: [Read, Glob, Bash]
---

# /acsync-helpers

Copy helper scripts from `~/Repos/acsync/scripts/` into the current repo's `scripts/` directory. Helpers must be byte-identical across repos.

## Available Helpers

| Script | Description |
|--------|-------------|
| `committer` | Safe git commit — stages only listed paths, lock recovery |
| `generate-docs.py` | Docs catalog with frontmatter summary |
| `browser-tools.ts` | Chrome DevTools CLI (start/nav/eval/screenshot/pick/cookies/inspect/kill) |

## Procedure

### 1. Validate Context

```bash
git rev-parse --git-dir  # Must be a git repo
ls scripts/              # Check if scripts/ exists
```

If no `scripts/` dir, ask: "Create it?"

### 2. Compare

For each helper, diff canonical vs local:

```bash
diff ~/Repos/acsync/scripts/committer scripts/committer
diff ~/Repos/acsync/scripts/generate-docs.py scripts/generate-docs.py
diff ~/Repos/acsync/scripts/browser-tools.ts scripts/browser-tools.ts
```

Present summary table:
```
Helper              Status
committer           differs (12 lines)
generate-docs.py    in sync
browser-tools.ts    missing locally
```

### 3. Sync

For each that differs or is missing — show diff, ask "Sync this helper?", then copy:

```bash
cp ~/Repos/acsync/scripts/{helper} scripts/{helper}
chmod +x scripts/{helper}  # if executable
```

### 4. Summary

```
Synced: committer, browser-tools.ts
Skipped: none
Already in sync: generate-docs.py
```

## Guardrails

- Source of truth: `~/Repos/acsync/scripts/`. One-way copy only — never reverse.
- Whole-file copy. No merging or patching.
- Confirm each file before copying.
