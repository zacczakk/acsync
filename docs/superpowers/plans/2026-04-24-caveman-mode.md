# Caveman Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a centrally managed sticky `caveman` mode for Codex, Claude Code, and OpenCode with explicit `/caveman` activation, `lite|full|ultra` intensities, explicit `/caveman off|stop` disable commands, and per-target persisted session state.

**Architecture:** Keep one canonical source of truth for caveman behavior in `configs/skills/caveman/SKILL.md` plus one small canonical config in `configs/settings/caveman.json`. Put parsing, state-file safety, skill filtering, and reinforcement generation in a shared Node helper under `configs/hooks/`, then wire thin target-specific entrypoints: Codex standalone hook config, Claude managed hooks inside settings, and an OpenCode plugin that tracks prompts and injects context as closely as the plugin API allows.

**Tech Stack:** TypeScript/Bun CLI, JSON/TOML/JSONC settings rendering, Node hook scripts, OpenCode plugin API, Bun test runner, fixture-driven sync tests

---

## File Map

- Create: `configs/skills/caveman/SKILL.md`
  - canonical caveman skill with description, trigger text, intensity table, examples, carve-outs, and machine-parseable level sections
- Create: `configs/settings/caveman.json`
  - canonical caveman runtime config with `defaultMode`, `targets`, and `naturalLanguageActivation`
- Create: `configs/hooks/caveman-shared.js`
  - shared runtime helper for config load, command parsing, alias parsing, safe state file IO, skill frontmatter stripping, level filtering, and reinforcement rendering
- Create: `configs/hooks/caveman-sessionstart-codex.js`
  - Codex `SessionStart` entrypoint that emits `additionalContext` when default or saved caveman mode is active
- Create: `configs/hooks/caveman-userprompt-codex.js`
  - Codex `UserPromptSubmit` entrypoint that updates state and emits compact reinforcement
- Create: `configs/hooks/caveman-sessionstart-claude.js`
  - Claude `SessionStart` entrypoint mirroring Codex behavior
- Create: `configs/hooks/caveman-userprompt-claude.js`
  - Claude `UserPromptSubmit` entrypoint mirroring Codex behavior
- Create: `configs/plugins/caveman-opencode.ts`
  - OpenCode plugin that parses outgoing prompts, updates state, and injects hidden/system context on active turns via the plugin event surface
- Modify: `configs/hook-configs/codex.json`
  - add Codex caveman hooks alongside the existing vault-context loader
- Modify: `configs/settings/claude.json`
  - add managed `UserPromptSubmit` and `SessionStart` caveman hooks without disturbing existing managed hook groups
- Modify: `configs/settings/opencode.json`
  - add `caveman-opencode` to the deployed plugin list while preserving existing plugin entries
- Modify: `docs/architecture.md`
  - document caveman shared helper plus target wiring model
- Modify: `docs/design/sync-spec.md`
  - document canonical caveman assets and target sync behavior
- Modify: `src/adapters/path-resolver.ts`
  - add a helper for per-target caveman state file paths so tests and runtime code share exact paths
- Create: `src/runtime/caveman-paths.ts`
  - small TypeScript utility mirroring the runtime state-file locations for tests and future adapter-facing use
- Create: `src/runtime/__tests__/caveman-paths.test.ts`
  - state-path assertions for Claude, Codex, and OpenCode
- Create: `src/runtime/__tests__/caveman-shared.test.ts`
  - unit tests for state parsing, command parsing, alias parsing, and `SKILL.md` filtering behavior
- Modify: `test/__tests__/push-codex-hooks.test.ts`
  - extend goldens for Codex caveman hooks
- Modify: `test/__tests__/push-settings.test.ts`
  - extend OpenCode and Claude golden checks for caveman plugin/hook registration
- Create: `test/__tests__/push-plugins.test.ts`
  - OpenCode plugin deployment/idempotency test for canonical plugins including `caveman-opencode`
- Create: `test/__tests__/runtime-caveman-hooks.test.ts`
  - execute hook scripts directly with sample stdin payloads and assert emitted JSON + state file behavior
- Create: `test/fixtures/canonical/settings/caveman.json`
  - canonical caveman config fixture for isolated test projects
- Create: `test/fixtures/codex/hooks/hooks.json`
  - updated Codex hook golden with caveman registration
- Modify: `test/fixtures/claude/settings/settings.json`
  - updated Claude settings golden with caveman managed hooks
- Modify: `test/fixtures/opencode/settings/opencode.json`
  - updated OpenCode settings golden with `caveman-opencode` plugin in the list
- Create: `test/fixtures/opencode/plugins/caveman-opencode.ts`
  - OpenCode plugin golden
- Modify: `test/fixtures/seeds/claude/settings.json`
  - keep Claude seed aligned with managed hook merge expectations
