---
description: >-
  Search agent memory for past learnings (e.g., /obs-lookup gateway patterns,
  /obs-lookup related mcporter, /obs-lookup type project)
---

# Lookup — Search Agent Memory

Search the Memory vault for past learnings, decisions, and context. Supports targeted subcommands and freetext search.

User input: $ARGUMENTS

## Dispatch

Parse `$ARGUMENTS[0]` to determine subcommand:

| First arg | Subcommand | Remaining args |
|---|---|---|
| `related` | Related notes | `<name>` |
| `project` | Project notes | `<name>` |
| `type` | Notes by type | `<type>` |
| anything else | Freetext search | entire `$ARGUMENTS` |
| _(empty)_ | Ask user | — |

---

### `lookup related <name>`

Find all notes connected to a given note.

1. Search for the note: `obsidian vault=Memory search query="{name}"`
2. If found, get links: `obsidian vault=Memory links file="{matched-name}"`
3. Get backlinks: `obsidian vault=Memory backlinks file="{matched-name}"`
4. Read frontmatter of the matched note for `related:` and `depends-on:` fields.
5. Merge all results. Present as a grouped list: explicit (frontmatter) first, then structural (wikilinks/backlinks).

### `lookup project <name>`

Find notes associated with a project.

1. List files: `obsidian vault=Memory files folder=projects`
2. Fuzzy-match `<name>` against filenames.
3. If a project note exists, read it and follow `related:` links.
4. Also search for wikilinks to the project: `obsidian vault=Memory search query="[[{name}]]"`
5. Present: project overview + list of referencing notes.

### `lookup type <type>`

Find all notes of a given type (project, session, tool, pattern, learning, reference).

1. Search frontmatter: `obsidian vault=Memory search query="type: {type}"`
2. For each match, read first 10 lines (frontmatter + heading) to show a summary.
3. Present as a table: note name, created date, one-line summary.

### `lookup <freetext>`

General search — preserves the old `/obs-recall` semantic synthesis behavior.

1. Search by content: `obsidian vault=Memory search query="{query}"`
2. For context: `obsidian vault=Memory search:context query="{query}"`
3. Read matching files: `obsidian vault=Memory read path="{match}"` for each hit.
4. **Return a semantic summary:**
   - Don't dump raw file content. Summarize what's relevant to the query.
   - Cite the source: `(from [[{filename}]])`
   - If multiple notes match, synthesize across them.
5. If no results: "No memory notes match '{query}'."

---

## Rules

- Search the Memory vault only — not the Knowledge vault.
- Always include `vault=Memory` in every `obsidian` command.
- Use `obsidian` CLI for all search/read operations.
- CLI before file reads. Use search results to target reads — don't bulk-read.
- Return semantic summaries for freetext, structured results for subcommands.
- If multiple notes are relevant to freetext, synthesize — don't list separately unless they cover distinct topics.
