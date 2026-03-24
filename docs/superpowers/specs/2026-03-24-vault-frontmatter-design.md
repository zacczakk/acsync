# Vault Frontmatter Schema Design

**Date:** 2026-03-24
**Status:** Draft
**Scope:** Knowledge vault (new schema) + Memory vault (schema redesign)

## Context

The Knowledge vault (~198 .md files) has no frontmatter. All metadata lives in body text: dates in task lines, parent links as `See also: [[parent]]`, URLs inline. Discoverability is limited to grep and folder position.

The Memory vault (154 .md files) has near-universal frontmatter but with accumulated issues: dead fields (`depends-on:` 97% empty, `date:` duplicates `created:`, `branch:` zero usage), ambiguous `related:` serving double duty as parent + lateral links, type-echo tags, and 23 files missing summaries.

## Decision

Two distinct schemas. Knowledge is human-facing (readability, Dataview queries, hierarchy). Memory is agent-facing (machine parseability, fast scanning, autonomous navigation).

Full migration of both vaults. No forward-only half-measures.

## Knowledge Vault Schema

### Core Fields (all notes)

```yaml
---
type: project | backlog | doc | knowledge | note | person | org | index | query | report
parent: "[[parent-note]]"
created: YYYY-MM-DD
modified: YYYY-MM-DD
summary: "15-25 word plain-text summary"
tags: []
---
```

