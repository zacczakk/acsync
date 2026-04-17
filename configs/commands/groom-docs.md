---
description: 'Run the full docs update workflow: discover doc impact from code/config/workflow changes, scan for staleness and dead links, then update or flag the right docs.'
---

# metronome-groom-docs

Run the full repository docs workflow:
- discover documentation impact from code/config/workflow changes
- scan for dead links, stale references, and missing front-matter
- dispatch helper agents from the root session when discovery scope is broad
- update the right docs or report the exact gaps

Use this as the single entrypoint for docs hygiene and docs drift work.

## Scope Decision

Start by checking `git diff`, `git status`, and recent commits.

### Narrow scope

If changed docs are obvious and limited, work directly.

Examples:
- one README tweak
- one setup doc update
- one changelog entry

### Broad or uncertain scope

If docs impact is unclear, or changes span behavior/config/setup/CLI/workflow surfaces, orchestrate discovery from the root session:

- dispatch one `explore` subagent for changed code/config surfaces
- dispatch one `explore` subagent for existing docs likely affected
- synthesize findings into an evidence bundle before editing

Do not assume nested subagent dispatch from inside subagents. Orchestration belongs in the root session.

## Evidence Bundle

Before editing docs, collect:
- changed files and code paths
- changed commands, flags, config, env, or setup
- changed user workflow, operator workflow, or API behavior
- docs likely affected
- changelog or migration-note need
- remaining unknowns

## Discovery

Detect documentation structure:
- `docs/` directory (if exists)
- `AGENTS.md` at repo root
- `docs/plans/active/*/PLAN.md` (if exists)
- `docs/ARCHITECTURE.md`
- Any markdown files in repo root

## Checks

### 1. Internal link resolution

Scan all markdown files for internal links:
- Pattern: `[text](path)` or `[text](../path)`
- Verify target file exists
- Flag broken links

### 2. AGENTS.md references

If `AGENTS.md` exists:
- Extract all file/path references (backtick-wrapped paths)
- Verify each referenced file exists
- Flag missing files

### 3. Stale documentation

For each doc in `docs/`:
- Get last modified timestamp
- Find files it references (code files, other docs)
- If referenced file changed significantly since doc's mtime, flag as potentially stale
- "Significant change" = >100 lines added/removed (use `git log --numstat`)

### 4. Front-matter compliance

If `scripts/docs-list.ts` or `bin/docs-list` exists:
- Run it to check docs/ for front-matter compliance
- Flag docs missing required front-matter
- Note: this is best-effort; skip if not installed

### 5. Dead code references

In `docs/design/` and `docs/plans/`:
- Extract code references (function names, file paths in backticks)
- Search codebase for those references
- Flag if referenced code no longer exists

### 6. Behavior/config/workflow drift

For changed code/config areas:
- map the change to affected docs: `docs/`, README, changelog, setup guides, API docs, migration notes
- verify actual behavior from code, not just from the diff
- note whether the change affects users, operators, or contributors
- note whether changelog or migration guidance is required

## Output

Present a summary table:

```
File                              Issue                    Severity
────                              ─────                    ────────
docs/design/auth-flow.md          Dead link to api.md      ERROR
docs/plans/active/feat-x/PLAN.md  References deleted func  WARN
AGENTS.md                         Points to missing file   ERROR
docs/architecture.md              Stale (code changed)     INFO
```

Severity:
- **ERROR** — broken link, missing file reference
- **WARN** — stale doc, missing front-matter, missing docs coverage
- **INFO** — potential issues, manual review needed

Also include an evidence summary:
- docs reviewed
- docs updated
- stale docs found
- remaining gaps
- evidence used

## Fix workflow

After presenting the table, ask:
> Found N issues. Fix automatically? (y/n)

If yes:
- **Broken links** — offer to remove or replace with placeholder
- **Missing files** — offer to create stub or remove reference
- **Stale docs** — flag for manual review or update directly when the replacement is obvious
- **Front-matter** — run `docs-list` to check compliance
- **Behavior/config/workflow drift** — update the affected docs minimally but completely using the evidence bundle

Batch fixes into a single commit or open individual fixup edits per file.

If no:
- Print list of issues
- Exit

## Notes

- This is a hygiene check, not a blocker. Some warnings are expected.
- Run periodically (weekly or before major releases).
- If `docs/` doesn't exist in current repo, note it and exit cleanly.
- This command is the full docs-update entrypoint. Use it for both hygiene checks and drift from real code/config/workflow changes.
