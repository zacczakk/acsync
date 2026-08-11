# OpenCode Version Switcher Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Metronome command that atomically renders and activates behaviorally compatible OpenCode V1 or V2 configuration bundles.

**Architecture:** Keep the current V1-shaped canonical settings and agent metadata as semantic source. A pure renderer emits either V1 or native V2 shapes; a profile service backs up all managed and discovered plugin inputs, writes the selected config/agents/plugins/package manifest, records hashes and decisions, and optionally aligns the V2 CLI and SDK.

**Tech Stack:** Bun, TypeScript, Commander, OpenCode V1 and V2 plugin APIs.

## Global Constraints

- Preserve unrelated config keys and Tux's V1 provider overlay; native V2 values take precedence.
- Keep Memory instruction files separate from `AGENTS.md`.
- Every Anthropic-package model must have a nonzero `limit.output`.
- Never delete unknown plugins; switch only explicitly owned versioned files.
- Record every switch, backup, rendered hash, plugin status, and SDK version in the OpenCode migration manifest.

---

### Task 1: Pure Version Renderer

**Files:**
- Create: `src/opencode/version-renderer.ts`
- Test: `src/opencode/__tests__/version-renderer.test.ts`

- [x] Render V1 canonical shapes without semantic change.
- [x] Render V2 permissions, agents, providers/models, MCP, plugins, costs, and variants.
- [x] Move per-agent request options to effective model variants rather than inert V2 request overlays.
- [x] Enforce nonzero Anthropic output limits.
- [x] Run `bun test src/opencode/__tests__/version-renderer.test.ts`.

### Task 2: Versioned V2 Plugins

**Files:**
- Create: `configs/opencode/v2/plugins/instructions-loader.ts`
- Create: `configs/opencode/v2/plugins/memory-vault-advisor.ts`
- Create: `configs/opencode/v2/plugins/read-guard.ts`
- Create: `configs/opencode/v2/plugins/validate-commit.ts`
- Create: `configs/opencode/v2/plugins/muxy-notify.js`

- [x] Port tool hooks to `Plugin.define({ id, setup })`.
- [x] Load separate instruction files through `ctx.session.hook("context")`.
- [x] Port Muxy notifications to `ctx.event.subscribe()` with scoped cleanup.
- [x] Leave Cursor and context-mode explicitly unsupported in V2 until their provider/tool contracts have native ports.

### Task 3: Atomic Profile Service

**Files:**
- Create: `src/opencode/profile.ts`
- Test: `src/opencode/__tests__/profile.test.ts`

- [x] Back up config, agents, local plugins, ancestor plugins, and package locks before writes.
- [x] Render and atomically write the selected profile.
- [x] Preserve unknown and external plugins while replacing Metronome-owned versioned plugins.
- [x] Append switch metadata, hashes, plugin compatibility, and package versions to `~/.config/opencode/migration-manifest.json`.
- [x] Align V2 local SDK to the installed global CLI build when requested.
- [x] Run `bun test src/opencode/__tests__/profile.test.ts`.

### Task 4: CLI and Canonical Data

**Files:**
- Create: `src/cli/opencode-version.ts`
- Modify: `src/cli/index.ts`
- Modify: `configs/settings/opencode.json`
- Test: `src/cli/__tests__/opencode-version.test.ts`

- [x] Add `metronome opencode use v1|v2`, `status`, and `update-v2`.
- [x] Add explicit output limits to canonical Anthropic models.
- [x] Verify help, dry-run, status, and isolated-home switching.

### Task 5: Documentation and Verification

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/design/sync-spec.md`
- Modify: `README.md`
- Modify: `docs/changelog.md`

- [x] Document commands, ownership, backup/restore, plugin matrix, instructions workaround, Tux coexistence, and Bun upgrade procedure.
- [x] Run targeted tests, impacted adapter/orchestrator tests, public-repo check, and isolated V1-to-V2-to-V1 round trip.
