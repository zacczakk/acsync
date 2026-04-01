---
name: obsidian-vault-conventions
description: >-
  Vault layout, folder lifecycle, naming conventions, and agent behaviors for
  the Knowledge and Memory vaults. Load this skill when executing /obs-*
  commands, reading/writing vault notes, or triaging inbox items.
metadata:
  author: zacczakk
  version: 4.0.0
---

# Obsidian Vault Conventions

Background knowledge for agents working with the owner's two Obsidian vaults. This skill provides vault layout, folder lifecycle, naming/formatting conventions, automatic agent behaviors, and gotchas. Individual `/obs-*` commands handle specific workflows.

**READ `~/Vaults/AGENTS.md` before anything else.** It is the canonical reference. This skill covers the key invariants and agent-specific behaviors; AGENTS.md has the full detail.

## Vault Layout

Two vaults, symlinked under `~/Vaults/`:

| Vault | Purpose | CLI target |
|-------|---------|------------|
| **Knowledge** | Personal notes, projects, technical docs, backlog | `vault=Knowledge` |
| **Memory** | Agent operational memory — learnings, context, decisions | `vault=Memory` |

```
~/Vaults/
  Knowledge/
    Home.md              # Dashboard (Dataview + Tasks queries)
    00_system/           # Attachments, scripts, query notes, tree-health dashboard
      queries/           # Dataview + Tasks embed notes (tree-health.md, tasks-all.md, …)
      grooming-reports/  # Nightly grooming reports
        reports.md       # Index of all grooming reports
    01_inbox/            # Web clipper captures, raw thoughts
    02_backlog/          # Triaged items with - [ ] tasks
      backlog.md         # Folder index
    03_active/           # One .md per active project
      projects.md        # Folder index
    04_archive/          # Completed projects
    05_notes/            # Personal (career, life, reflections)
    06_docs/             # Technical docs (setup, configs, how-tos)
      docs.md            # Folder index
    07_knowledge/        # Consumed material (finished reads, done #try items)
      knowledge.md       # Folder index
    08_people/           # Org chart and key contacts
      people.md          # Folder index
      org/               # Org chart nodes (type: org)
      ppl/               # Individual person notes (type: person)
  Memory/
    MEMORY.md            # Hub: links only to 5 folder parents
    projects/            # Per-repo learnings, project overviews
    tools/               # CLI/tool operational knowledge
    patterns/            # Reusable implementation patterns
    sessions/            # Session recaps (YYYY-MM-DD-{title}.md)
    system/              # Vault metadata, grooming/consolidation reports
```

## Folder Lifecycle — Knowledge

| Folder | In | Out |
|--------|----|-----|
| `01_inbox` | Web clipper URLs, raw captures | Triage → `02_backlog` |
| `02_backlog` | Enriched notes with `- [ ]` tasks | Done → `07_knowledge`; escalate → `03_active` |
| `03_active` | One .md per project with inline tasks | Done → `04_archive` |
| `04_archive` | Completed projects | Stays (reference) |
| `05_notes` | Personal notes | Updated in place |
| `06_docs` | System setup, tool configs, how-tos | Updated in place |
| `07_knowledge` | Completed reads, finished `#try` items | Stays (reference) |
| `08_people` | Org chart and contacts | Updated in place |

## Conventions — Knowledge Vault

- **Frontmatter required.** Every note must have YAML frontmatter (see schema below). Dataview queries in `00_system/queries/tree-health.md` depend on it.
- **Descriptive kebab-case filenames.** No date prefixes (except grooming reports).
- **Tree-graph linking.** Every leaf declares `parent:` pointing to its nearest sub-index or folder index. No sibling links. No bidirectional links.
- **`06_docs/` style:** commands and config only. No tips, troubleshooting, or "related notes" sections.
- **Every backlog note** must have at least one `- [ ]` task line.
- **Task tags** — auto-detect from content:
  - `#try` — URL articles, tools, things to evaluate. Noun-only, no verbs.
  - `#personal` — life, admin, career. Brief noun-phrase; verb ok if non-obvious.
  - `#project`, `#project`, etc. — project-specific items.
- **Task line style: telegraph.** Short, no grammar, tool/method name first.

### Knowledge Vault Frontmatter Schema

```yaml
---
type: project | backlog | doc | knowledge | note | person | org | index | query | report
parent: "[[parent-note]]"
created: YYYY-MM-DD
modified: YYYY-MM-DD     # optional — only when manually revised
summary: "15-25 word plain-text summary"
tags: []
---
```

| Field | Required | Notes |
|-------|----------|-------|
| `type` | Yes | Determines folder. See values above. |
| `parent` | Yes | Wikilink to nearest index or sub-index. |
| `created` | Yes | Creation date. |
| `modified` | No | Omit if unchanged since creation. |
| `summary` | Mostly | 15-25 words. Optional for `index`, `query`, `report`. |
| `tags` | No | Domain topic tags. |

