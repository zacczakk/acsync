# Memory Retrieval Skill Design

**Date:** 2026-04-22
**Status:** Draft
**Scope:** One custom retrieval skill for Knowledge/Memory/qmd/sessions lookup

## Context

Metronome already has the raw pieces for vault and session lookup:

1. `configs/instructions/AGENTS.md` tells agents to check Memory vault first.
2. `configs/instructions/TOOLS.md` documents `obsidian`, `qmd`, and `sessions` commands.
3. Existing skills cover vault structure and write workflows:
   - `obsidian-cli`
   - `obsidian-vault-conventions`
   - `session-notes`

What is missing is a retrieval skill that routes agents to the right source first:

1. user-authored durable reference in Knowledge
2. agent-managed operational context in Memory
3. session history only when both vaults miss

The skill should still bias hard toward Memory for codebase exploration, bulk file reads, and repo-context questions.

## Decision

Add one custom skill named `memory-retrieval` in `configs/skills/memory-retrieval/SKILL.md`.

This skill is retrieval-only. It does not cover note creation, editing, movement, or vault conventions beyond what is necessary to find the right source.

## Goals

1. Route agents to Knowledge vs Memory based on information type.
2. Make agents strongly prefer Memory lookup before open-ended repo exploration.
3. Keep user-authored Knowledge more authoritative for durable reference.
4. Prevent premature session-history lookup.
5. Reduce blind file reads and broad grep passes when context likely already exists.
6. Reuse existing command/docs coverage instead of duplicating full CLI manuals.

## Non-Goals

1. Defining note creation or editing workflows.
2. Re-documenting full `obsidian`, `qmd`, or `sessions` CLI references.
3. Changing current vault conventions.
4. Replacing `obsidian-cli` or `obsidian-vault-conventions`.
5. Updating unrelated stale docs in this change.

## Retrieval Routing

The skill will use source-first routing, not one global priority ladder.

### 1. Choose the source first

1. **Knowledge first** when the user likely authored or curated the information.
   - docs
   - setup/config reference
   - backlog/reference notes
   - personal reference material
   - durable guidance that should outrank agent notes
2. **Memory first** when the question is agent operational context.
   - codebase exploration
   - repo context
   - prior implementation decisions
   - existing patterns
   - recent discoveries
   - project/tool learnings written by agents

### 2. Search within the chosen source

1. use `obsidian ... search:context` for exact terms and nearby context
2. use `qmd query` for semantic/fuzzy recall

### 3. Escalate only after vault lookup misses

1. broader qmd retrieval across collections
2. session history last: `sessions search` then `sessions find`

Pure session lookup remains last priority because session history is noisier, less curated, and more expensive to search than either vault.

## Triggering

### Skill name

`memory-retrieval`

The name keeps the desired activation bias for coding work, but the skill body will explicitly route to Knowledge first when the question is user-authored durable reference.

### Description intent

The description should optimize for activation during codebase exploration and factual lookup. It should strongly signal that the skill applies before reading many files.

Draft description:

> Use when exploring a codebase or answering questions that may already be captured in Knowledge, Memory, qmd, or session history. Use before broad repo search, before reading many files, and before asking the user about prior decisions, existing patterns, setup, reference material, or repo context.

### Trigger phrases to include in body text

- explore a codebase
- how does this work
- prior decisions
- existing patterns
- repo context
- vault lookup
- Memory first
- session history

## Skill Structure

The skill should stay concise and decision-oriented.

Planned sections:

1. Overview
2. When to use
3. Source selection and escalation
4. Tool choice table
5. Minimal command patterns
6. Common mistakes

## Core Guidance

### Overview

State the governing rule clearly:

- choose the right source first
- search before reading
- curated vault notes before raw transcripts

### When to use

Explicitly tell agents to load this skill:

1. before open-ended codebase exploration
2. before reading many files to learn how something works
3. before asking the user about prior decisions likely already captured
4. before using sessions history for repository knowledge

### Source selection rule

The skill should teach this decision split plainly:

1. **Knowledge first** for user-authored durable truth.
2. **Memory first** for agent-managed operational context.
3. **For codebase exploration, bias to Memory.**
4. **For general reference lookup, bias to Knowledge.**

### Tool choice table

The skill should include a compact table like this:

| Need | Tool |
|------|------|
| User-authored docs/setup/reference | `obsidian vault=Knowledge search:context query="..."` |
| Exact keyword in Memory note | `obsidian vault=Memory search:context query="..."` |
| Curated fuzzy recall about repo/tool/pattern | `qmd query "..." -c memory` |
| Broader semantic recall across indexed vault content | `qmd query "..."` |
| Exact phrase from old sessions | `sessions search "..."` |
| Fuzzy historical session recall | `sessions find "..."` |

### Minimal command patterns

The skill should provide only the most important examples:

```bash
# Memory first: best default for codebase exploration
qmd query "how does auth work" -c memory

# Exact lookup in Memory
obsidian vault=Memory search:context query="auth middleware"

# Knowledge first for docs/setup/reference
obsidian vault=Knowledge search:context query="Claude config"

# Only after vault lookup misses
sessions search "auth middleware"
sessions find "how did we handle auth errors"
```

### Read discipline

After a search hit:

1. read only the winning note(s) or indexed file(s)
2. avoid broad folder dumps
3. avoid bulk file reads until vault context proves insufficient

## Anti-Patterns

The skill should explicitly forbid these:

1. Jumping straight to `sessions search` for repo understanding.
2. Reading many repo files before checking Memory for repo context.
3. Ignoring Knowledge when the likely source is user-authored reference.
4. Using qmd cross-collection search first when `-c memory` is enough.
5. Treating raw session transcripts as more authoritative than curated Memory notes.

## Implementation Scope

Expected file touches:

1. `configs/skills/memory-retrieval/SKILL.md`
2. `configs/skills/REGISTRY.md`
3. `docs/skills.md`

Optional only if needed by local tooling:

4. `configs/skills/registry.json`

## Acceptance Criteria

The design is complete when all are true:

1. A new agent reading the skill routes to Knowledge or Memory based on information type.
2. Codebase exploration is strongly biased toward Memory.
3. User-authored durable reference is strongly biased toward Knowledge.
4. Sessions are clearly documented as last-resort historical recall.
5. The skill stays retrieval-only.
6. The guidance is concise and non-duplicative with existing CLI/vault skills.
7. Trigger wording is broad enough to activate during codebase exploration and factual lookup.
