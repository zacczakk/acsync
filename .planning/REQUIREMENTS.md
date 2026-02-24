# Requirements: acsync

**Defined:** 2026-02-20
**Core Value:** Make config sync fast and cheap by moving mechanical transforms into deterministic code

## v1 Requirements (Complete)

All 37 v1 requirements satisfied. See MILESTONES.md for details.

## v2.0 Requirements

Requirements for Simplify Canonical milestone. Flatten structure, unify instructions, rename repo.

### Canonical Structure

- [x] **STRUCT-01**: `configs/common/` directory flattened — all subdirs (agents, commands, mcp, settings, skills, instructions) live directly under `configs/`
- [x] **STRUCT-02**: All source code path references updated from `configs/common/X` to `configs/X`
- [x] **STRUCT-03**: All test fixtures and assertions updated for new path structure
- [x] **STRUCT-04**: Help text and error messages reference `configs/` (not `configs/common/`)
- [x] **STRUCT-05**: `configs/common/` directory no longer exists

### Instructions Unification

- [x] **INST-01**: AGENTS.md lives at `configs/instructions/AGENTS.md` (moved from repo root)
- [x] **INST-02**: No AGENTS.md at repo root
- [x] **INST-03**: AGENTS.md contains `## CLI-Specific Notes` section with merged content from all 4 per-CLI addendums
- [x] **INST-04**: Per-CLI addendum files deleted (claude.md, opencode.md, gemini.md, codex.md)
- [x] **INST-05**: `renderInstructions()` accepts single content parameter (no addendum)
- [x] **INST-06**: `readCanonicalInstructions()` reads single file from `configs/instructions/AGENTS.md`
- [x] **INST-07**: OpenCode instructions output file is `AGENTS.md` (not `OPENCODE.md`)
- [x] **INST-08**: Gemini instructions output file is `AGENTS.md` (not `GEMINI.md`)
- [x] **INST-09**: Codex instructions output file is `AGENTS.md` (not `instructions.md`)
- [x] **INST-10**: Claude instructions output file remains `CLAUDE.md` (unchanged)

### TOOLS.md

- [ ] **TOOL-01**: `configs/instructions/TOOLS.md` exists with tool-use documentation
- [ ] **TOOL-02**: AGENTS.md `## Tools` section references TOOLS.md by absolute path
- [ ] **TOOL-03**: TOOLS.md is not rendered/synced to any CLI target (reference only)

### Repo Identity

- [ ] **REPO-01**: Repo folder renamed from `~/Repos/agents` to `~/Repos/acsync`
- [ ] **REPO-02**: All internal path references updated (`~/Repos/agents` -> `~/Repos/acsync`)
- [ ] **REPO-03**: `acsync` binary re-registered via `bun link` from new location
- [ ] **REPO-04**: `acsync push --force` propagates all path changes to targets
- [ ] **REPO-05**: OpenCode `opencode.json` instructions array points to `AGENTS.md` (not `OPENCODE.md`)
- [ ] **REPO-06**: Stale target files cleaned up: `~/.config/opencode/OPENCODE.md`, `~/.gemini/GEMINI.md`, `~/.codex/instructions.md`

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
| STRUCT-01 | Phase 6 | Complete |
| STRUCT-02 | Phase 6 | Complete |
| STRUCT-03 | Phase 6 | Complete |
| STRUCT-04 | Phase 6 | Complete |
| STRUCT-05 | Phase 6 | Complete |
| INST-01 | Phase 7 | Complete |
| INST-02 | Phase 7 | Complete |
| INST-03 | Phase 7 | Complete |
| INST-04 | Phase 7 | Complete |
| INST-05 | Phase 7 | Complete |
| INST-06 | Phase 7 | Complete |
| INST-07 | Phase 7 | Complete |
| INST-08 | Phase 7 | Complete |
| INST-09 | Phase 7 | Complete |
| INST-10 | Phase 7 | Complete |
| TOOL-01 | Phase 8 | Pending |
| TOOL-02 | Phase 8 | Pending |
| TOOL-03 | Phase 8 | Pending |
| REPO-01 | Phase 8 | Pending |
| REPO-02 | Phase 8 | Pending |
| REPO-03 | Phase 8 | Pending |
| REPO-04 | Phase 8 | Pending |
| REPO-05 | Phase 8 | Pending |
| REPO-06 | Phase 8 | Pending |

**Coverage:**
- v2.0 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after v2.0 initial definition*