Type-specific extra fields:

| Type | Extra fields |
|------|-------------|
| `backlog` | `source: {url}` — origin URL if clipped from web |
| `knowledge` | `source: {url}` — origin URL of consumed material |
| `project` | `status: active \| archived`, `repo: {url}` |
| `person` | `role:`, `reports-to: "[[manager]]"`, `department: {code}`, `projects: ["[[project]]"]` |
| `org` | `sector: "[[sector-node]]"` — omit on sector-level nodes |

### Tree-Graph Rules

- **Hierarchy:** `Home.md` → folder indexes → sub-indexes → leaf notes.
- **Sub-index lifecycle:** Create when 3+ unparented leaves cluster around a theme. Dissolve when fewer than 3 children remain (reparent children to folder index, delete the sub-index).
- **Max fanout:** No parent/index may have more than 10 direct children. Cluster into sub-indexes when exceeded. **Exempt:** `08_people/` notes, dated report indexes (`grooming-reports/`, `consolidation-reports/`), `sessions.md`.
- **`tree-health.md`** (`00_system/queries/tree-health.md`) is a live Dataview dashboard that surfaces fanout violations, orphan notes (missing `parent:`), dissolution candidates, and missing summaries. Check it when grooming.

### `08_people/` Hierarchy

```
people.md (index)
  └── Sector nodes (Healthcare, Life Science, Electronics, Enabling Functions)
        └── Department org nodes  (type: org, sector: "[[sector]]")
              └── Person notes     (type: person)
```

- Sector nodes: `parent: "[[people]]"`, no `sector:` field (they ARE the sector).
- Department nodes: `parent:` → sector or parent dept; `sector:` → top-level sector node.
- Person notes: `parent:` → department org node; `department:` short code (e.g. `EF-ST-G`); `reports-to:`; `projects:` wikilinks.
- External contacts (e.g. Palantir): `parent: "[[people]]"` directly.
- **Fanout exempt:** `08_people/` is explicitly exempt from the ≤10 rule.

## Conventions — Memory Vault

- **Frontmatter required.** Every note must have YAML frontmatter (see schema below).
- **`parent:` is required.** Every leaf points to its folder parent or collection note.
- **Descriptive kebab-case filenames.** Session notes use `YYYY-MM-DD-{title}.md` prefix.
- **Filesystem writes for code content.** Shell eats backticks in `obsidian create`. Write directly to `~/Vaults/Memory/{folder}/{name}.md` for notes with inline code.
- **Distill, don't transcribe.** Future agents should get the point in 30 seconds.
- **One note per topic.** Multiple unrelated learnings = multiple files.
- **No body wikilinks between leaves.** Only parent/collection notes link down to children. Leaf body text: plain references, no `[[wikilinks]]`.
- **No dangling wikilinks.** Every `[[wikilink]]` must resolve to an existing note.
- **Summary-first lookup.** Scan `summary:` fields before reading full notes: `rg '^summary:.*topic' ~/Vaults/Memory/ --glob '*.md' -i`

### Memory Vault Frontmatter Schema

```yaml
---
type: pattern | tool | project | reference | collection | recap | discovery | decision | checkpoint | dead-end | sync-report
parent: "[[folder-parent-or-collection]]"
summary: "15-25 word plain-text summary"
tags: []
created: YYYY-MM-DD
updated: YYYY-MM-DD      # optional — only when manually revised
related: []              # 0-2 lateral wikilinks only (no parent here)
---
```

Key changes from prior schema:
- `learning` → renamed `pattern`
- `session` → subtypes used directly: `recap`, `discovery`, `decision`, `checkpoint`, `dead-end`
- `depends-on:` removed (was near-empty, replaced by `parent:`)
- `parent:` now required (replaces old first-entry-of-`related:` pattern)
- `related:` optional, lateral-only, 0-2 max

Type-specific extra fields:

| Type | Extra fields |
|------|-------------|
| `recap`, `discovery`, etc. | `projects: []`, `consolidated: false` |
| `project` | `repo: {url}`, `language:`, `framework:`, `status: active` |
| `collection` | groups 3+ same-folder leaves under a theme |

Root files (`IDENTITY.md`, `SOUL.md`, `USER.md`, `MEMORY.md`) use their own types and are exempt from `parent:`.

### Memory Vault Folder Scoping

| What belongs | Location |
|-------------|----------|
| Repo-specific learnings | `projects/` |
| CLI/tool operational knowledge | `tools/` |
| Reusable implementation patterns | `patterns/` |
| Session summaries | `sessions/` |
| Vault context, meta | root |

### Collection Lifecycle (Memory)

