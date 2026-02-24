---
description: "Distill conversation into a persistent memory note (e.g., /obs-jot how we structured the vault)"
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

3. **Derive a descriptive kebab-case filename** from the core topic.

4. **Create the memory note:**
   - **Do NOT use `obsidian create` for this step.** The shell interprets backticks in `content=` as command substitution, silently stripping any inline code. Write directly to the filesystem instead:
     ```
     Write to: /Users/m332023/Library/Mobile Documents/iCloud~md~obsidian/Documents/Memory/{kebab-name}.md
     ```
   - Use `[[wikilinks]]` to reference related notes in either vault (cross-vault links work).

5. **Confirm:** `Memory saved → Memory/{kebab-name}.md`

## Rules

- Distill, don't transcribe. Be concise — future agents should get the point in 30 seconds.
- No frontmatter. Just `# Title`, content, and a `Recorded: {date}` footer.
- Always include `vault=Memory` in every `obsidian` command.
- **Write notes via filesystem** (absolute path above), not `obsidian create` — backticks in content are eaten by the shell.
- One note per topic. If multiple unrelated things need saving, create multiple notes.
- Include `[[wikilinks]]` to related notes in Knowledge or Memory vaults.
- Kebab-case filenames, no date prefixes.
