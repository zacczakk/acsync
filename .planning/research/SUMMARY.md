# Project Research Summary

**Project:** Agent Config Sync CLI
**Domain:** Deterministic config sync CLI tool (TypeScript/Bun)
**Researched:** 2026-02-20
**Confidence:** HIGH

## Executive Summary

This is a deterministic config sync tool that replaces a 777-line agent-driven playbook with testable TypeScript code. The domain is well-understood: dotfile management tools (chezmoi, yadm, stow) and the direct competitor vsync establish clear architectural patterns — adapter-per-target, hash-based 3-way diff, atomic writes, format-specific parsers. The recommended approach borrows vsync's adapter pattern and chezmoi's persistent state model but implements transforms as typed TypeScript functions rather than Go templates or hardcoded mappings. The stack is minimal: Bun runtime, commander.js, Zod 4, and three format parsers (jsonc-parser, smol-toml, gray-matter).

The primary risk is **settings deep merge correctness** — each CLI has different merge semantics per key (overwrite vs preserve vs union-merge arrays), and getting this wrong silently destroys user customizations. The secondary risk is **secret handling edge cases**: the `FOUNDRY_TOKEN` env var, OpenCode's `{env:VAR}` vs canonical `${VAR}` syntax, and incomplete redaction on pull. Both risks are mitigable with explicit per-key merge strategy declarations and a paranoid post-write secret scan. The architecture research confirms a clean dependency chain (types → infra → formats → transforms → adapters → core → CLI) that maps directly to a phased build order.

What makes this project tractable: the domain is fully specified in SYNC.md (777 lines of battle-tested edge cases), the 4 target CLIs are known and stable, and first-hand sync experience (2026-02-18 full sync) documents every format transformation and edge case. The competitive gap vs vsync is narrow but real: non-canonical item preservation (deep merge), secret injection, markdown frontmatter transforms, and agent-friendly structured output.

## Key Findings

### Recommended Stack

Bun >=1.2 as runtime eliminates separate bundler/transpiler needs and provides native file I/O, crypto hashing, glob, and `.env` loading. Three format-specific parsers handle the four config formats across CLI targets. See [STACK.md](STACK.md) for full rationale.

**Core technologies:**
- **Bun >=1.2**: Runtime + package manager — native TS execution, `Bun.CryptoHasher` for content hashing, `Bun.write`/`Bun.file` for I/O
- **commander.js ^14**: CLI framework — `@commander-js/extra-typings` for full TS inference on subcommands (sync, check, diff)
- **Zod 4 (^3.25)**: Config schema validation — runtime `.parse()` with clear errors + inferred TypeScript types
- **jsonc-parser ^3.3**: JSONC read/write — VS Code's own parser; `modify()`/`applyEdits()` preserve comments and formatting
- **smol-toml ^1.6**: TOML parse/stringify — TOML 1.1 compliant, 5KB, zero deps; for Gemini/Codex config generation
- **gray-matter ^4**: Markdown frontmatter — parse + `stringify()` for round-trip; handles YAML/TOML frontmatter variants
- **vitest ^4 + Biome ^1.9**: Dev tooling — testing + lint/format in single Rust-based tool

### Expected Features

See [FEATURES.md](FEATURES.md) for competitive analysis including vsync gap analysis.

**Must have (table stakes):**
- Format conversion (JSON/JSONC/TOML/Markdown frontmatter) — core value; without this, tool doesn't exist
- Diff/preview + dry-run — user trust; every competitor has this
- Atomic writes with backup — crash safety; partial writes corrupt CLIs
- Hash-based change detection — incremental sync; drift detection
- Env var syntax conversion — `${VAR}` ↔ `{env:VAR}` per-target
- Safe mode (no destructive default) — create + update only; explicit flag for deletes

**Should have (differentiators vs vsync):**
- Non-canonical item preservation (deep merge) — #1 differentiator; vsync is all-or-nothing
- Secret injection from .env — vsync converts syntax but never injects values
- Markdown frontmatter transformation — no competitor handles this
- Per-target transform pipelines — composable TypeScript functions, not hardcoded mappings
- Agent-friendly structured output (--json) — agents consume this tool; vsync outputs for humans only
- Subset sync (scope control) — sync only commands, or only MCP, or only settings

**Defer (v2+):**
- Template language — TypeScript transforms are already testable; no DSL needed
- Plugin system — 4 known targets; hardcode, revisit at >8
- Watch mode — race conditions, daemon complexity; manual sync is fine
- Interactive TUI diff — CLI diff sufficient for v1
- Password manager integration — `.env` covers 95% of cases

### Architecture Approach

