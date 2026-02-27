---
description: >-
  Write a session recap to Memory vault (e.g., /obs-recap or /obs-recap
  refactored auth module). Uses session-notes skill conventions.
---

# Recap — End-of-Session Summary

Wrap up the current session as a recap note in `Memory/sessions/`.
Complements atomic notes written during the session via `session-notes` skill.

User input: $ARGUMENTS

## Steps

1. **Gather session context:**
   ```bash
   git log --oneline -20
   git diff --stat HEAD~5..HEAD 2>/dev/null || git diff --stat
   git branch --show-current
   basename $(git rev-parse --show-toplevel 2>/dev/null) 2>/dev/null || basename $(pwd)
   ```

2. **Derive a short title:**
   - If `$ARGUMENTS` provided: use as title hint.
   - If no arguments: derive from git log + diff.

3. **Derive a kebab-case filename:** `YYYY-MM-DD-{title-slug}.md`

4. **Write recap note** directly to filesystem (backtick safety):
   ```
   Write to: ~/Vaults/Memory/sessions/YYYY-MM-DD-{title-slug}.md
   ```

   Format:
   ```markdown
   ---
   type: recap
   date: YYYY-MM-DD
   projects: [{repo-name}]
   tags: [session, recap]
   ---

   # {Session Title}

   ## Done
   - {Accomplishments from commits/diffs}

   ## Learned
   - {Technical findings — skip section if none}

   ## Decisions
   - {Design choices — skip section if none}

   ## Open Threads
   - {Unresolved questions, next steps, blockers}

   ## Files Touched
   - `path/to/file` — what changed
   ```

5. **Confirm:** `Session saved → Memory/sessions/YYYY-MM-DD-{title-slug}.md`

## Rules

- Write via filesystem (absolute path `~/Vaults/Memory/sessions/`), not `obsidian create`.
- Skip empty sections entirely.
- Keep total note under 80 lines.
- Frontmatter `projects`: repo name or project slug from MEMORY.md.
- Include `[[wikilinks]]` to related Memory notes where relevant.
- Be concise — future agents should orient in 30 seconds.
