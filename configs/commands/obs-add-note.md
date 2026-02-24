---
description: "Quick capture a note to the inbox (e.g., /obs-add-note check out this tool: https://...)"
---

# Add Note

Quick-capture a note into `01_inbox/`.

User input: $ARGUMENTS

## Steps

1. **If `$ARGUMENTS` provided:**
   - Derive a kebab-case filename from the content (use the first few meaningful words).
    - Create the note:
     ```
     obsidian vault=Knowledge create path="01_inbox/{kebab-name}.md" content="# {Title}\n\n{content}"
     ```
   - Confirm: `Note captured → 01_inbox/{kebab-name}.md`

2. **If no arguments:**
   - Ask: "What do you want to capture?"
   - Then proceed as above.

## Rules

- No frontmatter. Just `# Title` and content.
- Always include `vault=Knowledge` in every `obsidian` command.
- Use `obsidian vault=Knowledge create` — not raw file I/O.
- Kebab-case filenames, no date prefixes.
- This is zero-friction capture — don't over-structure. Triage happens later via `/obs-triage-inbox`.
- If the content is a URL, just capture it as-is. Enrichment happens during triage.
- Include `[[wikilinks]]` to related notes where meaningful.