The architecture follows an adapter pattern with 5 layers: CLI → Core → Adapters → Formats + Transforms → Infrastructure. Each CLI target (Claude Code, OpenCode, Gemini, Codex) has a dedicated adapter implementing a `TargetAdapter` interface. A 3-way diff engine (source vs target vs manifest) classifies operations as CREATE/UPDATE/DELETE/SKIP. Settings use per-key merge strategies (overwrite/preserve/deep-merge). All writes are atomic (temp → fsync → rename) with per-CLI backup/rollback. See [ARCHITECTURE.md](ARCHITECTURE.md) for component diagram and data flows.

**Major components:**
1. **Format Layer** (JSON, JSONC, TOML, Markdown) — pure parse/serialize functions; no adapter knowledge
2. **Adapter Layer** (Claude, OpenCode, Gemini, Codex + BaseAdapter) — per-target path resolution, format selection, transform pipelines
3. **Core** (Planner, Manifest Manager, Executor, Orchestrator) — 3-way diff, hash tracking, plan execution, lifecycle coordination
4. **Transform Layer** (env-var, settings-merge, naming) — content mutations operating on parsed data
5. **Infrastructure** (atomic-write, backup, hash, fs) — OS-level utilities with safety guarantees

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for full 8-pitfall analysis with recovery strategies.

1. **JSONC comment destruction** — Never use `JSON.parse`/`JSON.stringify` on user-facing configs. Use `jsonc-parser` `modify()`/`applyEdits()` for surgical edits preserving comments. Must be the only path from day one.
2. **Deep merge clobbers arrays** — Per-key merge strategy required, not a global `deepMerge()`. `permissions.allow` needs union merge; `instructions` needs wholesale replace. Test with fixtures containing user-added entries.
3. **Secret leak via incomplete redaction** — Post-write content scan for all known secret values. `FOUNDRY_TOKEN` env var handling is a first-class mapping. Pre-commit hook as safety net.
4. **`{env:VAR}` confused with `${VAR}`** — Different regex patterns: secret injection matches `${VAR}` (dollar sign); skip `{env:VAR}` (no dollar sign). Test fixture with both patterns in same file.
5. **Partial write leaves CLI broken** — Atomic writes (temp + rename) + per-CLI backup/rollback. Write settings/MCP first (most likely to fail), then commands/agents.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Types, Infrastructure, Format Parsers

**Rationale:** Architecture research shows a clean dependency chain where types → infra → formats have zero upstream dependencies. Every other component depends on these. All 8 critical pitfalls require these foundations to be correct (atomic writes, JSONC handling, path normalization, exclusion filtering).
**Delivers:** Type definitions, atomic file writer, backup/rollback, hash utils, path normalization, exclusion filter, and all 4 format parsers (JSON, JSONC, TOML, Markdown frontmatter) with round-trip tests.
**Addresses:** Format conversion (P1 table stakes), atomic writes (P1), hash-based change detection (P1)
**Avoids:** JSONC comment destruction (Pitfall 1), partial writes (Pitfall 5), macOS path inconsistency (Pitfall 6)

### Phase 2: Transforms + Secret Handling

**Rationale:** Transforms depend on format parsers (Phase 1) but are independent of adapters. Secret handling has the highest-consequence bugs (leaked keys) and must be hardened before any adapter writes real files. Env var syntax conversion is tightly coupled with secret injection.
**Delivers:** Env var syntax converter, secret injector/redactor, naming transforms (prefix strip), settings merge engine with per-key strategies.
**Addresses:** Env var syntax conversion (P1), secret injection (P1), non-canonical item preservation via merge (P1 differentiator)
**Avoids:** `{env:VAR}` vs `${VAR}` confusion (Pitfall 4), secret leak (Pitfall 3), array merge clobber (Pitfall 2)

### Phase 3: Adapters + Core Engine

**Rationale:** Adapters compose formats + transforms + infra (all from Phases 1-2). Each adapter is independent (~100-200 LOC) and can be built in parallel. The core engine (planner, manifest, executor) depends on adapters for reading target state. Architecture research confirms this is the most labor-intensive phase but has well-defined boundaries.
**Delivers:** BaseAdapter + 4 target adapters, manifest manager, 3-way diff planner, sync executor with rollback.
**Addresses:** Per-target transform pipelines (P1 differentiator), hash-based change detection (P1), backup before overwrite (P1)
**Avoids:** TOML type coercion (Pitfall 7), exclusion rule drift (Pitfall 8)

### Phase 4: CLI + Orchestration + Output