- Modify: `test/fixtures/seeds/opencode/settings.jsonc`
  - keep OpenCode seed aligned with plugin-list merge expectations

## Task 1: Add Canonical Caveman Skill and Config

**Files:**
- Create: `configs/skills/caveman/SKILL.md`
- Create: `configs/settings/caveman.json`
- Create: `test/fixtures/canonical/settings/caveman.json`
- Test: `configs/skills/caveman/SKILL.md`
- Test: `configs/settings/caveman.json`

- [ ] **Step 1: Write the canonical caveman skill with machine-parseable level sections**

Create `configs/skills/caveman/SKILL.md` with this content:

```md
---
name: caveman
description: >-
  Optional compressed-response mode. Use when the user explicitly activates
  `/caveman`, `/caveman lite`, `/caveman full`, or `/caveman ultra`. The mode is
  sticky for the session until `/caveman off` or `/caveman stop`.
---

# Caveman Mode

Compressed voice mode. User-controlled only. Sticky per session.

## Commands

- `/caveman` -> activate configured default level
- `/caveman lite`
- `/caveman full`
- `/caveman ultra`
- `/caveman off`
- `/caveman stop`

## Boundaries

- No startup always-on persona override
- No code-style changes
- No commit-message changes
- No PR-text changes
- No compression when clarity matters more than brevity

## Auto Clarity

Temporarily fall back to normal clarity for:

- security warnings
- destructive or irreversible actions
- multi-step procedures where compression risks ambiguity
- explicit user requests for clarification

## Intensities

| level | style | allowed detail |
|-------|-------|----------------|
| lite | terse but grammatical | short sentences, keep connectors |
| full | telegraph default | noun phrases ok, drop filler |
| ultra | maximal compression | fragments ok, only if still unambiguous |

## Level Rules

### lite

- Use short sentences.
- Keep grammar intact.
- Cut filler, not meaning.

### full

- Telegraph style.
- Noun phrases ok.
- Drop articles and filler when safe.

### ultra

- Max compression.
- Fragments ok.
- Prefer shortest unambiguous wording.

## Examples

### lite

- "Found root cause. Patching parser now."
- "Tests pass locally. One docs update left."

### full

- "Root cause found. Parser patching now."
- "Local pass. One docs update left."

### ultra

- "Root cause found. Patching."
- "Local pass. Docs left."
```

- [ ] **Step 2: Add canonical caveman config with explicit v1 defaults**

Create `configs/settings/caveman.json` and matching fixture `test/fixtures/canonical/settings/caveman.json` with this JSON:

```json
{
  "defaultMode": "off",
  "targets": ["opencode", "claude-code", "codex"],
  "naturalLanguageActivation": false
}
```

- [ ] **Step 3: Verify the canonical assets contain all v1 contract points**

Run:

```bash
rg -n "defaultMode|naturalLanguageActivation|/caveman off|/caveman stop|Auto Clarity|### lite|### full|### ultra" configs/settings/caveman.json configs/skills/caveman/SKILL.md
```

Expected:

```text
matches for defaultMode off, naturalLanguageActivation false, explicit off/stop commands, Auto Clarity, and all three level sections
```

- [ ] **Step 4: Commit canonical caveman assets**

Run:

```bash
git add configs/skills/caveman/SKILL.md configs/settings/caveman.json test/fixtures/canonical/settings/caveman.json
git commit -m "feat: add canonical caveman mode assets"
```

Expected:

```text
a new commit containing only the canonical skill and config files
```

## Task 2: Build Shared Caveman Runtime Helper and Path Utilities

**Files:**
- Create: `configs/hooks/caveman-shared.js`
- Modify: `src/adapters/path-resolver.ts`
- Create: `src/runtime/caveman-paths.ts`
- Create: `src/runtime/__tests__/caveman-paths.test.ts`
- Create: `src/runtime/__tests__/caveman-shared.test.ts`
- Test: `configs/hooks/caveman-shared.js`

- [ ] **Step 1: Add target state-path helpers in TypeScript for testable path parity**

Create `src/runtime/caveman-paths.ts` with this code:

```ts
import path from 'node:path';
import type { TargetName } from '../types';

export function getCavemanStatePath(target: Extract<TargetName, 'claude-code' | 'codex' | 'opencode'>, homeDir: string): string {
  switch (target) {
    case 'claude-code':
      return path.join(homeDir, '.claude', '.caveman-active');
    case 'codex':
      return path.join(homeDir, '.codex', '.caveman-active');
    case 'opencode':
      return path.join(homeDir, '.config', 'opencode', '.caveman-active');
  }
}
```

- [ ] **Step 2: Mirror the same path helper in `AdapterPathResolver`**

Update `src/adapters/path-resolver.ts` by adding this public method:

