---
name: obsidian-vault-conventions
description: >-
  Vault layout, folder lifecycle, naming conventions, and agent behaviors for
  the Knowledge and Memory vaults. Load this skill when executing /obs-*
  commands, reading/writing vault notes, or triaging inbox items.
metadata:
  author: zacczakk
  version: 3.0.0
---

# Obsidian Vault Conventions

Background knowledge for agents working with the owner's two Obsidian vaults. This skill provides vault layout, folder lifecycle, naming/formatting conventions, automatic agent behaviors, and gotchas. Individual `/obs-*` commands handle specific workflows.

READ `~/Vaults/AGENTS.md` before anything else. If not found, proceed with the conventions below.

## Vault Layout

Two vaults, symlinked under `~/Vaults/`:

| Vault | Purpose | CLI target |
|-------|---------|------------|
| **Knowledge** | Personal notes, projects, technical docs, backlog | `vault=Knowledge` |
| **Memory** | Agent operational memory — learnings, context, decisions | `vault=Memory` |

```
~/Vaults/
  Knowledge/
    00_system/           # Attachments, scripts
    01_inbox/            # Web clipper captures, raw thoughts
    02_backlog/          # Triaged items with - [ ] tasks
    03_active/           # One .md per active project
    04_archive/          # Completed projects
    05_notes/            # Personal (career, life, reflections)
    06_docs/             # Technical docs (setup, configs, how-tos)
    07_knowledge/        # Consumed material (finished reads, done #try items)
    Home.md              # Dashboard (Dataview + Tasks queries)
  Memory/
    projects/            # Per-repo learnings, project overviews
    tools/               # CLI/tool operational knowledge
    patterns/            # Reusable implementation patterns
    sessions/            # Session recaps
    {general}.md         # General learnings at root
```

## Folder Lifecycle — Knowledge

| Folder | In | Out |
|--------|----|-----|
| `01_inbox` | Web clipper URLs, raw captures | Triage -> `02_backlog` |
| `02_backlog` | Enriched notes with `- [ ]` tasks | Done -> `07_knowledge`; or escalate to `03_active` |
| `03_active` | One .md per project with inline tasks | Done -> `04_archive` |
| `04_archive` | Finished projects | Stays (reference) |
| `05_notes` | Personal notes | Updated in place |
| `06_docs` | System setup, tool configs, how-tos | Updated in place |
| `07_knowledge` | Completed reads, finished `#try` items | Stays (reference) |

## Memory Vault — Content Guide

| Knowledge type | Folder | Example |
|---------------|--------|---------|
| Repo-specific learnings | `projects/` | Architecture overview, component maps |
| CLI/tool operational knowledge | `tools/` | MCPorter access tiers, CLI gotchas |
| Reusable implementation patterns | `patterns/` | LLM gateway patterns, retry strategies |
| Session work summaries | `sessions/` | Daily recap with decisions + next steps |
| Vault context, meta knowledge | root | Interaction model, command locations |

## Conventions — Knowledge Vault

- **No frontmatter.** Folder position conveys type. Adding YAML frontmatter breaks Dataview queries. This overrides standard Obsidian Flavored Markdown conventions — agents loading `obsidian-markdown` should not add frontmatter to Knowledge vault notes.
- **Descriptive kebab-case filenames.** No date prefixes.
- **Link related notes.** Use `[[wikilinks]]` across both vaults.
- **`06_docs/` style:** commands and config only. No tips, troubleshooting, or "related notes" sections.
- **Every backlog note** must have at least one `- [ ]` task line.
- **Task tags** — auto-detect from content:
  - `#try` — URL articles, tools, things to evaluate. Noun-only, no verbs.
  - `#personal` — life, admin, career. Brief noun-phrase; verb ok if non-obvious.
  - `#esgenius`, `#linai`, etc. — project-specific items.
- **Task line style: telegraph.** Short, no grammar, tool/method name first.

## Conventions — Memory Vault

- **Frontmatter required.** Every note must have YAML frontmatter (see schema below).
- **Descriptive kebab-case filenames.** Session notes use `YYYY-MM-DD-{title}.md` prefix.
- **Link related notes.** Use `[[wikilinks]]` in body + `related:` and `depends-on:` in frontmatter.
- **Distill, don't transcribe.** Future agents should get the point in 30 seconds.
- **One note per topic.** Multiple unrelated learnings = multiple files.

### Memory Vault Frontmatter Schema

Base schema (all notes):

```yaml
---
type: learning | pattern | tool | project | session | reference
tags: []
created: YYYY-MM-DD
updated: YYYY-MM-DD      # optional — only when note is manually revised
related: []               # wikilinks: ["[[note-name]]"]
depends-on: []            # wikilinks: ["[[note-name]]"]
---
```

Extended fields by type:

| Type | Extra fields |
|------|-------------|
| `session` | `branch: {git-branch}` |
| `project` | `repo: {url}`, `language: {lang}`, `framework: {fw}`, `status: active` |

