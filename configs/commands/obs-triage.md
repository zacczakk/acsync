---
description: >-
  Work through backlog items — read prioritized backlog.md, pick items to
  tackle, execute with deep context gathering
---

# Work Backlog

Read the prioritized `backlog.md`, present items to Phil, and execute on his choices. Loop until Phil stops.

## Context

Read `~/Vaults/AGENTS.md` for current vault conventions before starting.

## Tool Access

The Knowledge vault is at `~/Vaults/Knowledge/`.

- **Vault access:** use filesystem Read/Glob/Grep, apply_patch for writes, and `trash` for confirmed deletes.
- **Never invoke `obsidian`:** the executable launches the Electron app and can disrupt the open instance.
- **Memory vault:** use `rg` for summary-first scans and direct file reads/writes.
- **URL research:** WebFetch, Tavily search, or Tavily extract for deep research on items.

## Steps

### Step 1: Read backlog

Read `~/Vaults/Knowledge/02_backlog/backlog.md` directly.

If `backlog.md` has no `Last triaged:` line or has never been triaged (no Quick Wins / High Impact / Stale / Holding sections), tell Phil: "Backlog hasn't been triaged yet. Run the nightly workflow first, or I can do a quick evaluation now." If Phil says to evaluate, follow the evaluation logic from the nightly `vault-backlog-triage` workflow inline, then continue.

### Step 2: Present shortlists

Display the prioritized sections from `backlog.md` as numbered lists. Keep it scannable:

```
Backlog — last triaged {date}
{N} items: {Q} quick wins, {H} high impact, {S} stale, {K} holding.

Quick Wins:
  1. executor-agent-runtime — Local-first agent tool runtime. Replaces MCP tool sprawl.
  2. context7-cli — Standalone Context7 CLI. Adds offline access.
  ...

High Impact:
  3. cloakbrowser — Stealth Chromium for agent-browser. Major scraping upgrade.
  4. stitch-sdk — Programmatic design SDK. Fits project work.
  ...

Stale:
  5. polymarket-cli — No project connection. Suggest: kill.
  ...

What to tackle? (number, name, or "skip stale" to bulk-process stale items)
```

### Step 3: Phil picks

Wait for Phil's choice. He can:
- Pick by number or name → go to Step 4
- Say "skip stale" or "clean up stale" → go to Step 6
- Say "done" or "stop" → go to Step 7

### Step 4: Deep context gathering (subagents)

For the chosen item, launch 2 parallel subagents:

**Subagent 1 — Item deep dive:**
- Read the full backlog note for the chosen item
- If the item has a URL: fetch it, get latest README, changelog, recent commits/releases
- Search Memory vault for related tools/patterns: `rg '^summary:.*{keywords}' ~/Vaults/Memory/ --glob '*.md'`
- Read any matching Memory notes in full
- Search `~/Vaults/Knowledge/03_active/` for overlap and read relevant project notes.
- Return: full item context, current state of the project/tool, how it fits into existing setup, what it would replace or enhance

**Subagent 2 — Related vault context:**
- Search `~/Vaults/Knowledge/06_docs/` for related topics with `rg` or Grep.
- Search `07_knowledge/` for related topics: same approach
- Search `05_notes/` if the item is personal
- Return: what already exists in the vaults that relates to this item, gaps this item would fill

### Step 5: Execute

Based on the item's classification and the deep context, act on it. The action depends on what the item is:

**Tool to try / setup improvement:**
1. Research the tool thoroughly (installation, configuration, integration points).
2. Install and configure it. Test it works.
3. Integrate into the existing setup (update configs, connect to projects).
4. Write a Memory vault `tools/` note documenting the tool.
5. If it needs docs: write to `06_docs/` in Knowledge vault.
6. Mark the backlog task done by editing the checkbox in `02_backlog/{item}.md`.
7. Move the note to `07_knowledge/` with a filesystem move.
8. Update `backlog.md` — remove from its section.

**Project idea:**
1. Create `~/Vaults/Knowledge/03_active/{project-name}.md` with filesystem tools.
2. Seed with tasks derived from the backlog item's research.
3. If there's a Memory vault project note to create, write it.
4. Delete the backlog note with `trash` after confirmation.
5. Update `backlog.md` — remove from its section.

**Knowledge / informational:**
1. Mark the backlog task done.
2. Enrich the note if needed (add links to related knowledge, cross-references).
3. Move the note from `02_backlog/` to `07_knowledge/` with a filesystem move.
4. Link to the appropriate sub-index in `07_knowledge/`. Update `knowledge.md` or the relevant sub-index.
5. Update `backlog.md` — remove from its section.

**Merge into existing project:**
1. Read the target project note in `03_active/`.
2. Append relevant tasks and context from the backlog item.
3. Delete the backlog note.
4. Update `backlog.md` — remove from its section.

**Kill (stale):**
1. Delete the backlog note with `trash` after confirmation.
2. Update `backlog.md` — remove from its section.

After execution, update the counts in `backlog.md`'s header line.

### Step 6: Bulk stale processing

If Phil says "skip stale" or "clean up stale":
1. List all stale items with their suggested dispositions.
2. Ask Phil to confirm: "Kill all {N} stale items? Or review individually?"
3. If confirmed: delete each stale backlog note, update `backlog.md`.
4. If review: present each stale item one by one with its suggestion. Phil says yes/no/keep per item.
5. Return to Step 2 with updated list.

### Step 7: Loop or stop

After processing an item, return to Step 2 with the updated backlog. Present remaining items.

If Phil says "done" or "stop": print a summary of the session and exit.

```
Session complete:
- {N} items processed
- {T} tools installed/configured
- {P} projects created
- {K} knowledge items filed
- {M} items merged into projects
- {D} items killed
- {R} items remaining in backlog
```

## Rules

- Interactive — always ask Phil before acting. Never autonomously delete or move items.
- `backlog.md` is the source of truth. Always read it fresh at the start and update it after every action.
- Never invoke the `obsidian` executable during this workflow.
- **Tree-graph linking.** Backlog notes have `See also: [[backlog]]` as parent link. Knowledge notes moved from backlog: update `See also:` to point to the appropriate `07_knowledge/` sub-index. New project notes: link to `[[projects]]`.
- When moving items to `07_knowledge/`: link to the nearest sub-index in `knowledge.md`. If no sub-index fits, link to `knowledge.md` directly.
- When creating project notes in `03_active/`: follow the project note structure from `~/Vaults/AGENTS.md` (Status, Tasks, Notes sections).
- Memory vault writes use filesystem tools.
- Subagent prompts must be self-contained. Include all data the subagent needs.
- Keep the loop going. After each item, offer to continue. Don't make Phil re-invoke the command.
- When installing tools: verify they work before marking complete. Run the tool, check output.
- When Phil picks an item that requires implementation beyond vault operations (e.g., installing a CLI tool, configuring an MCP server), do the full implementation — don't just file it away.