```ts
  getCavemanStatePath(): string {
    return this.expandHome(this.rawCavemanStatePath());
  }
```

and this private helper near the other `raw*Path()` methods:

```ts
  private rawCavemanStatePath(): string {
    switch (this.target) {
      case 'claude-code': return '~/.claude/.caveman-active';
      case 'opencode':    return '~/.config/opencode/.caveman-active';
      case 'codex':       return '~/.codex/.caveman-active';
      default:            throw new Error(`caveman state unsupported for ${this.target}`);
    }
  }
```

- [ ] **Step 3: Add the shared runtime helper used by all target entrypoints**

Create `configs/hooks/caveman-shared.js` with this code:

```js
const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_MODES = new Set(['off', 'lite', 'full', 'ultra']);

function repoRoot() {
  return path.join(os.homedir(), 'Repos', 'zacczakk', 'metronome');
}

function cavemanConfigPath() {
  return path.join(repoRoot(), 'configs', 'settings', 'caveman.json');
}

function cavemanSkillPath() {
  return path.join(repoRoot(), 'configs', 'skills', 'caveman', 'SKILL.md');
}

function readCavemanConfig() {
  const raw = fs.readFileSync(cavemanConfigPath(), 'utf8');
  const parsed = JSON.parse(raw);
  return {
    defaultMode: VALID_MODES.has(parsed.defaultMode) ? parsed.defaultMode : 'off',
    targets: Array.isArray(parsed.targets) ? parsed.targets.filter(Boolean) : [],
    naturalLanguageActivation: parsed.naturalLanguageActivation === true,
  };
}

function parseRequestedMode(text) {
  const input = String(text || '').trim().toLowerCase();
  if (input === '/caveman') return { kind: 'activate-default' };
  const match = /^\/caveman\s+(lite|full|ultra|off|stop)$/.exec(input);
  if (match) {
    return match[1] === 'off' || match[1] === 'stop'
      ? { kind: 'deactivate', mode: 'off' }
      : { kind: 'activate-explicit', mode: match[1] };
  }
  if (input === 'stop caveman' || input === 'normal mode') {
    return { kind: 'deactivate', mode: 'off' };
  }
  return null;
}

function readState(statePath) {
  try {
    const value = fs.readFileSync(statePath, 'utf8').trim();
    if (value.length > 16) return 'off';
    return VALID_MODES.has(value) ? value : 'off';
  } catch {
    return 'off';
  }
}

function writeState(statePath, mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, VALID_MODES.has(mode) ? mode : 'off');
}

function stripFrontmatter(raw) {
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

function extractSection(body, heading) {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = pattern.exec(body);
  return match ? match[1].trim() : '';
}

function extractLevelBlock(body, level) {
  const pattern = new RegExp(`### ${level}\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`);
  const match = pattern.exec(body);
  return match ? match[1].trim() : '';
}

function renderActiveContext(level) {
  if (!VALID_MODES.has(level) || level === 'off') return '';
  const body = stripFrontmatter(fs.readFileSync(cavemanSkillPath(), 'utf8'));
  const boundaries = extractSection(body, 'Boundaries');
  const clarity = extractSection(body, 'Auto Clarity');
  const rules = extractLevelBlock(body, level);
  const examplesSection = extractSection(body, 'Examples');
  const examples = extractLevelBlock(`## Examples\n${examplesSection}`, level);
  return [
    'CAVEMAN MODE ACTIVE',
    `level: ${level}`,
    '',
    'Boundaries:',
    boundaries,
    '',
    'Auto Clarity:',
    clarity,
    '',
    `Level Rules (${level}):`,
    rules,
    '',
    `Examples (${level}):`,
    examples,
  ].join('\n');
}

function renderReminder(level) {
  if (!VALID_MODES.has(level) || level === 'off') return '';
  return `CAVEMAN REMINDER: level=${level}. Compressed reply style active. Use normal clarity for safety, destructive actions, multi-step ambiguity, or explicit clarification requests.`;
}

module.exports = {
  VALID_MODES,
  readCavemanConfig,
  parseRequestedMode,
  readState,
  writeState,
  renderActiveContext,
  renderReminder,
};
```

- [ ] **Step 4: Cover path resolution and parsing behavior with focused unit tests**

Create `src/runtime/__tests__/caveman-paths.test.ts` with:

```ts
import { describe, expect, test } from 'bun:test';
import { getCavemanStatePath } from '../caveman-paths';