`related:` captures any connection — other notes, project associations, cross-references. No separate `project:` field; project links go in `related:`.

`depends-on:` captures hard dependencies — things that must exist or be understood first.

Both fields are populated organically by agents during `/obs-jot`, `/obs-analyze`, and `/obs-recap`. No manual maintenance command.

## Automatic Behaviors

These behaviors apply to any agent using this skill. They do not require explicit commands.

### On session start

When starting work in a git repo, auto-orient without being asked:

1. Detect the repo: `basename $(git rev-parse --show-toplevel 2>/dev/null)`
2. Check if a project note exists: `obsidian vault=Memory files folder=projects`
3. If found, read the project note (frontmatter + first sections — enough to orient).
4. Check for recent session notes: `obsidian vault=Memory files folder=sessions` — read the most recent one matching this repo if it exists.
5. **Do not read beyond these 2 notes at session start.** Follow links on-demand.

### On session end

When the user says "done", "wrapping up", "that's it", "let's stop", or similar — offer to write a session summary. Don't auto-run; ask first: "Want me to write a session summary before we wrap up?"

If yes, run the `/obs-recap` procedure.

### On component/tool discovery

When you deeply analyze a component, tool, or pattern that has no Memory vault note — and the analysis revealed non-obvious learnings — offer to create a note. Example: "I discovered some non-obvious patterns in the auth middleware. Want me to jot that to Memory?"

### On first run

When Memory vault has no subdirectories (`projects/`, `tools/`, `sessions/`, `patterns/`), guide the user through creating them. If inside a git repo, offer to run `/obs-analyze`.

## Token Budget Rules

1. **CLI before file reads.** Use `obsidian vault=Memory search` and `obsidian vault=Memory files` to target reads. Don't bulk-read.
2. **Session start: at most 2 reads.** Project note + recent session note. Nothing else.
3. **Heading scan before full read.** Read first 10 lines (frontmatter + heading) before committing to a full read.
4. **List before read.** `obsidian vault=Memory files folder=projects` before reading individual files.
5. **Follow links on-demand.** Never traverse the full graph. Read linked notes only when the current task requires that context.
6. **Write concisely.** Bullet points, links, tags — no prose when bullets suffice.

## CLI Usage

All vault operations go through the `obsidian` CLI. **Always specify `vault=Knowledge` or `vault=Memory` in every call.** Load the `obsidian-cli` skill for full syntax and command reference.

### Vault-specific patterns

These commands are used in vault workflows and may not appear in the generic CLI reference:

```bash
obsidian vault=Knowledge search:context query="term"   # search with surrounding context
obsidian vault=Memory search:context query="topic"
obsidian vault=Memory links file="note-name"            # outgoing links from a note
obsidian vault=Knowledge move path="02_backlog/item.md" to="07_knowledge"
obsidian vault=Knowledge task path="02_backlog/item.md" line=N done
```

## Gotchas

1. **Backticks in `content=` are eaten by the shell.** The `obsidian create` command passes content through the shell, which interprets backticks as command substitution. For notes containing inline code, **write directly to the filesystem** (`~/Vaults/Memory/{folder}/{name}.md`) instead of using `obsidian create`.

2. **Always specify vault.** Omitting `vault=` causes the CLI to error or target the wrong vault.

3. **Knowledge vault: no frontmatter.** Adding YAML frontmatter breaks Dataview queries in the Knowledge vault.

4. **Memory vault: frontmatter required.** Every Memory note must have YAML frontmatter with at minimum `type`, `tags`, `created`, `related`, `depends-on`.

5. **`06_docs/` is minimal.** Commands and config steps only. No use cases, tips, troubleshooting, best practices, or references sections.

6. **Duplicate detection for URLs.** Before creating a backlog note from a URL, search `02_backlog/` for the URL first. If it exists, enhance the existing note instead.

## Project Notes — Structure (Knowledge)

```markdown
# Project Name

One-line description.

## Status

Current phase.

## Tasks

- [ ] First task
- [ ] Second task

## Notes

### YYYY-MM-DD

Chronological entries.
```

## Related Commands

- `/obs-add-note` — Quick capture to inbox
- `/obs-triage-inbox` — Process inbox into backlog
- `/obs-jot` — Distill conversation into Memory note
- `/obs-lookup` — Search agent memory (replaced `/obs-recall`)
- `/obs-recap` — Write session summary to Memory
- `/obs-analyze` — Scan repo, create project note in Memory
- `/obs-get-todos` — List open tasks

## Related Skills

| Skill | Load when |
|-------|-----------|
| `obsidian-cli` | Full CLI syntax, common commands, plugin dev |
| `obsidian-markdown` | Writing Obsidian Flavored Markdown (wikilinks, callouts, embeds, etc.) |
| `obsidian-bases` | Creating/editing `.base` files (database views, filters, formulas) |
| `obsidian-json-canvas` | Creating/editing `.canvas` files (visual canvases, flowcharts, mind maps) |
| `obsidian-defuddle` | Extracting clean markdown from web pages (alternative to WebFetch) |
