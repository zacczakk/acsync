# Agent Config Sync CLI

## What This Is

A deterministic TypeScript (bun) CLI tool that syncs AI coding tool configurations — commands, agents, skills, MCP servers, settings, and instructions — from a canonical repository (`~/Repos/agents`) to each CLI's global config directory. The tool handles format conversion, secret injection, and subset merging so agents don't burn tokens on mechanical transforms. Agents use the CLI for diffs and interactive sync; the heavy lifting is deterministic code.

## Core Value

Make config sync fast, cheap, and reliable by moving all mechanical transforms into deterministic code, leaving only genuinely complex decisions to agents.

## Current Milestone: v2.0 Simplify Canonical

**Goal:** Flatten canonical structure, unify instructions, rename repo — breaking changes for cleaner architecture.

**Target features:**
- Flatten `configs/common/` to `configs/`
- Merge 4 per-CLI instruction addendums into single AGENTS.md
- Add canonical TOOLS.md (referenced by absolute path, not rendered)
- Rename repo folder `~/Repos/agents` -> `~/Repos/acsync`
- Fix OpenCode `opencode.json` instructions path

## Requirements

### Validated

- Deterministic transforms for all 4 CLI targets (Claude Code, OpenCode, Gemini CLI, Codex)
- Command format conversion (frontmatter rebuild, TOML, flat markdown)
- Agent format conversion (frontmatter rebuild, TOML, flat markdown)
- MCP server transforms (JSON/JSONC/TOML + env var syntax + secret injection)
- Settings subset merge (deep-merge vs wholesale per key)
- Instructions concatenation (AGENTS.md + CLI addendum)
- Skill sync (directory copy with support files)
- Hash-based diff engine (show what changed before applying)
- CLI interface: push, pull, check
- Backup before write (atomic, rollback-capable)
- Non-canonical item preservation (skip items not in canonical repo)
- GSD exclusion (skip `gsd-*` files/dirs, manifest files)
- Agent-friendly output (structured JSON for agent consumption)

### Active

- [ ] Flatten `configs/common/` one level up to `configs/`
- [ ] Move AGENTS.md into `configs/instructions/AGENTS.md`
- [ ] Merge per-CLI addendums (claude.md, opencode.md, gemini.md, codex.md) into single AGENTS.md
- [ ] Update `renderInstructions()` to single-file model (no addendum)
- [ ] Update instruction output filenames (OpenCode: AGENTS.md, Gemini: AGENTS.md, Codex: AGENTS.md)
- [ ] Create canonical `configs/instructions/TOOLS.md` referenced by absolute path from AGENTS.md
- [ ] Rename repo folder `~/Repos/agents` -> `~/Repos/acsync` + re-register binary
- [ ] Fix OpenCode `opencode.json` instructions path to point to AGENTS.md
- [ ] Update all source code paths referencing `configs/common/`
- [ ] Clean up stale target files (OPENCODE.md, GEMINI.md, instructions.md)

### Out of Scope

- Watch mode / auto-sync on file changes — premature; sync is infrequent
- Web UI or dashboard — CLI-only tool
- Plugin system for custom adapters — 4 fixed targets, extend when needed
- Bidirectional merge conflict resolution — source of truth is canonical repo; pull detects drift, doesn't auto-merge
- CI/CD integration — useful later, not v1
- TOOLS.md rendering to targets — referenced by absolute path instead
- vsync-alignment changes — deferred to v2.1 (3-way diff, capability enforcement, Codex TOML agents)

## Context

- **Prior art**: vsync (nicepkg/vsync) solves the same problem for generic CLI tool sync. Key patterns to borrow: adapter registry, 3-way hash diff (source/target/manifest), atomic writes, env var normalize/denormalize through canonical intermediate, JSONC comment preservation via surgical edits.
- **Current state**: Sync is agent-driven via 777-line SYNC.md playbook. Works but is slow (~tokens), fragile (agent interpretation varies), and untestable. v1 was 3,500 LOC Python with 6,800 LOC tests — replaced by "trust the agent" in v2.
- **Pain points**: Every sync run costs significant tokens. All 4 CLI targets have different formats (JSON, JSONC, TOML, flat markdown). Settings merge rules are complex (subset keys, deep vs wholesale merge). Secret handling has edge cases (FOUNDRY_TOKEN env var, OpenCode `{env:...}` syntax). Codex is an outlier (HTTP-only MCP, TOML, merged prompts dir).
- **vsync learnings**: Adapter pattern for tool-specific logic. Hash manifest for 3-way diff. Atomic writes with rollback. Env var transformer with canonical intermediate form. JSONC surgical edits via `jsonc-parser`. Parallel execution with `Promise.allSettled`. Zod for config validation.
- **Canonical repo**: `~/Repos/agents/configs/common/` contains commands (17), agents (8), skills (2), MCP servers (6), settings (2), instructions (4).

## Constraints

- **Tech stack**: TypeScript, bun runtime — consistent with vsync patterns, repo already uses bun
- **Canonical source**: `~/Repos/agents` is always source of truth; CLI configs are targets
- **Backward compatibility**: Must preserve non-canonical items in CLI configs (user-added skills, commands)
- **Secret safety**: Never commit real secrets; `.env` stays gitignored; push injects, pull masks
- **Existing SYNC.md**: Current playbook documents all transform rules — use as specification, eventually replace
- **File size**: Keep files <500 LOC per AGENTS.md convention; split into modules

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Standalone tool, not vsync dependency | Our transforms are more complex (frontmatter, instructions, settings merge); vsync's adapter model is generic but our needs are specific | -- Pending |
| TypeScript + bun | Consistent with vsync patterns, repo already has bun.lock, good ecosystem for JSON/TOML/JSONC manipulation | -- Pending |
| Borrow vsync patterns, not code | vsync's architecture is well-designed but our config types and transforms differ significantly | -- Pending |
| Agent-friendly CLI output | Agents still orchestrate interactive sync; CLI provides deterministic transforms + diffs | -- Pending |
| Hash-based manifest for 3-way diff | Enables detecting drift in CLI configs vs what was last synced vs canonical source | -- Pending |
| TOOLS.md by reference, not render | Agents always have access to ~/Repos/acsync; no need for rendering overhead | -- Pending |

---
*Last updated: 2026-02-23 after v2.0 milestone start*