describe('getCavemanStatePath', () => {
  test('returns per-target paths', () => {
    expect(getCavemanStatePath('claude-code', '/tmp/home')).toBe('/tmp/home/.claude/.caveman-active');
    expect(getCavemanStatePath('codex', '/tmp/home')).toBe('/tmp/home/.codex/.caveman-active');
    expect(getCavemanStatePath('opencode', '/tmp/home')).toBe('/tmp/home/.config/opencode/.caveman-active');
  });
});
```

Create `src/runtime/__tests__/caveman-shared.test.ts` with:

```ts
import { describe, expect, test } from 'bun:test';
import shared from '../../configs/hooks/caveman-shared.js';

describe('parseRequestedMode', () => {
  test('parses slash activation and deactivation commands', () => {
    expect(shared.parseRequestedMode('/caveman')).toEqual({ kind: 'activate-default' });
    expect(shared.parseRequestedMode('/caveman lite')).toEqual({ kind: 'activate-explicit', mode: 'lite' });
    expect(shared.parseRequestedMode('/caveman stop')).toEqual({ kind: 'deactivate', mode: 'off' });
  });

  test('parses natural language deactivation aliases only', () => {
    expect(shared.parseRequestedMode('normal mode')).toEqual({ kind: 'deactivate', mode: 'off' });
    expect(shared.parseRequestedMode('stop caveman')).toEqual({ kind: 'deactivate', mode: 'off' });
    expect(shared.parseRequestedMode('please go caveman')).toBeNull();
  });
});
```

- [ ] **Step 5: Run the new focused unit tests and keep them failing only for real gaps**

Run:

```bash
bun test src/runtime/__tests__/caveman-paths.test.ts src/runtime/__tests__/caveman-shared.test.ts
```

Expected:

```text
both test files pass; if they fail, only on missing exports or parser mismatches introduced in this task
```

- [ ] **Step 6: Commit the shared runtime layer**

Run:

```bash
git add configs/hooks/caveman-shared.js src/adapters/path-resolver.ts src/runtime/caveman-paths.ts src/runtime/__tests__/caveman-paths.test.ts src/runtime/__tests__/caveman-shared.test.ts
git commit -m "feat: add shared caveman runtime helpers"
```

Expected:

```text
a new commit with shared helper logic, state-path support, and unit tests
```

## Task 3: Wire Codex Caveman Hooks

**Files:**
- Create: `configs/hooks/caveman-sessionstart-codex.js`
- Create: `configs/hooks/caveman-userprompt-codex.js`
- Modify: `configs/hook-configs/codex.json`
- Modify: `test/fixtures/codex/hooks/hooks.json`
- Modify: `test/__tests__/push-codex-hooks.test.ts`
- Test: `configs/hooks/caveman-sessionstart-codex.js`
- Test: `configs/hooks/caveman-userprompt-codex.js`

- [ ] **Step 1: Add Codex `SessionStart` caveman entrypoint**

Create `configs/hooks/caveman-sessionstart-codex.js` with:

```js
#!/usr/bin/env node
const os = require('os');
const path = require('path');
const { readCavemanConfig, readState, renderActiveContext } = require('./caveman-shared');

const statePath = path.join(os.homedir(), '.codex', '.caveman-active');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  const config = readCavemanConfig();
  const activeMode = readState(statePath);
  const mode = activeMode !== 'off' ? activeMode : config.defaultMode;
  const additionalContext = renderActiveContext(mode);
  if (!additionalContext) process.exit(0);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  }));
});
```

- [ ] **Step 2: Add Codex `UserPromptSubmit` caveman entrypoint**

Create `configs/hooks/caveman-userprompt-codex.js` with:

```js
#!/usr/bin/env node
const os = require('os');
const path = require('path');
const { readCavemanConfig, parseRequestedMode, readState, writeState, renderReminder } = require('./caveman-shared');

