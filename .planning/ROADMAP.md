# Roadmap: Agent Config Sync CLI

## Overview

Build a deterministic CLI that renders canonical agent configs to 4 target CLI formats, detects drift via hash-based diffs, and pushes changes with atomic writes and secret injection. Three phases: infrastructure foundations, all renderers + secret handling, then diff engine + CLI shell.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Foundation** - Types, infra (atomic writes, backup, hashing), format parsers, exclusion filters
- [ ] **Phase 2: Renderers + Secrets** - All config rendering for 4 targets + secret injection + env var conversion
- [ ] **Phase 3: Diff Engine + CLI** - Manifest, 3-way diff, CLI subcommands, output formats, dry-run

## Phase Details

### Phase 1: Foundation
**Goal**: Infrastructure layer exists — deterministic hashing, safe file operations, and exclusion filtering
**Depends on**: Nothing (first phase)
**Requirements**: DIFF-01, FILE-01, FILE-02, EXCL-01, EXCL-02
**Success Criteria** (what must be TRUE):
  1. Content hash of any file or directory returns deterministic SHA-256
  2. File writes are atomic (write to temp → fsync → rename into place)
  3. Timestamped backup copy is created before any file overwrite
  4. `gsd-*` files/directories and non-canonical items are excluded from processing
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Types, errors, exclusion filter, hash, backup, atomic write + tests
- [ ] 01-02-PLAN.md — Format parsers (JSON, JSONC, TOML, Markdown frontmatter) + round-trip tests

### Phase 2: Renderers + Secrets
**Goal**: Any canonical config renders correctly to any target format, with secrets injected
**Depends on**: Phase 1
**Requirements**: RNDR-01, RNDR-02, RNDR-03, RNDR-04, RNDR-05, RNDR-06, RNDR-07, RNDR-08, RNDR-09, RNDR-10, RNDR-11, RNDR-12, RNDR-13, RNDR-14, SECR-01, SECR-02, SECR-03
**Success Criteria** (what must be TRUE):
  1. Each canonical config type (command, agent, MCP, instruction, skill) renders to all 4 target formats correctly
  2. Secrets from `.env` are loaded and injected into rendered output (placeholders replaced with real values)
  3. Env var syntax matches target conventions (`${VAR}` for Claude/Gemini, `{env:VAR}` for OpenCode, none for Codex)
  4. Format integrity preserved: JSONC comments survive, TOML types are correct, frontmatter round-trips cleanly
**Plans**: TBD

Plans:
- [ ] 02-01: Secret handling (load .env, inject/redact, env var syntax conversion)
- [ ] 02-02: Command + agent renderers (all 4 targets × 2 config types = 8 renderers)
- [ ] 02-03: MCP + instruction + skill renderers (4 MCP targets + instructions concat + skill copy)

### Phase 3: Diff Engine + CLI
**Goal**: End-to-end CLI works — diff, render, push, check with proper output and exit codes
**Depends on**: Phase 2
**Requirements**: DIFF-02, DIFF-03, DIFF-04, DIFF-05, FILE-03, CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08, CLI-09
**Success Criteria** (what must be TRUE):
  1. `check` subcommand detects drift between canonical and target configs, exits with code 2
  2. `push` subcommand renders + writes all configs to target locations with backup
  3. `--dry-run` flag shows execution plan without writing any files
  4. `--json` flag produces structured output; default produces human-readable colored text
  5. `--target` and `--type` flags scope operations; exit codes are 0=success, 1=error, 2=drift
**Plans**: TBD

Plans:
- [ ] 03-01: Manifest + 3-way diff engine (manifest read/write, source vs target vs manifest compare)
- [ ] 03-02: CLI shell (commander.js subcommands, flags, exit codes, dual output)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Renderers + Secrets | 0/3 | Not started | - |
| 3. Diff Engine + CLI | 0/2 | Not started | - |
