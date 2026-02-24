# Simplify Canonical Structure & Unified AGENTS.md

## Goal

1. Flatten `configs/common/` one level up to `configs/`
2. Move AGENTS.md into `configs/instructions/AGENTS.md`; replace 4 addendums with single file
3. Add canonical `configs/instructions/TOOLS.md` referenced from AGENTS.md
4. Rename repo folder `~/Repos/acsync` -> `~/Repos/acsync`
5. Fix OpenCode `instructions` field in `opencode.json`

---

## Part 1: Flatten `configs/common/` -> `configs/`

### Current

```
configs/
  common/
    agents/
    commands/
    instructions/    <- being removed (Part 2)
    mcp/
    settings/
    skills/
```

### Target

```
configs/
  agents/
  commands/
  instructions/    <- keeps AGENTS.md + TOOLS.md (Part 2/4)
  mcp/
  settings/
  skills/
```

### Files to Update

Source code referencing `configs/common/`:

| File | Lines | Change |
|---|---|---|
| `src/cli/canonical.ts` | 61, 88, 112, 153, 171 | `'configs', 'common', X` -> `'configs', X` |
| `src/cli/render.ts` | 85, 101, 122 | Error messages mentioning `configs/common/` |
| `src/cli/pull.ts` | 58, 367, 370 | Comments and help text |
| `src/cli/index.ts` | 11 | Help text: `configs/common/` |

Tests (check for `configs/common` references):
- `src/cli/__tests__/orchestrator.test.ts`
- `src/cli/__tests__/stale-and-pull.test.ts`
- `src/core/__tests__/rollback.test.ts`

Documentation:
- `AGENTS.md` line 168
- All instruction addendums (being removed anyway)
- `docs/plans/active/vsync-alignment/PLAN.md`

### Steps

1. `mv configs/common/* configs/` then `rmdir configs/common`
2. Update all `join(projectDir, 'configs', 'common', ...)` -> `join(projectDir, 'configs', ...)`
3. Update help text, comments, error messages
4. Update AGENTS.md references
5. Run tests

---

## Part 2: Single Canonical AGENTS.md (No Addendums)

### Current Flow

```
AGENTS.md (base) + configs/common/instructions/{target}.md (addendum)
        |
        v
  BaseAdapter.renderInstructions(base, addendum)
        |
        v  (simple concatenation: base + "\n\n" + addendum + "\n")
  Target file (CLAUDE.md / OPENCODE.md / GEMINI.md / instructions.md)
```

### Target Flow

```
configs/instructions/AGENTS.md (single file, all content)
        |
        v
  BaseAdapter.renderInstructions(content)  -- just writes content as-is
        |
        v
  Target file (see rendering paths below)
```

### Target Rendering Paths

| Target | Current output file | New output file |
|---|---|---|
| claude-code | `~/.claude/CLAUDE.md` | `~/.claude/CLAUDE.md` (unchanged) |
| opencode | `~/.config/opencode/OPENCODE.md` | `~/.config/opencode/AGENTS.md` |
| gemini | `~/.gemini/GEMINI.md` | `~/.gemini/AGENTS.md` |
| codex | `~/.codex/instructions.md` | `~/.codex/AGENTS.md` |

Note: Claude keeps `CLAUDE.md` — Claude Code specifically looks for this filename.

### Addendum Content to Merge into AGENTS.md

Review each addendum for unique content worth keeping:

**claude.md** (26 lines):
- `## Paths` — canonical/rendered paths -> updating for new structure; merge into AGENTS.md
- `## Web Access` — "WebFetch blocked (corporate proxy)" -> already in AGENTS.md line 24
- `## SSL Certificates` — `cacert.pem` path -> Claude-specific; move to AGENTS.md
- `## MCPorter` — pointer to `## Tools` -> redundant; drop
- `## Config Management` — generic; already in AGENTS.md -> drop

**opencode.md** (28 lines):
- `## Paths` — same pattern; merge
- `## Naming Quirks` — OpenCode-specific format details -> useful for agents working on acsync itself; keep in AGENTS.md or TOOLS.md
- `## Web Access` — "WebFetch works" -> already in AGENTS.md line 24
- `## Config Management` — duplicate; drop

**gemini.md** (20 lines):
- `## Paths` — same pattern; merge
- `## Notes` — Gemini-specific settings -> niche; keep if useful
- `## Config Management` — duplicate; drop