const statePath = path.join(os.homedir(), '.codex', '.caveman-active');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  const payload = input ? JSON.parse(input) : {};
  const prompt = String(payload.prompt ?? payload.userPrompt ?? '');
  const parsed = parseRequestedMode(prompt);
  const config = readCavemanConfig();

  if (parsed?.kind === 'activate-default') {
    writeState(statePath, config.defaultMode === 'off' ? 'full' : config.defaultMode);
  } else if (parsed?.kind === 'activate-explicit') {
    writeState(statePath, parsed.mode);
  } else if (parsed?.kind === 'deactivate') {
    writeState(statePath, 'off');
  }

  const active = readState(statePath);
  const additionalContext = renderReminder(active);
  if (!additionalContext) process.exit(0);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  }));
});
```

- [ ] **Step 3: Register both Codex caveman hooks in the canonical hook config and fixture**

Update `configs/hook-configs/codex.json` and `test/fixtures/codex/hooks/hooks.json` to this shape:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/Repos/zacczakk/metronome/configs/hooks/vault-context-loader-codex.js\""
          },
          {
            "type": "command",
            "command": "node \"$HOME/Repos/zacczakk/metronome/configs/hooks/caveman-sessionstart-codex.js\""
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$HOME/Repos/zacczakk/metronome/configs/hooks/caveman-userprompt-codex.js\""
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Tighten the Codex E2E push test around the new hook entries**

Add these assertions to `test/__tests__/push-codex-hooks.test.ts` after the golden comparison:

```ts
expect(hooksActual).toContain('caveman-sessionstart-codex.js');
expect(hooksActual).toContain('caveman-userprompt-codex.js');
expect(hooksActual).toContain('UserPromptSubmit');
```

- [ ] **Step 5: Run the focused Codex hook push test**

Run:

```bash
bun test test/__tests__/push-codex-hooks.test.ts
```

Expected:

```text
the Codex hook push test passes and the written hooks.json matches the updated golden fixture
```

- [ ] **Step 6: Commit the Codex wiring**

Run:

```bash
git add configs/hooks/caveman-sessionstart-codex.js configs/hooks/caveman-userprompt-codex.js configs/hook-configs/codex.json test/fixtures/codex/hooks/hooks.json test/__tests__/push-codex-hooks.test.ts
git commit -m "feat: wire caveman hooks for codex"
```

Expected:

```text
a new commit covering only the Codex hook entrypoints, registration, and tests
```

## Task 4: Wire Claude Caveman Hooks Through Managed Settings

**Files:**
- Create: `configs/hooks/caveman-sessionstart-claude.js`
- Create: `configs/hooks/caveman-userprompt-claude.js`
- Modify: `configs/settings/claude.json`
- Modify: `test/fixtures/claude/settings/settings.json`
- Modify: `test/__tests__/push-settings.test.ts`

- [ ] **Step 1: Add the Claude `SessionStart` caveman hook entrypoint**

Create `configs/hooks/caveman-sessionstart-claude.js` with:

```js
#!/usr/bin/env node
const os = require('os');
const path = require('path');
const { readCavemanConfig, readState, renderActiveContext } = require('./caveman-shared');

const statePath = path.join(os.homedir(), '.claude', '.caveman-active');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  const config = readCavemanConfig();
  const activeMode = readState(statePath);
  const mode = activeMode !== 'off' ? activeMode : config.defaultMode;
  const additionalContext = renderActiveContext(mode);
  if (!additionalContext) process.exit(0);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  }));
});
```

- [ ] **Step 2: Add the Claude `UserPromptSubmit` caveman hook entrypoint**

Create `configs/hooks/caveman-userprompt-claude.js` with:

```js
#!/usr/bin/env node
const os = require('os');
const path = require('path');
const { readCavemanConfig, parseRequestedMode, readState, writeState, renderReminder } = require('./caveman-shared');

const statePath = path.join(os.homedir(), '.claude', '.caveman-active');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  const payload = input ? JSON.parse(input) : {};
  const prompt = String(payload.prompt ?? payload.userPrompt ?? '');
  const parsed = parseRequestedMode(prompt);
  const config = readCavemanConfig();

  if (parsed?.kind === 'activate-default') {
    writeState(statePath, config.defaultMode === 'off' ? 'full' : config.defaultMode);
  } else if (parsed?.kind === 'activate-explicit') {
    writeState(statePath, parsed.mode);
  } else if (parsed?.kind === 'deactivate') {
    writeState(statePath, 'off');
  }

  const active = readState(statePath);
  const additionalContext = renderReminder(active);
  if (!additionalContext) process.exit(0);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext,
    },
  }));
});
```

- [ ] **Step 3: Register both caveman hooks inside managed Claude settings**

Update `configs/settings/claude.json` and `test/fixtures/claude/settings/settings.json` by inserting these managed hook groups:

```json
"SessionStart": [
  {
    "_managed": "metronome",
    "hooks": [
      {
        "type": "command",
        "command": "node \"$HOME/Repos/zacczakk/metronome/configs/hooks/vault-context-loader.js\""
      }
    ]
  },
  {
    "_managed": "metronome",
    "hooks": [
      {
        "type": "command",
        "command": "node \"$HOME/Repos/zacczakk/metronome/configs/hooks/caveman-sessionstart-claude.js\""
      }
    ]
  }
],
"UserPromptSubmit": [
  {
    "_managed": "metronome",
    "hooks": [
      {
        "type": "command",
        "command": "node \"$HOME/Repos/zacczakk/metronome/configs/hooks/caveman-userprompt-claude.js\""
      }
    ]
  }
]
```

- [ ] **Step 4: Extend settings push coverage for Claude caveman hooks**

Add these assertions to `test/__tests__/push-settings.test.ts` after the Claude golden comparison:

```ts
expect(claudeActual).toContain('caveman-sessionstart-claude.js');
expect(claudeActual).toContain('caveman-userprompt-claude.js');
expect(claudeActual).toContain('"UserPromptSubmit"');
```

- [ ] **Step 5: Run the focused settings push test**

Run:

```bash
bun test test/__tests__/push-settings.test.ts
```

Expected:

```text
the multi-target settings push test passes, preserving non-canonical keys while adding the Claude caveman hook groups
```

- [ ] **Step 6: Commit the Claude wiring**

Run:

```bash
git add configs/hooks/caveman-sessionstart-claude.js configs/hooks/caveman-userprompt-claude.js configs/settings/claude.json test/fixtures/claude/settings/settings.json test/__tests__/push-settings.test.ts
git commit -m "feat: wire caveman hooks for claude code"
```

Expected:

```text
a new commit covering Claude hook entrypoints, managed hook registration, and updated settings tests
```

## Task 5: Add OpenCode Caveman Plugin and Plugin Deployment Coverage

**Files:**
- Create: `configs/plugins/caveman-opencode.ts`
- Modify: `configs/settings/opencode.json`
- Modify: `test/fixtures/opencode/settings/opencode.json`
- Create: `test/fixtures/opencode/plugins/caveman-opencode.ts`
- Create: `test/__tests__/push-plugins.test.ts`

- [ ] **Step 1: Add the OpenCode caveman plugin using the existing plugin API style**

Create `configs/plugins/caveman-opencode.ts` with this code:

```ts
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { Plugin } from '@opencode-ai/plugin'

