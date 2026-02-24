---
description: "Search agent memory for past learnings (e.g., /obs-recall vault structure decisions)"
---

# Recall — Read from Agent Memory

Search the Memory vault for past learnings, decisions, and context from previous sessions.

User input: $ARGUMENTS

## Steps

1. **Get the query:**
   - If `$ARGUMENTS` provided: use it as the search query.
   - If no arguments: ask "What are you trying to remember?"

2. **Search memory:**
   - List all files: `obsidian vault=Memory files`
   - Search by content: `obsidian vault=Memory search query="{query}"`
   - For line context: `obsidian vault=Memory search:context query="{query}"`

3. **Read matching files:** `obsidian vault=Memory read path="{match}.md"` for each hit.

4. **Return a semantic summary:**
   - Don't dump raw file content. Summarize what's relevant to the query.
   - Cite the source file: `(from [[{filename}]])`
   - If multiple notes match, synthesize across them.

5. **Handle no results:**
   - "No memory notes match '{query}'. Agent memory is empty on this topic."

## Rules

- Search the Memory vault only — not the Knowledge vault.
- Always include `vault=Memory` in every `obsidian` command.
- Use `obsidian` CLI for all operations (files, search, read).
- Return semantic summaries, not raw dumps.
- If multiple notes are relevant, synthesize — don't list separately unless they cover distinct topics.