**codex.md** (21 lines):
- `## Paths` — same pattern; merge
- `## Helpers and Sync Discipline` — generic; already covered -> drop
- `## Config Management` — duplicate; drop

### Move AGENTS.md

After Part 1 flatten, move `AGENTS.md` from repo root to `configs/instructions/AGENTS.md`:

```
mv AGENTS.md configs/instructions/AGENTS.md
```

Update `canonical.ts` to read from the new location (see Source Code Changes below).

### What to Add to AGENTS.md

New section replacing per-CLI addendums:

```markdown
## CLI-Specific Notes

### Claude Code
- Instructions file: `~/.claude/CLAUDE.md`
- WebFetch blocked (corporate proxy); use Tavily MCP (`mcp__tavily_*`).
- SSL: `SSL_CERT_FILE` + `NODE_EXTRA_CA_CERTS` -> `~/.claude/cacert.pem` (set in `~/.claude/settings.json` `env` key).

### OpenCode
- Instructions file: `~/.config/opencode/AGENTS.md`
- Naming: singular dirs (`command/`, `skill/`), MCP env key `environment`, transport `local`/`remote`, command as array, env vars `{env:VAR}`.
- WebFetch works; Tavily via search tool (no native MCP).

### Gemini
- Instructions file: `~/.gemini/AGENTS.md`
- Subagents: `experimental.enableAgents = true` in `~/.gemini/settings.json`.
- Context: primary `AGENTS.md`; fallback `GEMINI.md`.

### Codex
- Instructions file: `~/.codex/AGENTS.md`
- Multi-agent: `[agents]` TOML in `config.toml` (experimental).
```

### Source Code Changes

| File | Change |
|---|---|
| `src/cli/canonical.ts:140-162` | `readCanonicalInstructions()` — remove addendum logic; read `configs/instructions/AGENTS.md` |
| `src/adapters/base.ts:207` | `renderInstructions(base, addendum)` -> `renderInstructions(content)` |
| `src/adapters/path-resolver.ts:97-103` | Update `rawInstructionsPath()` for opencode/gemini/codex |
| `src/cli/check.ts` | Remove instruction addendum from hash computation |
| `src/cli/diff.ts:91-94` | Simplify instructions rendering |
| `src/cli/render.ts:76-81` | Simplify instructions rendering |
| `src/types.ts` | Remove `instruction` from `ItemType` if simplifying (or keep as single item) |
| `src/cli/push.ts` | Simplify instruction write path |

### OpenCode `opencode.json` Fix

Current (`~/.config/opencode/opencode.json` line 109-111):
```json
"instructions": [
  "/Users/m332023/.config/opencode/OPENCODE.md"
]
```

New:
```json
"instructions": [
  "/Users/m332023/.config/opencode/AGENTS.md"
]
```

This is in the **rendered** settings file. The **canonical** settings template (`configs/settings/opencode.json`, post-flatten) should also be updated if it contains this path. Check and update both.

### Files to Delete

After Part 1 flatten, these are at their new paths:
- `configs/instructions/claude.md`
- `configs/instructions/opencode.md`
- `configs/instructions/gemini.md`
- `configs/instructions/codex.md`

Note: `configs/instructions/` directory is kept — it holds `AGENTS.md` and `TOOLS.md` (Part 4).

### Stale Target Files to Clean Up

After push, manually remove old instruction files that are no longer rendered:
- `~/.config/opencode/OPENCODE.md` (replaced by `AGENTS.md`)
- `~/.gemini/GEMINI.md` (replaced by `AGENTS.md`)
- `~/.codex/instructions.md` (replaced by `AGENTS.md`)

---

## Part 3: Rename `~/Repos/acsync` -> `~/Repos/acsync`

### Steps

1. `mv ~/Repos/acsync ~/Repos/acsync`
2. Find-replace `~/Repos/acsync` -> `~/Repos/acsync` in all canonical files:
   - `configs/instructions/AGENTS.md` (~3 refs)
   - `docs/subagent.md` (1 ref)
   - Agent markdown files in `configs/agents/` (8 files, 1 ref each: `~/Repos/acsync/AGENTS.md`)
3. `cd ~/Repos/acsync && bun link` (re-register binary)
4. `acsync push --force` (propagates path changes to all targets)
5. Optionally update `.planning/` docs (low priority; historical)

