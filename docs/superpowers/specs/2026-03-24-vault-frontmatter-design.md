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
| 01_inbox | `backlog` (pre-triaged items get typed on creation). `parent: "[[backlog]]"` — inbox items are pre-backlog, so they point to the backlog index as their parent. |
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

### Parent Chain Convention

Index notes follow the existing hierarchy upward: leaf → sub-index → folder index → Home.md. Specifically:
- Folder indexes (`docs.md`, `knowledge.md`, `projects.md`, `backlog.md`, `people.md`) have `parent: "[[Home]]"`.
- Sub-indexes (`terminal-shell.md`, `agent-memory.md`, etc.) have `parent: "[[folder-index]]"` (e.g., `parent: "[[docs]]"`).
- Nested sub-indexes (e.g., `claude-code-skills.md` under `agent-skills.md`) point to their containing sub-index.
- Leaf notes point to their immediate parent (sub-index or folder index).
- `Home.md` has no `parent:` field.

### Convention Changes

- `See also: [[parent]]` body-text lines are **removed**. `parent:` frontmatter is the single source of truth.
- Tags use domain topics only. `#try`, `#personal`, `#project` etc. are domain tags. No `#index`, `#doc`, `#backlog` structural tags.

## Memory Vault Schema (Redesigned)

### Core Fields (all notes)

```yaml
---
type: pattern | tool | project | reference | collection | recap | discovery | decision | checkpoint | dead-end | sync-report | agent-identity | agent-soul | user-profile | agent-memory
parent: "[[folder-parent-or-collection]]"
summary: "15-25 word plain-text summary"
tags: []
created: YYYY-MM-DD
---
```

Root-only types (`agent-identity`, `agent-soul`, `user-profile`, `agent-memory`) apply to the 4 root files (IDENTITY, SOUL, USER, MEMORY) and are exempt from `parent:`.

| Field | Required | Purpose |
|-------|----------|---------|
| `type` | Yes | Classification. `learning` renamed to `pattern`. `sync-report` added. Session subtypes used directly. Root files use their own types. |
| `parent` | Yes (except root files) | Explicit upward tree link. Replaces "first entry of `related:`" convention. Single wikilink. |
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

Root-only types documented in the main enum above. No `parent:` field (these are roots). No `status:` field.

**reference:** Existing type used for system notes, grooming reports, and retrieval reports. No type-specific extensions — `reference` notes use only core fields. Unchanged from current schema.

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
- **Do not set `modified` during migration.** Git log dates include trivial commits (bulk reformats, typo fixes) and would produce misleading values. Leave `modified` omitted on all migrated notes; it will be set going forward on meaningful manual edits only.

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
- Split `related:` → first entry becomes `parent:`, rest stays as `related:`. **Validation step:** after extraction, verify each `parent:` resolves to a known folder parent or collection note. Flag mismatches for manual review rather than silently assigning wrong parents. The audit confirmed the "first entry = parent" convention is followed on 151/154 files (3 missing `related:` entirely); no ordering violations were found.
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
- 08_people/ folder must be documented in AGENTS.md folder structure. (Folder already exists with 31 files; just undocumented.)
