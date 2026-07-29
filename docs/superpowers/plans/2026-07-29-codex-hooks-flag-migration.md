# Codex Hooks Flag Migration Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Codex's deprecated `features.codex_hooks` setting with `features.hooks` while migrating existing managed configurations cleanly.

**Architecture:** Keep `configs/settings/codex.json` as the source of truth. The Codex adapter normalizes the deprecated key while rendering and extracting settings, so push removes stale aliases and pull cannot reintroduce them. Fixtures and documentation describe only the canonical setting.

**Tech Stack:** Bun, TypeScript, `smol-toml`, Bun test.

## Global Constraints

- Preserve unrelated user feature flags such as `multi_agent`.
- Do not alter `~/.codex/hooks.json` registrations or hook scripts.
- Do not add dependencies.

---

### Task 1: Normalize the Codex hook feature key

**Files:**
- Modify: `src/adapters/codex.ts`
- Test: `src/adapters/__tests__/codex.test.ts`

**Interfaces:**
- Consumes: `CanonicalSettings.keys.features` and parsed Codex TOML settings.
- Produces: TOML containing `hooks = true` and no `codex_hooks` when the canonical hook feature is managed; extracted canonical settings with the modern key.

- [x] **Step 1: Write failing regression tests**

```ts
expect(result).toContain('hooks = true');
expect(result).not.toContain('codex_hooks');
```

- [x] **Step 2: Run the Codex adapter test file**

Run: `bun test src/adapters/__tests__/codex.test.ts`
Expected: FAIL because the adapter preserves `codex_hooks`.

- [x] **Step 3: Implement key normalization**

```ts
const { codex_hooks: legacyHooks, ...features } = existingFeatures;
if (!('hooks' in features) && typeof legacyHooks === 'boolean') {
  features.hooks = legacyHooks;
}
```

Use the normalized object before merge/render and extraction. The canonical `hooks` value wins when present.

- [x] **Step 4: Re-run the Codex adapter test file**

Run: `bun test src/adapters/__tests__/codex.test.ts`
Expected: PASS.

### Task 2: Update canonical config, fixture coverage, and docs

**Files:**
- Modify: `configs/settings/codex.json`
- Modify: `test/fixtures/canonical/settings/codex.json`
- Modify: `test/fixtures/codex/settings/config.toml`
- Modify: `test/fixtures/seeds/codex/config.toml`
- Modify: `docs/architecture.md`
- Modify: `docs/design/sync-spec.md`

**Interfaces:**
- Consumes: canonical Codex settings and a legacy seeded `config.toml`.
- Produces: a rendered settings fixture using `hooks = true` and documentation matching Codex's current feature name.

- [x] **Step 1: Replace canonical and expected aliases**

```json
{
  "features": {
    "hooks": true
  }
}
```

- [x] **Step 2: Seed the push integration test with the old alias**

```toml
[features]
multi_agent = true
codex_hooks = true
```

The rendered golden must retain `multi_agent` and replace the old alias with `hooks = true`.

- [x] **Step 3: Update Codex hook documentation**

Replace `features.codex_hooks = true` with `features.hooks = true`; retain the `hooks.json` registration description.

- [x] **Step 4: Run targeted and impacted tests**

Run: `bun test src/adapters/__tests__/codex.test.ts test/__tests__/push-settings.test.ts`
Expected: PASS.

- [x] **Step 5: Run the full repository gate**

Run: `bun test && bun scripts/check-public-repo.ts`
Expected: PASS.