**Rationale:** Thin shell over the orchestrator. All business logic lives in Phases 1-3. This phase wires everything together with commander.js subcommands, exit codes, and dual output (human + JSON).
**Delivers:** `sync push`, `sync pull`, `sync check` commands; `--dry-run`, `--json`, `--yes` flags; exit codes (0=ok, 1=error, 2=drift); human-readable diff + JSON report.
**Addresses:** CLI with exit codes (P1), agent-friendly output (P1 differentiator), diff/preview + dry-run (P1)
**Avoids:** Per-file confirmation fatigue (UX pitfall — batch confirmation per CLI per category)

### Phase 5: Polish + CI Integration

**Rationale:** After core sync works, add convenience features and CI integration. These are P2 features that don't block initial usage.
**Delivers:** Drift detection CI command (`check` with non-zero exit), subset sync (per-resource-type scope), path expansion (`~` → absolute), `.env.example` template generation.
**Addresses:** Drift detection (P2), subset sync (P2), path expansion (P2)

### Phase Ordering Rationale

- **Bottom-up dependency chain:** types → infra → formats → transforms → adapters → core → CLI. Each phase depends only on previous phases. No circular dependencies.
- **Risk-first:** Secret handling (Phase 2) before adapters (Phase 3) ensures no real writes happen with broken redaction logic.
- **Parallel potential:** Within Phase 3, all 4 adapters are independent. Within Phase 1, format parsers are independent.
- **Pitfall-to-phase mapping:** All 8 critical pitfalls are addressed in Phases 1-3, before the CLI shell is built. This means core bugs are caught by unit tests, not by users.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Settings Merge):** Per-key merge strategies for each CLI's settings file. Current SYNC.md documents these but they need formalization into typed merge specs. The `permissions.allow` array union merge is tricky.
- **Phase 3 (Codex Adapter):** Codex is the outlier — HTTP-only MCP, TOML config, merged prompts directory, `agent-{name}.md` prefix convention. Less battle-tested than other adapters.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** All libraries chosen, APIs documented, patterns well-established (jsonc-parser, smol-toml, gray-matter).
- **Phase 4 (CLI):** commander.js is thoroughly documented; subcommand patterns are standard.
- **Phase 5 (Polish):** Trivial extensions of existing infrastructure.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All libraries verified via Context7 + npm + GitHub. Versions confirmed current. Bun APIs verified against docs. |
| Features | HIGH | Direct competitor (vsync) analyzed source code. chezmoi official docs via Context7. First-hand sync experience (2026-02-18). |
| Architecture | HIGH | vsync source code studied in detail. chezmoi architecture docs. Adapter pattern validated against 4 known targets. |
| Pitfalls | HIGH | Derived from 777-line SYNC.md (battle-tested), vsync source analysis, and first-hand edge case experience. |

**Overall confidence:** HIGH

### Gaps to Address

- **TOML comment preservation:** If Gemini CLI configs evolve to include user-edited TOML with comments, no JS library preserves TOML comments. Current approach (generate from scratch) works but is fragile if requirements change. Monitor during implementation.
- **Codex adapter completeness:** Codex CLI is newest target, least battle-tested. May have undocumented config quirks. Validate during Phase 3 implementation.
- **Pull direction (system → repo):** Research focused on push (repo → system). Pull requires instruction split logic (header marker parsing) and secret redaction. Needs detailed spec during Phase 3 planning.
- **vsync as dependency vs standalone:** Decision pending. Research supports standalone (our transforms are more complex), but vsync's adapter infrastructure could save effort. Recommend standalone per PROJECT.md rationale, but flag for revisit if Phase 3 adapter code exceeds estimates.

## Sources

### Primary (HIGH confidence)
- vsync source code (`~/Repos/oss/vsync`) — adapter pattern, diff engine, atomic writes, JSONC handling, env var transforms
- chezmoi official docs (Context7 `/twpayne/chezmoi`) — architecture, feature comparison, secret management
- SYNC.md (`~/Repos/acsync/SYNC.md`) — 777-line battle-tested sync playbook with all edge cases
- AGENTS.md sync learnings (2026-02-18) — first-hand format transformation experience
- Context7: `/tj/commander.js`, `/jonschlinkert/gray-matter`, `/websites/zod_dev_v4`, `/vitest-dev/vitest`

### Secondary (MEDIUM confidence)
- GitHub: smol-toml releases, commander.js CHANGELOG
- NPM: jsonc-parser v3.3.1, gray-matter v4.0.3
- Bun docs: CryptoHasher, file I/O APIs
- chezmoi secret management docs
- yadm, dotbot, mackup feature analysis

### Tertiary (LOW confidence)
- Community discussion on secret detection pre-commit hooks — general patterns, not tool-specific

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