const VALID = new Set(['off', 'lite', 'full', 'ultra'])
const STATE_PATH = path.join(os.homedir(), '.config', 'opencode', '.caveman-active')

function readState() {
  try {
    const value = fs.readFileSync(STATE_PATH, 'utf8').trim()
    return VALID.has(value) ? value : 'off'
  } catch {
    return 'off'
  }
}

function writeState(mode: string) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  fs.writeFileSync(STATE_PATH, VALID.has(mode) ? mode : 'off')
}

function parsePrompt(text: string) {
  const input = text.trim().toLowerCase()
  if (input === '/caveman') return { kind: 'activate-default' as const }
  const match = /^\/caveman\s+(lite|full|ultra|off|stop)$/.exec(input)
  if (match) {
    return match[1] === 'off' || match[1] === 'stop'
      ? { kind: 'deactivate' as const, mode: 'off' }
      : { kind: 'activate-explicit' as const, mode: match[1] }
  }
  if (input === 'stop caveman' || input === 'normal mode') {
    return { kind: 'deactivate' as const, mode: 'off' }
  }
  return null
}

export const CavemanOpenCodePlugin: Plugin = async () => {
  return {
    event: async ({ event, session }) => {
      if (event.type !== 'message.user') return
      const text = String(event.properties.message?.content ?? '')
      const parsed = parsePrompt(text)
      if (parsed?.kind === 'activate-default') writeState('full')
      if (parsed?.kind === 'activate-explicit') writeState(parsed.mode)
      if (parsed?.kind === 'deactivate') writeState('off')

      const active = readState()
      if (active === 'off') return

      await session.patch({
        context: {
          additional: `CAVEMAN REMINDER: level=${active}. Compressed replies active. Use normal clarity for safety, destructive actions, ambiguity, or explicit clarification requests.`,
        },
      })
    },
  }
}
```

- [ ] **Step 2: Register the plugin in canonical and golden OpenCode settings**

Update `configs/settings/opencode.json` and `test/fixtures/opencode/settings/opencode.json` so the plugin list becomes:

```json
"plugin": [
  "opencode-agent-browser",
  "opencode-cursor-oauth",
  "caveman-opencode"
]
```

- [ ] **Step 3: Add a plugin golden and E2E deployment test**

Create `test/__tests__/push-plugins.test.ts` with:

```ts
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

