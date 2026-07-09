---
name: obsidian
description: >-
  Obsidian vault conventions, CLI reference, and workflows for managing
  Knowledge and Memory vaults. Load this skill when executing /obs-* commands,
  reading/writing vault notes, or triaging inbox items.
metadata:
  author: zacczakk
  version: 1.0.0
---

# Obsidian Vault Skill

Background knowledge for agents working with the owner's two Obsidian vaults. This skill provides conventions, CLI reference, and gotchas — individual `/obs-*` commands handle specific workflows.

READ `~/Vaults/AGENTS.md` before anything else.

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
    {descriptive-name}.md  # Flat — one file per learning
```

## Conventions

- **No frontmatter.** Folder position conveys type.
- **Descriptive kebab-case filenames.** No date prefixes.
- **Link related notes.** Use `[[wikilinks]]` across both vaults.
- **`06_docs/` style:** commands and config only. No tips, troubleshooting, or "related notes" sections.
- **Every backlog note** must have at least one `- [ ]` task line.
