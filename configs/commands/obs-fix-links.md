---
description: >-
  Fix stale parent links after manually moving notes between folders (e.g.,
  /obs-fix-links or /obs-fix-links knowledge)
---

# Fix Links — Repair Stale Parent Links

Scan vaults for notes whose parent link doesn't match their current folder. Fixes in place.

Use after manually moving notes (backlog → knowledge, backlog → active, etc.) or anytime the graph looks off.

User input: $ARGUMENTS

## Dispatch

| Argument | Scope |
|----------|-------|
| _(empty)_ | Both vaults |
| `knowledge` | Knowledge vault only |
| `memory` | Memory vault only |

## Steps

### 1. Knowledge vault

For each content folder (`02_backlog/`, `03_active/`, `06_docs/`, `07_knowledge/`):

a. List all notes: `obsidian vault=Knowledge files folder={folder}`

b. For each note (skip index and sub-index files):
   1. Read the note — find the `See also:` line.
   2. Determine the **correct parent** for this folder:
      - `02_backlog/` → `[[backlog]]`
      - `03_active/` → `[[projects]]`
      - `06_docs/` → check sub-indexes (`terminal-shell`, `python`, `agent-obsidian`). If the note is listed in a sub-index, parent = that sub-index. Otherwise parent = `[[docs]]`.
      - `07_knowledge/` → check sub-indexes (`agent-memory`, `agent-skills`, `document-processing`, `frontend-design`). If listed in a sub-index, parent = that sub-index. Otherwise parent = `[[knowledge]]`.
   3. If `See also:` is missing or points to the wrong parent → fix it.
   4. If `See also:` is correct → skip.

c. Validate index/sub-index listings:
   1. Read each index and sub-index note.
   2. For each `[[wikilink]]` in the listing, verify the target note exists in the expected folder.
   3. Remove entries for notes that moved away or were deleted.
   4. Add entries for notes present in the folder but missing from the listing.

### 2. Memory vault

For each folder (`tools/`, `patterns/`, `projects/`, `sessions/`, `system/`):

a. List all notes (filesystem read, not CLI — backtick safety).

b. For each leaf note (skip folder parents and collection notes):
   1. Read frontmatter `related:` field.
   2. Determine the **correct parent**:
      - `tools/` → `[[tools]]` or a same-folder collection if the note belongs to one
      - `patterns/` → `[[patterns]]`
      - `projects/` → `[[projects]]`
      - `sessions/` → `[[sessions]]`
      - `system/` → `[[obsidian-vault-system]]`
      - `system/grooming-reports/` → `[[reports]]`
   3. If `related:` first entry doesn't match the correct parent → fix it. Keep entries 2-3 if still valid (max 3 total).
   4. If `related:` is missing → add it with the correct parent.

c. Validate folder parent and collection listings:
   1. Read each folder parent and collection note.
   2. Remove entries for notes that moved away or were deleted.
   3. Add entries for notes in the folder but missing from the listing.

### 3. Report

Print a summary:

```
Fixed {N} stale parent links:
  Knowledge:
  - 07_knowledge/tool-name.md: [[backlog]] → [[knowledge]]
  - ...
  Memory:
  - projects/old-note.md: [[tools]] → [[projects]]
  - ...
Updated {M} index listings:
  - backlog.md: removed tool-name (moved to 07_knowledge/)
  - knowledge.md: added tool-name
  - ...
```

If nothing to fix: "All parent links are current."

## Rules

- Fix parent links only. Do NOT add dependency links, body wikilinks, or new content.
- Knowledge vault: use `obsidian` CLI for reads/writes. No frontmatter.
- Memory vault: use filesystem for writes (backtick safety). Frontmatter required.
- Do NOT delete or move any notes. Only update link metadata.
- Do NOT create new notes. Only fix existing parent references and index listings.
- When fixing `related:` in Memory vault, keep existing valid deps (entries 2-3). Only change the first entry (parent).
- Sub-index membership: a note belongs to a sub-index if the sub-index file lists it. If not listed in any sub-index, parent = folder index.
