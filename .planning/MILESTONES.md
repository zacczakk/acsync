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

## v2.0 — Simplify Canonical (Active)

**Phases:** 6+ (TBD)
**Started:** 2026-02-23

Flatten canonical structure, merge per-CLI instruction addendums into single AGENTS.md, add TOOLS.md reference, rename repo folder, fix instruction paths. Breaking changes to canonical layout and CLI config paths.
