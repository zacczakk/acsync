---
name: memory-retrieval
description: >-
  Use when exploring a codebase or answering questions that may already be
  captured in Knowledge, Memory, qmd, or session history. Use before broad repo
  search, before reading many files, and before asking the user about prior
  decisions, existing patterns, setup, reference material, or repo context.
---

# Memory Retrieval

Route to the right source first. Search before reading. Curated vault notes before raw transcripts.

## When to Use

Use this skill:

1. before open-ended codebase exploration
2. before reading many files to learn how something works
3. before asking the user about prior decisions, setup, or reference material
4. before using session history for repository knowledge

## Source Selection

### Knowledge first

Use `Knowledge` first for user-authored durable truth:

- docs
- setup/config reference
- backlog/reference notes
- personal reference material
- durable guidance that should outrank agent notes

### Memory first

Use `Memory` first for agent-managed operational context:

- codebase exploration
- repo context
- prior implementation decisions
- existing patterns
- recent discoveries
- project/tool learnings written by agents

**Bias rule:**

- Codebase exploration -> Memory first
- General reference lookup -> Knowledge first

## Retrieval Order

1. Choose the source: Knowledge or Memory.
2. Search inside that source.
3. Escalate only if the vault lookup misses.
4. Session history last.

## Tool Choice

| Need | Tool |
|------|------|
| User-authored docs/setup/reference | `obsidian vault=Knowledge search:context query="..."` |
| Exact keyword in Memory note | `obsidian vault=Memory search:context query="..."` |
| Curated fuzzy recall about repo/tool/pattern | `qmd query "..." -c memory` |
| Broader semantic recall across indexed vault content | `qmd query "..."` |
| Exact phrase from old sessions | `sessions search "..."` |
| Fuzzy historical session recall | `sessions find "..."` |

## Command Patterns

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

After a search hit:

1. read only the winning note or file
2. avoid broad folder dumps
3. avoid bulk file reads until vault context proves insufficient

## Common Mistakes

- jumping straight to `sessions search` for repo understanding
- reading many repo files before checking Memory for repo context
- ignoring Knowledge when the likely source is user-authored reference
- using cross-collection `qmd query` first when `-c memory` is enough
- treating raw session transcripts as more authoritative than curated vault notes
