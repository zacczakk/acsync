---
summary: Skills catalog and portfolio guidance for 36 active globally synced skills.
read_when:
  - Adding or modifying skills
  - Reviewing what's available
  - Deciding whether to adopt a new upstream skill
---

# Skills Catalog

36 active skills in `configs/skills/`, synced to all targets via `metronome push`.
Skills load on-demand when the agent's task matches the skill description.

The current portfolio is intentionally under review. See [Skill Portfolio Review](skill-portfolio-review-2026-07-10.md) for ranked cuts and reduction candidates.

## Sources

| Source | Repo | Count | Notes |
|---|---|---|---|
| Custom | this repo | 13 | Foundry, vault, design, and workflow skills |
| Anthropic | `anthropics/skills` | 6 | File-format and MCP skills |
| Superpowers | `obra/superpowers` | 6 | Four locally adapted skills are manual-sync |
| Matt Pocock | `mattpocock/skills` | 2 | `diagnosing-bugs` and `tdd`, locally adapted and manual-sync |
| Kepano | `kepano/obsidian-skills` | 5 | `obsidian-cli` is manually synced due to local app-safety guard |
| Vercel | `vercel-labs/agent-skills` | 2 | React reference manual; design guidelines auto |
| Other upstreams | Cursor and jakubkrehel | 2 | Manual sync |

## Selected Inventory

The tables below are a trigger-oriented overview, not an exhaustive registry. Source counts above and `configs/skills/*/SKILL.md` are authoritative.

### Custom Skills

| Skill | Trigger | Lines |
|---|---|---|
| `memory-retrieval` | Memory/Knowledge/qmd/session lookup before broad repo search or multi-file reads | — |
| `obsidian-markdown` | Working with .md files in Obsidian, wikilinks, callouts | — |
| `obsidian-json-canvas` | Working with .canvas files, mind maps, flowcharts | — |
| `obsidian-cli` | Explicit Obsidian app, plugin, or theme automation | — |
| `obsidian-defuddle` | Extracting clean markdown from web pages | — |
| `obsidian-bases` | Creating .base files, database views, filters | — |
| `obsidian-vault-conventions` | Vault layout, folder lifecycle, naming conventions | — |
| `web-design-guidelines` | Reviewing UI for Web Interface Guidelines compliance | — |
| `vercel-react-best-practices` | Writing/reviewing/refactoring React/Next.js code | — |
| `design-critique` | Reviewing UI for anti-slop tells, hierarchy, and UX quality | — |
| `screenshot-workflow` | "Use a screenshot" or replacing/optimizing image assets | 13 |
| `session-notes` | Writing atomic session notes to Memory vault (decisions, discoveries, checkpoints) | — |

### Anthropic Skills

| Skill | Trigger | Support files |
|---|---|---|
| `mcp-builder` | Building MCP servers (Python FastMCP / Node SDK) | reference/, scripts/ |
| `docx` | Creating/editing/reading Word documents | scripts/ |
| `pdf` | PDF processing (read, create, merge, OCR) | forms.md, reference.md, scripts/ |
| `pptx` | Creating/editing PowerPoint presentations | editing.md, pptxgenjs.md, scripts/ |
| `xlsx` | Creating/editing/cleaning spreadsheets | scripts/ |

### Superpowers Skills

| Skill | Trigger | Status |
|---|---|---|
| `brainstorming` | Before creating features, building components, adding functionality | Upstream auto-sync; removal/narrowing recommended |
| `diagnosing-bugs` | Hard bugs and performance regressions | Matt Pocock replacement for `systematic-debugging`; manual-sync |
| `tdd` | Explicit test-first requests and red-green-refactor | Matt Pocock replacement for `test-driven-development`; manual-sync |

### Impeccable Skill (pbakaus/impeccable, Apache 2.0)

| Skill | Trigger | Files |
|---|---|---|
| `frontend-design` | Building web UI, pages, components, applications — distinctive, anti-AI-slop aesthetics with local design-context support | SKILL.md |

Replaces former `frontend-aesthetics`. Inspired by Impeccable, but now trimmed and owned locally. Added a metronome-native context protocol and separate review/command layer instead of importing the full upstream command pack.

## Design Commands

Six design commands in `configs/commands/`, synced with the rest of the canonical command set:

1. `teach-design-context`
2. `design-audit`
3. `design-critique`
4. `design-normalize`
5. `design-polish`
6. `design-typeset`

## Adoption Guidelines

Per arXiv:2602.11988 (Gloaguen et al., "Evaluating AGENTS.md"):
- Every skill loaded but not needed costs tokens and slightly reduces success rate
- Upstream skills are often verbose (100-400 lines) — trim to telegraphic on adoption when customizing
- Anthropic skills adopted as-is are upstream-only; don't modify (pull updates from source)
- Custom and trimmed skills are owned by us; modify freely

## Adding a New Skill

1. Evaluate fit: does this address a gap or duplicate existing coverage?
2. Check upstream source health (recent commits, adoption)
3. If upstream: copy to `configs/skills/<name>/`, trim if customizing
4. If custom: create `configs/skills/<name>/SKILL.md` with frontmatter (`name`, `description`)
5. `metronome push --type skills` to sync
6. Update this doc
