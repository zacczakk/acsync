---
description: Show all open tasks across the vault, optionally filtered by project
---

# Get Todos

Print all open tasks to the terminal. Optionally filter to a specific project.

User input: $ARGUMENTS

## Steps

1. **Check for project filter:**
   - If `$ARGUMENTS` is provided, treat it as a project name filter.
   - Match against files in `03_active/` (fuzzy — "esgenius" matches `esgenius.md`).

2. **Retrieve tasks:**
   - **All tasks:** `obsidian vault=Knowledge tasks todo`
   - **Project filter:** `obsidian vault=Knowledge tasks path="03_active/{matched-project}.md"`
   - **Backlog tasks:** also include `obsidian vault=Knowledge tasks path="02_backlog"` unless project-filtered.

3. **Format output** — group by source file:

   ```
   ## {project or file name}
   - [ ] {task text}
   - [ ] {task text}

   ## Backlog
   - [ ] {task text} (from {filename})
   ```

4. **Summary line:** `{N} open tasks across {M} sources`

## Rules

- Terminal output only — do NOT create a file.
- Always include `vault=Knowledge` in every `obsidian` command.
- Use `obsidian vault=Knowledge tasks` CLI — not Grep/Glob.
- Group by source file. Project tasks first, then backlog.
- If no tasks found, say "No open tasks."
- Preserve original task text exactly.
