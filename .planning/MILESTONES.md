# Milestones

## v1.0 — Foundation (Complete)

**Phases:** 1-5 (15 plans)
**Completed:** 2026-02-23

Built the core acsync CLI: deterministic config transforms for all 4 CLI targets (Claude Code, OpenCode, Gemini CLI, Codex), hash-based diff engine, push/pull/check subcommands, atomic writes with rollback, env var transforms, secret handling, LCS-based unified diff. 414 tests passing.

### Validated Requirements

- Deterministic transforms for all 4 CLI targets
- Command format conversion (frontmatter, TOML, flat markdown)
- Agent format conversion (frontmatter, TOML, flat markdown)
- MCP server transforms (JSON/JSONC/TOML + env var syntax + secret injection)
- Settings subset merge (deep-merge vs wholesale per key)
- Instructions concatenation (AGENTS.md + CLI addendum)
- Skill sync (directory copy with support files)
- Hash-based diff engine
- CLI interface: push, pull, check
- Backup before write (atomic, rollback-capable)
- Non-canonical item preservation
- GSD exclusion (skip gsd-* files/dirs)
- Agent-friendly output (structured JSON)

### Key Decisions (v1.0)

- Standalone tool, not vsync dependency
- TypeScript + bun runtime
- atomicWrite is pure atomic (temp+fsync+rename)
- Format parsers are pure string-in/string-out
- JSONC comment preservation via jsonc-parser
- smol-toml over @iarna/toml
- EnvVarTransformer normalizes through claude-code intermediate
- Manifest at .acsync/manifest.json
- No delete operation type (safe mode only)
- picocolors over chalk
- Orchestrator split into 4 operation modules + thin facade

---

## v2.0 — Simplify Canonical (Complete)

**Phases:** 6-9 (8 plans)
**Started:** 2026-02-23
**Completed:** 2026-02-25

Flattened canonical structure (`configs/common/` → `configs/`), merged 4 per-CLI instruction addendums into single AGENTS.md, added canonical TOOLS.md (referenced by absolute path), renamed repo folder (`~/Repos/agents` → `~/Repos/acsync`), fixed instruction output filenames, cleaned up stale target files. All 24 v2.0 requirements satisfied. Formal verification attestation for all phases.

### v2.0 Requirements

- 5 STRUCT requirements (Phase 6): Canonical structure flattened
- 10 INST requirements (Phase 7): Instructions unified
- 3 TOOL requirements (Phase 8): TOOLS.md created and referenced
- 6 REPO requirements (Phase 8): Repo renamed and paths updated

### Key Decisions (v2.0)

- TOOLS.md referenced by absolute path, not rendered to targets
- Claude keeps CLAUDE.md filename; other 3 targets use AGENTS.md
- Per-CLI addendums merged into `## CLI-Specific Notes` section
- `renderInstructions()` simplified to single-file passthrough
- Phase attribution: requirements credited to implementation phase, verified in Phase 9
