# Agent Config Sync CLI

## What This Is

A deterministic TypeScript (bun) CLI tool that syncs AI coding tool configurations — commands, agents, skills, MCP servers, settings, and instructions — from a canonical repository (`~/Repos/acsync`) to each CLI's global config directory. The tool handles format conversion, secret injection, and subset merging so agents don't burn tokens on mechanical transforms. Agents use the CLI for diffs and interactive sync; the heavy lifting is deterministic code.

## Core Value

Make config sync fast, cheap, and reliable by moving all mechanical transforms into deterministic code, leaving only genuinely complex decisions to agents.

## Current Milestone: v3.0 Harden Test Suite

**Goal:** E2E fixture-based tests covering push and pull across all 4 CLI targets for all 6 config types, using committed fixtures and real target directories with backup/restore safety.

**Target features:**
- Committed fixture data for all 6 config types (commands, agents, skills, settings, MCP, instructions)
- E2E push tests: canonical fixtures → push to real CLI targets → verify output → cleanup
- E2E pull tests: target fixtures → pull to canonical → verify → cleanup
- Full coverage matrix: 2 ops × 4 targets × 6 types = 48 test cells
- Backup/restore safety for real target directory tests
- Fix failing tests that overlap with fixture work

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

- [ ] Committed fixture data for all 6 config types across all 4 targets
- [ ] E2E push tests with real target directories
- [ ] E2E pull tests with real target directories
- [ ] Backup/restore safety harness for E2E tests
- [ ] Fix overlapping failing tests

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
- **Canonical repo**: `~/Repos/acsync/configs/` contains commands (17), agents (8), skills (2), MCP servers (6), settings (2), instructions (AGENTS.md + TOOLS.md).

## Constraints

- **Tech stack**: TypeScript, bun runtime — consistent with vsync patterns, repo already uses bun
- **Canonical source**: `~/Repos/acsync` is always source of truth; CLI configs are targets
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
*Last updated: 2026-02-25 after v3.0 milestone start*
