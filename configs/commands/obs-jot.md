---
description: >-
  Distill conversation into a persistent memory note (e.g., /obs-jot how we
  structured the vault)
---

# Jot — Write to Agent Memory

Distill what was discussed in the current conversation into a persistent note in the Memory vault.

User input: $ARGUMENTS

## Steps

1. **Determine what to document:**
   - If `$ARGUMENTS` provided: use it as a hint for what to capture. Review the conversation for relevant context matching that hint.
   - If no arguments: review the recent conversation and ask "What from this conversation should I document?"

2. **Distill — don't dump.** Extract:
   - Key decisions made and their rationale.
   - Discoveries or gotchas encountered.
   - Patterns or conventions established.
   - Anything the agent should know in future sessions.
   - Skip: routine back-and-forth, dead ends, obvious things.

3. **Determine folder placement:**
   - Is this about a specific repo/project? → `projects/`
   - Is this about a CLI tool or system command? → `tools/`
   - Is this a reusable implementation pattern? → `patterns/`
   - General/meta/vault knowledge? → root (`~/Vaults/Memory/`)

4. **Derive a descriptive kebab-case filename** from the core topic.

5. **Detect related notes:**
   - Search Memory vault: `obsidian vault=Memory search query="{relevant-term}"`
   - From matches + conversation context, build the `related:` list.
   - If the conversation involved a specific dependency or prerequisite note, add to `depends-on:`.

6. **Create the memory note:**
   - **Do NOT use `obsidian create` for this step.** The shell interprets backticks in `content=` as command substitution, silently stripping any inline code. Write directly to the filesystem instead:
     ```
     Write to: ~/Vaults/Memory/{folder}/{kebab-name}.md
     ```
   - Format:
     ```markdown
     ---
     type: {learning | pattern | tool | reference}
     tags: []
     created: YYYY-MM-DD
     related: ["[[note-name]]"]
     depends-on: []
     ---

     # {Title}

     {Distilled content with [[wikilinks]] to related notes}
     ```

7. **Confirm:** `Memory saved → Memory/{folder}/{kebab-name}.md`

## Rules

- Distill, don't transcribe. Be concise — future agents should get the point in 30 seconds.
- Frontmatter required. Schema: `type`, `tags`, `created`, `related`, `depends-on`.
- Always include `vault=Memory` in every `obsidian` command.
- **Write notes via filesystem** (absolute path above), not `obsidian create` — backticks in content are eaten by the shell.
- One note per topic. If multiple unrelated things need saving, create multiple notes.
- Include `[[wikilinks]]` to related notes in Knowledge or Memory vaults.
- Kebab-case filenames, no date prefixes.
- Place in the correct folder — `projects/`, `tools/`, `patterns/`, or root.
- Populate `related:` from detected connections. Don't leave it empty if related notes exist.
