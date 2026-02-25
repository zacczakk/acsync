---
description: 'Scan docs/ for staleness, dead links, and drift. Reports issues, offers fixes.'
---

# acsync-groom-docs

Scan repository documentation for quality issues: dead links, stale references, missing front-matter, drift from code.

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
- **WARN** — stale doc, missing front-matter
- **INFO** — potential issues, manual review needed

## Fix workflow

After presenting the table, ask:
> Found N issues. Fix automatically? (y/n)

If yes:
- **Broken links** — offer to remove or replace with placeholder
- **Missing files** — offer to create stub or remove reference
- **Stale docs** — flag for manual review (add `<!-- TODO: review after X commit -->`)
- **Front-matter** — run `docs-list` to check compliance

Batch fixes into a single commit or open individual fixup edits per file.

If no:
- Print list of issues
- Exit

## Notes

- This is a hygiene check, not a blocker. Some warnings are expected.
- Run periodically (weekly or before major releases).
- If `docs/` doesn't exist in current repo, note it and exit cleanly.
