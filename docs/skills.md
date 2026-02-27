---
summary: Skills catalog — all 20 on-demand skills with sources, triggers, and trimming notes.
read_when:
  - Adding or modifying skills
  - Reviewing what's available
  - Deciding whether to adopt a new upstream skill
---

# Skills Catalog

20 skills in `configs/skills/`, synced to all 4 targets via `acsync push`.
Skills load on-demand when the agent's task matches the skill description.

## Sources

| Source | Repo | Count | Notes |
|---|---|---|---|
| Custom | this repo | 10 | Obsidian (6), design (2), workflow (2) |
| Anthropic | `~/Repos/oss/anthropic-skills` | 8 | Adopted as-is (upstream-only) |
| Superpowers | `~/Repos/oss/superpowers` | 2 | Trimmed to telegraphic style on adoption |

## Inventory

### Custom Skills

| Skill | Trigger | Lines |
|---|---|---|
| `obsidian-markdown` | Working with .md files in Obsidian, wikilinks, callouts | — |
| `obsidian-json-canvas` | Working with .canvas files, mind maps, flowcharts | — |
| `obsidian-cli` | Vault reads/writes, note management, plugin dev | — |
| `obsidian-defuddle` | Extracting clean markdown from web pages | — |
| `obsidian-bases` | Creating .base files, database views, filters | — |
| `obsidian-vault-conventions` | Vault layout, folder lifecycle, naming conventions | — |
| `web-design-guidelines` | Reviewing UI for Web Interface Guidelines compliance | — |
| `vercel-react-best-practices` | Writing/reviewing/refactoring React/Next.js code | — |
| `frontend-aesthetics` | Building web UI, CSS, components, styling (merged w/ Anthropic's frontend-design) | 29 |
| `screenshot-workflow` | "Use a screenshot" or replacing/optimizing image assets | 13 |

### Anthropic Skills (upstream, not trimmed)

| Skill | Trigger | Support files |
|---|---|---|
| `webapp-testing` | Testing local web apps with Playwright | scripts/, examples/ |
| `skill-creator` | Creating, evaluating, benchmarking skills | agents/, scripts/, eval-viewer/, references/ |
| `mcp-builder` | Building MCP servers (Python FastMCP / Node SDK) | reference/, scripts/ |
| `doc-coauthoring` | Co-authoring documentation, specs, proposals | — |
| `docx` | Creating/editing/reading Word documents | scripts/ |
| `pdf` | PDF processing (read, create, merge, OCR) | forms.md, reference.md, scripts/ |
| `pptx` | Creating/editing PowerPoint presentations | editing.md, pptxgenjs.md, scripts/ |
| `xlsx` | Creating/editing/cleaning spreadsheets | scripts/ |

### Superpowers Skills (trimmed)

| Skill | Trigger | Original → Trimmed |
|---|---|---|
| `brainstorming` | Before creating features, building components, adding functionality | 96 → 38 lines |
| `test-driven-development` | Implementing features or bugfixes (test-first workflow) | 371 → 73 lines (+ 53-line anti-patterns ref) |

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
5. `acsync push --type skills` to sync
6. Update this doc