### Git Remote

No change needed. `https://github.com/zacczakk/agents.git` stays valid — local folder name is independent.

---

## Part 4: Canonical TOOLS.md

### Purpose

Single file for tool-use instructions. Referenced from AGENTS.md `## Tools` section.
User fills with detailed usage for: acsync, mcporter, obsidian CLI, committer, browser-tools, etc.

### Location

`configs/instructions/TOOLS.md` — lives alongside AGENTS.md in the canonical instructions dir.
Synced via acsync to all 4 targets alongside the main instructions file.

After Part 1 flatten + Part 3 rename, the full path is `~/Repos/acsync/configs/instructions/TOOLS.md`.

This means the `configs/instructions/` directory is NOT deleted in Part 2 — the 4 per-CLI
addendum files are removed but the directory stays to hold AGENTS.md and TOOLS.md.

### Rendering

TOOLS.md needs its own rendering path in acsync. Options:

**A) Render as a second instructions file** — extend `readCanonicalInstructions()` to also
read `configs/instructions/TOOLS.md` and write it alongside the main instructions file.
Each target gets `TOOLS.md` in its config dir (e.g. `~/.claude/TOOLS.md`,
`~/.config/opencode/TOOLS.md`, `~/.codex/TOOLS.md`, `~/.gemini/TOOLS.md`).

**B) Just reference by path** — AGENTS.md contains
`Read ~/Repos/acsync/configs/instructions/TOOLS.md for detailed tool-use instructions.`
Agents read it directly from the repo. No rendering needed.

Recommend **A** for portability — agents working outside the acsync repo still get tool docs.
But **B** is simpler and fine if all agents always have access to `~/Repos/acsync`.

Decision: user to confirm. Plan assumes **A** for now.

### AGENTS.md Reference

Replace current `## Tools` section's first line:
```markdown
## Tools
Read `TOOLS.md` for detailed tool-use instructions.
```

Keep the brief tool index in AGENTS.md (acsync, committer, trash, etc.) but move detailed
usage/examples to TOOLS.md.

### Implementation

1. Create `configs/instructions/TOOLS.md` (user fills content)
2. Move detailed tool docs from `docs/tools.md` and AGENTS.md tool entries
3. Add rendering support: `readCanonicalTools()` + write to each target's config dir
4. Update AGENTS.md `## Tools` to reference it
5. Update `AdapterPathResolver` with `getToolsPath()` if rendering (option A)

---

## Execution Order

1. Flatten `configs/common/` -> `configs/` (Part 1)
2. Merge addendums into AGENTS.md + update rendering (Part 2)
3. Create TOOLS.md (Part 4)
4. Rename folder (Part 3) — last, since it affects all path references
5. `bun link` + `acsync push --force --delete`
6. Clean up stale target files

---

## Verification

- [ ] `acsync check` reports zero drift after push
- [ ] `acsync check --type instructions` works with single-file model
- [ ] `~/.claude/CLAUDE.md` contains full AGENTS.md content (no addendum)
- [ ] `~/.config/opencode/AGENTS.md` exists and contains full content
- [ ] `~/.gemini/AGENTS.md` exists and contains full content
- [ ] `~/.codex/AGENTS.md` exists and contains full content
- [ ] `~/.config/opencode/opencode.json` instructions points to `AGENTS.md`
- [ ] Old files removed: `OPENCODE.md`, `GEMINI.md`, `instructions.md`
- [ ] `configs/common/` directory no longer exists
- [ ] `configs/instructions/AGENTS.md` exists (moved from repo root)
- [ ] No `AGENTS.md` at repo root
- [ ] `configs/instructions/` contains `AGENTS.md` and `TOOLS.md` (no per-CLI addendums)
- [ ] All existing tests pass
- [ ] `acsync` binary works from PATH after `bun link` in new location
- [ ] `configs/instructions/TOOLS.md` exists, referenced from AGENTS.md
- [ ] TOOLS.md rendered to all 4 target config dirs (if option A)

## Progress Log

- 2026-02-23: Research complete. Full impact analysis done. Plan written.
- 2026-02-23: Fixed plan inconsistencies — AGENTS.md location now consistently `configs/instructions/AGENTS.md` throughout all parts. Added explicit move step. Updated file-to-delete paths to post-flatten. Removed hedging note in Part 4.