describe('push plugins E2E', () => {
  test('pushes opencode plugins matching goldens', async () => {
    const fakeHome = createTestHome('push-plugins');
    const projectDir = createTestProject('push-plugins', FIXTURE_ROOT);

    const result = await runPush({ projectDir, force: true, targets: ['opencode'], types: ['plugin'], homeDir: fakeHome });

    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);

    const actual = readFileSync(join(fakeHome, '.config', 'opencode', 'plugins', 'caveman-opencode.ts'), 'utf-8');
    const golden = readFileSync(join(FIXTURE_ROOT, 'opencode', 'plugins', 'caveman-opencode.ts'), 'utf-8');

    expect(actual).toBe(golden);
  });
});
```

- [ ] **Step 4: Run focused settings and plugin deployment tests**

Run:

```bash
bun test test/__tests__/push-settings.test.ts test/__tests__/push-plugins.test.ts
```

Expected:

```text
OpenCode settings still preserve user keys, the plugin list includes caveman-opencode, and the plugin file is deployed exactly from the canonical source
```

- [ ] **Step 5: Commit the OpenCode wiring**

Run:

```bash
git add configs/plugins/caveman-opencode.ts configs/settings/opencode.json test/fixtures/opencode/settings/opencode.json test/fixtures/opencode/plugins/caveman-opencode.ts test/__tests__/push-plugins.test.ts
git commit -m "feat: add caveman plugin for opencode"
```

Expected:

```text
a new commit covering the OpenCode plugin, plugin registration, and plugin deployment test
```

## Task 6: Add Runtime Hook Behavior Tests

**Files:**
- Create: `test/__tests__/runtime-caveman-hooks.test.ts`
- Test: `configs/hooks/caveman-sessionstart-codex.js`
- Test: `configs/hooks/caveman-userprompt-codex.js`
- Test: `configs/hooks/caveman-sessionstart-claude.js`
- Test: `configs/hooks/caveman-userprompt-claude.js`

- [ ] **Step 1: Add direct runtime tests for state updates and emitted context**

Create `test/__tests__/runtime-caveman-hooks.test.ts` with:

```ts
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function runHook(script: string, stdin = '', homeDir: string) {
  const proc = Bun.spawn(['node', script], {
    cwd: process.cwd(),
    env: { ...process.env, HOME: homeDir },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (stdin) {
    const writer = proc.stdin.writer();
    writer.write(new TextEncoder().encode(stdin));
    writer.end();
  } else {
    proc.stdin.end();
  }
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  return stdout.trim();
}

describe('caveman runtime hooks', () => {
  test('user prompt codex hook activates lite and writes state', async () => {
    const home = mkdtempSync(join(tmpdir(), 'caveman-hook-'));
    mkdirSync(join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'settings'), { recursive: true });
    writeFileSync(join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'settings', 'caveman.json'), '{"defaultMode":"off","targets":["codex"],"naturalLanguageActivation":false}');

    const out = await runHook(
      join(process.cwd(), 'configs/hooks/caveman-userprompt-codex.js'),
      JSON.stringify({ prompt: '/caveman lite' }),
      home,
    );

    expect(out).toContain('UserPromptSubmit');
    expect(readFileSync(join(home, '.codex', '.caveman-active'), 'utf-8')).toBe('lite');
  });
});
```

- [ ] **Step 2: Expand the runtime test to cover inactive startup, per-level filtering, and deactivation**

Extend the same file with these tests:

```ts
test('session start emits nothing when mode is off', async () => {
  const home = mkdtempSync(join(tmpdir(), 'caveman-hook-off-'));
  mkdirSync(join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'settings'), { recursive: true });
  writeFileSync(join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'settings', 'caveman.json'), '{"defaultMode":"off","targets":["codex"],"naturalLanguageActivation":false}');
  const out = await runHook(join(process.cwd(), 'configs/hooks/caveman-sessionstart-codex.js'), '', home);
  expect(out).toBe('');
});

test('session start emits only the active level block', async () => {
  const home = mkdtempSync(join(tmpdir(), 'caveman-hook-level-'));
  mkdirSync(join(home, '.codex'), { recursive: true });
  writeFileSync(join(home, '.codex', '.caveman-active'), 'lite');
  mkdirSync(join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'settings'), { recursive: true });
  mkdirSync(join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'skills', 'caveman'), { recursive: true });
  writeFileSync(join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'settings', 'caveman.json'), '{"defaultMode":"off","targets":["codex"],"naturalLanguageActivation":false}');
  writeFileSync(
    join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'skills', 'caveman', 'SKILL.md'),
    `---\nname: caveman\n---\n\n## Boundaries\n\n- keep meaning\n\n## Auto Clarity\n\n- be clear for safety\n\n## Level Rules\n\n### lite\n\n- lite rule\n\n### full\n\n- full rule\n\n## Examples\n\n### lite\n\n- lite example\n\n### full\n\n- full example\n`,
  );

  const out = await runHook(join(process.cwd(), 'configs/hooks/caveman-sessionstart-codex.js'), '', home);

  expect(out).toContain('level: lite');
  expect(out).toContain('lite rule');
  expect(out).not.toContain('full rule');
});

