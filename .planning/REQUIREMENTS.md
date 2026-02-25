# Requirements: acsync

**Defined:** 2026-02-20
**Core Value:** Make config sync fast and cheap by moving mechanical transforms into deterministic code

## v1 Requirements (Complete)

All 37 v1 requirements satisfied. See MILESTONES.md for details.

## v2.0 Requirements (Complete)

All 24 v2.0 requirements satisfied. See MILESTONES.md for details.

## v3.0 Requirements

Requirements for Harden Test Suite milestone. E2E fixture-based tests covering push and pull across all 4 CLI targets for all 6 config types.

### Fixtures Infrastructure

- [x] **FIX-01**: Committed fixture directory exists at `test/fixtures/` with canonical and per-target subdirectories
- [x] **FIX-02**: Canonical fixtures cover all 6 config types (commands, agents, skills, settings, MCP, instructions)
- [x] **FIX-03**: Per-target fixture sets exist for Claude, OpenCode, Gemini, Codex (expected push outputs)
- [x] **FIX-04**: Test harness backs up real target directories before E2E tests
- [x] **FIX-05**: Test harness restores real target directories after E2E tests
- [x] **FIX-06**: Cleanup runs reliably even on test failure (try/finally pattern)
- [x] **FIX-07**: Fixture data exercises format-specific features (frontmatter, TOML, JSONC comments, flat markdown)

### Push E2E

- [ ] **PUSH-01**: Push commands to all 4 real CLI targets and verify output format
- [ ] **PUSH-02**: Push agents to all 4 real CLI targets and verify output format
- [ ] **PUSH-03**: Push skills to all 4 real CLI targets and verify output format
- [x] **PUSH-04**: Push settings to all 4 real CLI targets and verify output format
- [x] **PUSH-05**: Push MCP servers to all 4 real CLI targets and verify output format
- [ ] **PUSH-06**: Push instructions to all 4 real CLI targets and verify output format
- [ ] **PUSH-07**: Push removes non-canonical items from targets (with warning)

### Pull E2E

- [ ] **PULL-01**: Pull commands from all 4 real CLI targets and verify canonical format
- [ ] **PULL-02**: Pull agents from all 4 real CLI targets and verify canonical format
- [ ] **PULL-03**: Pull skills from all 4 real CLI targets and verify canonical format
- [ ] **PULL-04**: Pull settings from all 4 real CLI targets and verify canonical format
- [ ] **PULL-05**: Pull MCP servers from all 4 real CLI targets and verify canonical format
- [ ] **PULL-06**: Pull instructions from all 4 real CLI targets and verify canonical format
- [ ] **PULL-07**: Pull overwrites existing canonical items (with warning)

### Test Health

- [x] **HLTH-01**: Failing tests that overlap with fixture/E2E code paths are fixed
- [x] **HLTH-02**: `package.json` has a `test` script

## Future Requirements (v2.1 — vsync-alignment)

- **HASH-01**: Metadata-aware hashing for canonical items
- **DIFF-01**: True 3-way diff using manifest hash (6-case algorithm)
- **DIFF-02**: Prune/delete mode integrated into diff engine
- **CAP-01**: Capability enforcement in adapters (throw on unsupported operations)
- **ERR-01**: Error type guards and static factory methods
- **CODEX-01**: Codex agents rendered as TOML (not markdown in prompts/)
- **CODEX-02**: Codex agent entries in config.toml `[agents]` section
- **MCP-01**: Dedicated MCP server hash with sorted keys

## Out of Scope

| Feature | Reason |
|---------|--------|
| TOOLS.md rendering to targets | Referenced by absolute path; all agents have repo access |
| Watch mode / auto-sync | Premature; sync is infrequent |
| Bidirectional merge conflict resolution | Source of truth is canonical repo |
| vsync pattern adoption | Deferred to v2.1 milestone |
| Codex TOML agent format | Deferred to v2.1 milestone |
| Plugin system | 4 fixed targets; add as code when needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 10 | Complete |
| FIX-02 | Phase 10 | Complete |
| FIX-03 | Phase 10 | Complete |
| FIX-04 | Phase 10 | Complete |
| FIX-05 | Phase 10 | Complete |
| FIX-06 | Phase 10 | Complete |
| FIX-07 | Phase 10 | Complete |
| PUSH-01 | Phase 11 | Pending |
| PUSH-02 | Phase 11 | Pending |
| PUSH-03 | Phase 11 | Pending |
| PUSH-04 | Phase 11 | Complete |
| PUSH-05 | Phase 11 | Complete |
| PUSH-06 | Phase 11 | Pending |
| PUSH-07 | Phase 11 | Pending |
| PULL-01 | Phase 12 | Pending |
| PULL-02 | Phase 12 | Pending |
| PULL-03 | Phase 12 | Pending |
| PULL-04 | Phase 12 | Pending |
| PULL-05 | Phase 12 | Pending |
| PULL-06 | Phase 12 | Pending |
| PULL-07 | Phase 12 | Pending |
| HLTH-01 | Phase 10 | Complete |
| HLTH-02 | Phase 10 | Complete |

**Coverage:**
- v3.0 requirements: 23 total
- Mapped to phases: 23 ✓
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after v3.0 milestone definition*
