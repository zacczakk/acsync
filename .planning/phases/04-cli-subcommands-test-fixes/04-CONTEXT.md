# Phase 4: CLI Subcommands + Test Fixes - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add `render` and `diff` subcommands to the `acsync` CLI, add `--json` flag across check/push subcommands, and fix 3 test failures (Date.now collision in rollback, skills.test.ts host dependency, general test suite). Gap closure from v1 audit.

</domain>

<decisions>
## Implementation Decisions

### `render` subcommand interface
- Input: `--type` and `--name` flags identify the canonical config (e.g., `acsync render --type command --name plan`)
- Target: renders all 4 targets by default, `--target` flag filters to one
- Output: raw rendered config content to stdout (no JSON wrapping)
- Multi-target output format: Claude's discretion

### `diff` subcommand (distinct from `check`)
- `diff` is a distinct command, not an alias for `check`
- Output: unified diff format (like `git diff`) showing actual line-level changes between rendered canonical and on-disk target
- Accepts same `--target` and `--type` filters as check/push (consistent interface)
- Exit codes: same as check (0=no drift, 1=error, 2=drift detected)
- `diff` always outputs text (unified diff), regardless of `--json` flag

### `--json` flag semantics
- `--json` is meaningful only for `check` and `push` (status/result reporting)
- Does not apply to `render` (outputs raw config content) or `diff` (outputs unified diff text)
- JSON is already default for check/push; `--json` makes this explicit for scripts
- Behavior details: Claude's discretion (no-op vs strict mode)
- `jq` filtering works naturally: `acsync check | jq '.targets.claude'`

### Test fix strategy — fixture-based integration tests
- All integration tests retrofitted to use shared fixture directory (not just skills.test.ts)
- Fixture layout: single shared `test/fixtures/` with canonical + target configs of known content
- No `zz-` prefix, no `zz/` subdirectory in fixtures — reflects current naming conventions (prefix/nesting logic was removed)
- Pattern: copy fixtures to temp dir, run operations, assert exact creates/updates/deletes
- Date.now collision fix: Claude's discretion (counter suffix vs higher-res time)

### Claude's Discretion
- Multi-target render output formatting (headers, separators)
- `--json` precise behavior (pure no-op vs suppress non-JSON output)
- Date.now collision fix implementation detail
- Fixture directory internal structure

</decisions>

<specifics>
## Specific Ideas

- `render` is a debug/preview tool — show what would be written without writing
- `diff` shows why `check` reports drift — the actual content differences
- Fixtures should have configs with known diffs so tests can assert exact operations (creates, removes, modifications) for both push and pull directions
- Pipeline story: `acsync check | jq ...` for machines, `acsync check --pretty` for humans

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-cli-subcommands-test-fixes*
*Context gathered: 2026-02-21*
