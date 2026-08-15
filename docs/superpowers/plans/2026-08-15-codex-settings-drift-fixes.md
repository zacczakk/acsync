# Codex Settings and Drift Fixes Implementation Plan

> For agentic workers: execute tasks in order. Keep this plan updated as work completes.

**Goal:** Make Codex's canonical base configuration use Luna at xhigh reasoning, eliminate false drift against live Codex/OpenCode state, and ensure the CLI reports the package version.

**Architecture:** Keep target-specific rendering in adapters. Compare settings through adapter-provided managed projections and compare MCP through normalized per-server values, so formatting and unrelated co-located state do not create drift. Preserve the existing Tux and Enterprise profiles; keep the current Codex autonomy policy (`never` + `workspace-write`) under canonical ownership.

**Tech Stack:** Bun, TypeScript, smol-toml, JSONC adapters, Bun test.

## Global Constraints

- Use canonical files under `configs/` as the source of truth.
- Preserve unowned target settings and third-party hooks/plugins.
- Do not change OpenCode V1/V2 projection behavior.
- Add regression coverage for every corrected drift class.
- Keep user-specific secrets out of tracked files.

---

## Task 1: Update Codex canonical settings and documentation

**Files:**

- Modify `configs/settings/codex.json`.
- Modify `docs/architecture.md`.

**Steps:**

1. [x] Set the base model to `gpt-5.6-luna` and provider to `tux`.
2. [x] Set base `model_reasoning_effort` to `xhigh`.
3. [x] Canonicalize the existing Codex `approval_policy` and `sandbox_mode` values without changing their runtime behavior.
4. [x] Keep `enterprise` and `tux` profile projections intact.
5. [x] Document that Tux/Luna/xhigh is the base and Enterprise is opt-in.

## Task 2: Make drift comparison semantic

**Files:**

- Add `src/core/hash.ts`.
- Modify `src/adapters/base.ts`.
- Modify `src/adapters/codex.ts`.
- Modify `src/adapters/opencode.ts`.
- Modify `src/cli/check.ts`.
- Add focused adapter/core tests under `src/core/__tests__/` and `src/adapters/__tests__/`.

**Steps:**

1. [x] Add stable normalized hashing for parsed MCP servers.
2. [x] Compare rendered and target MCP configs by server name, preserving target-specific managed options such as OpenCode timeout/codemode.
3. [x] Add a settings comparison projection hook; make Codex compare only managed parsed keys so TOML quoting/order and unowned keys do not cause drift.
4. [x] Use the projection in `runCheck` while leaving OpenCode's existing V1/V2 settings projection behavior unchanged.
5. [x] Add regression tests for no-op formatting/co-located-state changes, single-server drift, and generated skill artifacts.

## Task 3: Derive the CLI version from package metadata

**Files:**

- Add `src/cli/version.ts`.
- Modify `src/cli/index.ts`.
- Add `src/cli/__tests__/version.test.ts`.

**Steps:**

1. [x] Read the package version at module load from the repository package metadata.
2. [x] Pass that value to Commander.
3. [x] Test it against `package.json` so future releases cannot leave a stale hardcoded version.

## Task 4: Apply canonical changes and verify

**Steps:**

1. [x] Run focused unit and integration tests.
2. [x] Run the repository's available checks; no local TypeScript compiler is installed, so Bun transpilation/tests are the type-safety gate.
3. [x] Push the requested Codex settings, MCP, and skill changes to the live target.
4. [x] Re-run Codex and OpenCode checks; confirm no unexpected drift remains.
5. [x] Report intentionally out-of-scope target-specific differences separately.

## Self-Review Checklist

- [x] Codex base is Tux/Luna/xhigh.
- [x] Enterprise remains available by profile.
- [x] Existing Codex safety behavior is preserved and owned.
- [x] MCP drift is per server, not whole-file.
- [x] Codex settings drift ignores formatting noise.
- [x] OpenCode remains semantically aligned.
- [x] CLI version matches `package.json`.
- [x] Focused tests and final live checks pass.