test('deactivation clears reinforcement output', async () => {
  const home = mkdtempSync(join(tmpdir(), 'caveman-hook-stop-'));
  mkdirSync(join(home, '.claude'), { recursive: true });
  writeFileSync(join(home, '.claude', '.caveman-active'), 'full');
  mkdirSync(join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'settings'), { recursive: true });
  writeFileSync(join(home, 'Repos', 'zacczakk', 'metronome', 'configs', 'settings', 'caveman.json'), '{"defaultMode":"off","targets":["claude-code"],"naturalLanguageActivation":false}');

  const out = await runHook(
    join(process.cwd(), 'configs/hooks/caveman-userprompt-claude.js'),
    JSON.stringify({ prompt: '/caveman off' }),
    home,
  );

  expect(readFileSync(join(home, '.claude', '.caveman-active'), 'utf-8')).toBe('off');
  expect(out).toBe('');
});
```

- [ ] **Step 3: Run the runtime hook tests**

Run:

```bash
bun test test/__tests__/runtime-caveman-hooks.test.ts
```

Expected:

```text
the runtime hook tests pass for activation, inactive startup, level-filtered session-start output, and deactivation behavior
```

- [ ] **Step 4: Commit runtime behavior coverage**

Run:

```bash
git add test/__tests__/runtime-caveman-hooks.test.ts
git commit -m "test: cover caveman runtime hook behavior"
```

Expected:

```text
a new commit adding direct runtime coverage for the hook scripts
```

## Task 7: Update Docs and Run Full Verification

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/design/sync-spec.md`
- Test: full repo verification

- [ ] **Step 1: Document the caveman architecture and sync model**

Add this paragraph to `docs/architecture.md` near the hook/plugin discussion:

```md
`caveman` is a centrally managed optional runtime mode. Canonical behavior lives in `configs/skills/caveman/SKILL.md` plus `configs/settings/caveman.json`. Shared parsing/state/filtering logic lives in `configs/hooks/caveman-shared.js`. Codex uses standalone `hooks.json`, Claude uses managed hooks in `configs/settings/claude.json`, and OpenCode uses a deployed plugin in `configs/plugins/caveman-opencode.ts`.
```

- [ ] **Step 2: Document the sync contract in `docs/design/sync-spec.md`**

Add this block to the settings/hooks/plugins sync section:

```md
### Caveman Mode

- Canonical skill: `configs/skills/caveman/SKILL.md`
- Canonical config: `configs/settings/caveman.json`
- Shared runtime helper: `configs/hooks/caveman-shared.js`
- Codex wiring: `configs/hook-configs/codex.json`
- Claude wiring: `configs/settings/claude.json`
- OpenCode wiring: `configs/plugins/caveman-opencode.ts` plus the `plugin` array in `configs/settings/opencode.json`
```

- [ ] **Step 3: Run the focused caveman test set**

Run:

```bash
bun test src/runtime/__tests__/caveman-paths.test.ts src/runtime/__tests__/caveman-shared.test.ts test/__tests__/push-codex-hooks.test.ts test/__tests__/push-settings.test.ts test/__tests__/push-plugins.test.ts test/__tests__/runtime-caveman-hooks.test.ts
```

Expected:

```text
all new caveman-focused tests pass
```

- [ ] **Step 4: Run the full repository test suite**

Run:

```bash
bun test
```

Expected:

```text
full test suite passes with no caveman regressions in push/check/pull behavior
```

- [ ] **Step 5: Commit docs and final verification changes**

Run:

```bash
git add docs/architecture.md docs/design/sync-spec.md
git commit -m "docs: document caveman mode architecture"
```

Expected:

```text
a docs-only commit after code and tests are already green
```

- [ ] **Step 6: Push live config after local verification only if explicitly requested**

Run only when asked:

```bash
metronome push --target codex --target claude-code --target opencode --type settings --type hooks --type skills --type plugins
```

Expected:

```text
target configs updated with caveman mode assets and no unexpected drift
```

## Self-Review Checklist

- Spec coverage:
  - canonical skill/config: Tasks 1-2
  - shared helper/state safety/filtering: Task 2
  - Codex `SessionStart` + `UserPromptSubmit`: Task 3
  - Claude `SessionStart` + `UserPromptSubmit`: Task 4
  - OpenCode plugin parity: Task 5
  - unit/integration/runtime tests: Tasks 2, 3, 4, 5, 6, 7
  - docs + rollout boundary: Task 7
- Placeholder scan:
  - no `TODO`, `TBD`, or “appropriate error handling” placeholders remain
- Type consistency:
  - state values are consistently `off|lite|full|ultra`
  - target names are consistently `claude-code|codex|opencode`
  - command aliases are consistently `/caveman`, `/caveman <mode>`, `/caveman off|stop`, `normal mode`, `stop caveman`

## Notes Before Execution

- OpenCode hidden-context mutation is the riskiest part. Validate the plugin event/API against current OpenCode docs before implementing the exact `session.patch` shape. If the API differs, keep the user-visible semantics and state file behavior, but adapt the injection method.
- The shared helper currently assumes the canonical repo lives at `~/Repos/zacczakk/metronome`. Preserve that precedent unless metronome already exposes a better repo-root discovery utility for runtime scripts.
- Do not enable natural-language activation in v1. Only deactivation aliases are enabled by default.