Same rules as Knowledge sub-indexes: create at 3+ leaves sharing a theme, dissolve below 3 children (reparent to folder parent). Max fanout ≤10. Exempt: `sessions.md`, dated report collections.

## Automatic Behaviors

These apply to any agent using this skill. No explicit command needed.

### On session start

When starting work in a git repo, auto-orient without being asked:

1. Detect repo: `basename $(git rev-parse --show-toplevel 2>/dev/null)`
2. Check for project note: `obsidian vault=Memory files folder=projects`
3. If found, read frontmatter + first sections.
4. Check for recent session note: `obsidian vault=Memory files folder=sessions` — read the most recent one matching this repo.
5. **Stop at 2 reads.** Follow links on-demand only.

### On session end

When the user signals wrap-up ("done", "wrapping up", "that's it", "let's stop") — offer to write a session summary. Don't auto-run; ask first.

If yes, run the `/obs-recap` procedure.

### On component/tool discovery

When you deeply analyze something with non-obvious learnings and no existing Memory note — offer to create one. Example: "Discovered some non-obvious patterns in the auth middleware. Want me to jot that to Memory?"

### On first run

When Memory vault has no subdirectories, guide through creating them. If inside a git repo, offer to run `/obs-analyze`.

## Token Budget Rules

1. **CLI before file reads.** Use `obsidian vault=Memory search` and `files` to target reads. Don't bulk-read.
2. **Session start: at most 2 reads.** Project note + recent session note. Nothing else.
3. **Summary scan before full read.** `rg '^summary:.*topic' ~/Vaults/Memory/ --glob '*.md' -i` before opening any file.
4. **List before read.** `obsidian vault=Memory files folder=projects` before reading individual files.
5. **Follow links on-demand.** Never traverse the full graph.
6. **Write concisely.** Bullet points, links, tags — no prose when bullets suffice.

## CLI Usage

All vault operations go through the `obsidian` CLI. **Always specify `vault=Knowledge` or `vault=Memory` in every call.**

```bash
# Knowledge
obsidian vault=Knowledge search:context query="term"
obsidian vault=Knowledge move path="02_backlog/item.md" to="07_knowledge"
obsidian vault=Knowledge task path="02_backlog/item.md" line=N done

# Memory
obsidian vault=Memory search:context query="topic"
obsidian vault=Memory links file="note-name"
obsidian vault=Memory backlinks file="note-name"
```

Load the `obsidian-cli` skill for full syntax.

## Gotchas

1. **Backticks in `content=` eaten by shell.** For notes with inline code, write directly to filesystem (`~/Vaults/Memory/{folder}/{name}.md`) instead of `obsidian create`.

2. **Always specify vault.** Omitting `vault=` errors or targets the wrong vault.

3. **Both vaults require frontmatter.** Knowledge vault notes require `type`, `parent`, `created`, `summary`. Memory vault notes require `type`, `parent`, `summary`, `created`. The old "no frontmatter in Knowledge" convention is obsolete.

4. **Memory vault: `depends-on:` is removed.** Use `parent:` for upward links and `related:` (0-2 max) for lateral. `depends-on:` in old notes can be migrated to `related:` or dropped.

5. **`06_docs/` is minimal.** Commands and config steps only. No tips, troubleshooting, best practices, or related sections.

6. **Duplicate detection for URLs.** Before creating a backlog note from a URL, search `02_backlog/` first. If it exists, enhance the existing note instead.

7. **`ppl/` person notes use `department:` as structural link.** `parent:` points to their dept org node. Both fields are required for person notes.

## Project Notes — Structure (Knowledge, `03_active/`)

```yaml
---
type: project
parent: "[[projects]]"
created: YYYY-MM-DD
summary: "15-25 word description"
status: active
tags: [project-tag]
---
```

```markdown
# Project Name

One-line description.

## Status

Current phase.

## Tasks

- [ ] First task #tag

## Notes

### YYYY-MM-DD

Chronological entries.
```

## Related Commands

- `/obs-note` — Quick capture to inbox
- `/obs-triage` — Process inbox into backlog
- `/obs-recap` — Write session summary to Memory
- `/obs-analyze` — Scan repo, create project note in Memory
- `/obs-fix-links` — Repair stale parent links after note moves
- `/obs-get-todos` — List open tasks

## Related Skills

| Skill | Load when |
|-------|-----------|
| `obsidian-cli` | Full CLI syntax, common commands, plugin dev |
| `obsidian-markdown` | Writing Obsidian Flavored Markdown (wikilinks, callouts, embeds, etc.) |
| `obsidian-bases` | Creating/editing `.base` files (database views, filters, formulas) |
| `obsidian-json-canvas` | Creating/editing `.canvas` files (visual canvases, flowcharts, mind maps) |
| `obsidian-defuddle` | Extracting clean markdown from web pages (alternative to WebFetch) |