| Field | Required | Purpose |
|-------|----------|---------|
| `type` | Yes | Content classification. Survives folder moves. |
| `parent` | Yes (except Home.md) | Upward tree link. Replaces body-text `See also:`. Single wikilink. |
| `created` | Yes | Note creation date. Derived from git log or task dates during migration. |
| `modified` | No | Last meaningful edit. Omit if same as `created`. Enables stale detection. |
| `summary` | Yes (leaf notes) | One-line plain text, 15-25 words. Powers grep scanning and Dataview tables. Optional for index, query, and report notes. |
| `tags` | Yes | Domain topics only. No structural tags. Project tags (#project, #metronome) stay. |

### Type-Specific Extensions

**backlog + knowledge** (evaluation notes):

```yaml
source: "https://..."
```

`source` captures the origin URL (tweet, repo, article). Promoted from body text.

**project** (03_active, 04_archive):

```yaml
status: active | paused | archived
repo: "https://github.com/..."
```

**person** (08_people/ppl/):

```yaml
role: "Job title or relationship"
org: "[[org-node]]"
```

**org** (08_people/org/): No extras. `parent:` links up the org tree.

**query** (00_system/queries/): `summary` and `modified` optional. Infrastructure files.

**report** (00_system/grooming-reports/): `summary` optional. Dated filenames provide ordering.

### Type-to-Folder Mapping

| Folder | Type |
|--------|------|
| 01_inbox | `backlog` (pre-triaged items get typed on creation) |
| 02_backlog | `backlog` |
| 03_active | `project` |
| 04_archive | `project` (status: archived) |
| 05_notes | `note` |
| 06_docs | `doc` |
| 07_knowledge | `knowledge` |
| 08_people/ppl | `person` |
| 08_people/org | `org` |
| 00_system/queries | `query` |
| 00_system/grooming-reports | `report` |
| Index/sub-index files | `index` |
| Home.md | `index` (no parent) |

### Convention Changes

- `See also: [[parent]]` body-text lines are **removed**. `parent:` frontmatter is the single source of truth.
- Tags use domain topics only. `#try`, `#personal`, `#project` etc. are domain tags. No `#index`, `#doc`, `#backlog` structural tags.

## Memory Vault Schema (Redesigned)

### Core Fields (all notes)

```yaml
---
type: pattern | tool | project | reference | collection | recap | discovery | decision | checkpoint | dead-end | sync-report
parent: "[[folder-parent-or-collection]]"
summary: "15-25 word plain-text summary"
tags: []
created: YYYY-MM-DD
---
```

| Field | Required | Purpose |
|-------|----------|---------|
| `type` | Yes | Classification. `learning` renamed to `pattern`. `sync-report` added. Session subtypes used directly. |
| `parent` | Yes | Explicit upward tree link. Replaces "first entry of `related:`" convention. Single wikilink. |
| `summary` | Yes | One-line plain text, 15-25 words. Core agent discovery via `rg '^summary:'`. |
| `tags` | Yes | Domain topics only. No type-echo tags (`session`, `collection`, `recap` removed when they duplicate `type:`). |
| `created` | Yes | Creation date. |

### Removed Fields

| Field | Reason |
|-------|--------|
| `depends-on` | 97% empty arrays. 2 actual uses in 154 files. Rare dependencies use `related:`. |
| `date` | Identical to `created:` on all files that had it. Redundant. |
| `branch` | Zero usage across 33 session notes. |

### Optional Fields

| Field | When | Purpose |
|-------|------|---------|
| `updated` | Manual revision | Last meaningful edit date. |
| `related` | Lateral dependencies | 0-2 non-parent wikilinks. No longer carries parent. |
| `status` | patterns, tools, projects | `active \| deprecated \| superseded`. Enables agents to skip stale knowledge. |
| `verified` | patterns, tools | Boolean. Agent-confirmed accuracy. |

### Type-Specific Extensions

**project:**

```yaml
repo: "https://..."
language: python | typescript | swift
framework: ""
status: active | paused | archived
```

**session subtypes** (recap, discovery, decision, checkpoint, dead-end):

```yaml
projects: []
consolidated: false
```

`projects:` formalized from existing practice (used on 33/33 session notes). `consolidated:` is the TTL lifecycle marker.

**collection:**

```yaml
usage: "How agents should use this collection"
```

**Root files** (IDENTITY, SOUL, USER, MEMORY):

```yaml
type: agent-identity | agent-soul | user-profile | agent-memory
```

No `parent:` field (these are roots).

### Key Differences from Current Schema

| Change | Files affected |
|--------|---------------|
| `related:` split into `parent:` + `related:` | ~150 files |
| `depends-on:` dropped | ~61 files (almost all empty `[]`) |
| `date:` dropped | ~34 files |
| `branch:` dropped | 0 (never used) |
| `learning` renamed to `pattern` | Schema text only (files already use `pattern`) |
| Type-echo tags removed | Gradual, on touch |
| `status:` added to patterns/tools | New field, defaults to `active` |
| `projects:` formalized for sessions | Already present, now documented |
| `sync-report` added to type enum | Schema text only (6 files already use it) |
| Summaries added to grooming reports | 18 files |

## Migration Strategy

### Knowledge Vault

**Phase 1 — Automated (script):**
- Extract `created` from git log first-commit date
- Map `type` from folder position
- Map `parent` from existing `See also: [[x]]` lines
- Extract `source` URLs from body text (backlog/knowledge notes)
- Extract `tags` from task lines
- Remove `See also:` lines from body text
- Set `modified` from git log last-commit date (when different from created)

**Phase 2 — Agent-assisted:**
- Generate `summary` for ~198 notes
- Add `status` to project notes
- Add `role`/`org` to person notes
- Handle edge cases (inbox items, empty files)

**Phase 3 — Manual review:**
- Human reviews summaries and tags for quality
- Adjusts misclassified types

### Memory Vault

**Phase 1 — Automated (script):**
- Split `related:` → first entry becomes `parent:`, rest stays as `related:`
- Drop `depends-on:` (move 2 actual values to `related:`)
- Drop `date:` and `branch:` fields
- Add `status: active` to patterns and tools
- Remove type-echo tags

**Phase 2 — Agent-assisted:**
- Add summaries to 23 missing files
- Fix 4 non-standard type values
- Fix dangling `[[tux]]` → `[[throttle-tux]]`

## Dataview Queries Unlocked (Knowledge Vault)

```dataview
TABLE summary, type
FROM ""
WHERE created >= date("2026-03-17")
SORT created DESC
```

```dataview
TABLE status, summary
FROM ""
WHERE type = "project" AND status = "active"
```

```dataview
TABLE summary, created
FROM ""
WHERE type = "backlog" AND contains(tags, "try")
SORT created ASC
```

```dataview
TABLE summary, type
FROM ""
WHERE parent = [[docs]]
SORT file.name ASC
```

```dataview
TABLE summary, modified, type
FROM ""
WHERE modified AND modified < date(today) - dur(30 days)
SORT modified ASC
```

## Side Effects

- AGENTS.md "No frontmatter" rule for Knowledge vault must be updated to document the new schema.
- AGENTS.md Memory vault schema section must be updated.
- Grooming workflow must generate summaries on new reports.
- Agent note-creation workflows must include frontmatter for both vaults.
- Dataview queries in Home.md can be enhanced with frontmatter-based filters.
- 08_people/ folder must be documented in AGENTS.md folder structure.
