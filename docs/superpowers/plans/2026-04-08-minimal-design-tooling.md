# Minimal Design Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lean Impeccable-inspired design layer to metronome by upgrading `frontend-design`, adding one review skill, and shipping six canonical design commands.

**Architecture:** Keep one generative skill (`frontend-design`), add one review skill (`design-critique`), and express repeated design workflows as canonical commands in `configs/commands/`. Verify behavior through fixture-based skill/command sync tests rather than adding new runtime machinery.

**Tech Stack:** Markdown configs, Bun test runner, TypeScript CLI sync engine, canonical fixtures

---

## File Map

- Modify: `configs/skills/frontend-design/SKILL.md`
- Create: `configs/skills/design-critique/SKILL.md`
- Create: `configs/commands/teach-design-context.md`
- Create: `configs/commands/design-audit.md`
- Create: `configs/commands/design-critique.md`
- Create: `configs/commands/design-normalize.md`
- Create: `configs/commands/design-polish.md`
- Create: `configs/commands/design-typeset.md`
- Modify: `docs/skills.md`
- Modify: `test/fixtures/canonical/skills/frontend-design/SKILL.md`
- Create: `test/fixtures/canonical/skills/design-critique/SKILL.md`
- Modify: `test/fixtures/claude/skills/frontend-design/SKILL.md`
- Create: `test/fixtures/claude/skills/design-critique/SKILL.md`
- Modify: `test/fixtures/opencode/skills/frontend-design/SKILL.md`
- Create: `test/fixtures/opencode/skills/design-critique/SKILL.md`
- Modify: `test/fixtures/gemini/skills/frontend-design/SKILL.md`
- Create: `test/fixtures/gemini/skills/design-critique/SKILL.md`
- Modify: `test/fixtures/codex/skills/frontend-design/SKILL.md`
- Create: `test/fixtures/codex/skills/design-critique/SKILL.md`
- Create: `test/fixtures/canonical/commands/teach-design-context.md`
- Create: `test/fixtures/canonical/commands/design-audit.md`
- Create: `test/fixtures/canonical/commands/design-critique.md`
- Create: `test/fixtures/canonical/commands/design-normalize.md`
- Create: `test/fixtures/canonical/commands/design-polish.md`
- Create: `test/fixtures/canonical/commands/design-typeset.md`
- Create: `test/fixtures/claude/commands/teach-design-context.md`
- Create: `test/fixtures/claude/commands/design-audit.md`
- Create: `test/fixtures/claude/commands/design-critique.md`
- Create: `test/fixtures/claude/commands/design-normalize.md`
- Create: `test/fixtures/claude/commands/design-polish.md`
- Create: `test/fixtures/claude/commands/design-typeset.md`
- Create: `test/fixtures/opencode/commands/teach-design-context.md`
- Create: `test/fixtures/opencode/commands/design-audit.md`
- Create: `test/fixtures/opencode/commands/design-critique.md`
- Create: `test/fixtures/opencode/commands/design-normalize.md`
- Create: `test/fixtures/opencode/commands/design-polish.md`
- Create: `test/fixtures/opencode/commands/design-typeset.md`
- Create: `test/fixtures/gemini/commands/teach-design-context.md`
- Create: `test/fixtures/gemini/commands/design-audit.md`
- Create: `test/fixtures/gemini/commands/design-critique.md`
- Create: `test/fixtures/gemini/commands/design-normalize.md`
- Create: `test/fixtures/gemini/commands/design-polish.md`
- Create: `test/fixtures/gemini/commands/design-typeset.md`
- Create: `test/fixtures/codex/commands/teach-design-context.md`
- Create: `test/fixtures/codex/commands/design-audit.md`
- Create: `test/fixtures/codex/commands/design-critique.md`
- Create: `test/fixtures/codex/commands/design-normalize.md`
- Create: `test/fixtures/codex/commands/design-polish.md`
- Create: `test/fixtures/codex/commands/design-typeset.md`
- Modify: `test/__tests__/push-skills.test.ts`
- Modify: `test/__tests__/pull-skills.test.ts`
- Create: `test/__tests__/push-commands.test.ts`
- Create: `test/__tests__/pull-commands.test.ts`

### Task 1: Add failing tests for new skill and command coverage

**Files:**
- Modify: `test/__tests__/push-skills.test.ts`
- Modify: `test/__tests__/pull-skills.test.ts`
- Create: `test/__tests__/push-commands.test.ts`
- Create: `test/__tests__/pull-commands.test.ts`

- [ ] **Step 1: Add a failing `design-critique` fixture assertion to push-skills**

```ts
// In test/__tests__/push-skills.test.ts inside the main E2E test
const claudeDesignCritique = readFileSync(join(paths.claude, 'design-critique', 'SKILL.md'), 'utf-8');
const claudeDesignCritiqueGolden = readFileSync(
  join(FIXTURE_ROOT, 'claude', 'skills', 'design-critique', 'SKILL.md'),
  'utf-8',
);
expect(claudeDesignCritique).toBe(claudeDesignCritiqueGolden);
```

- [ ] **Step 2: Add a failing `design-critique` pull assertion**

```ts
// In test/__tests__/pull-skills.test.ts inside the Claude pull test
const canonicalDesignCritique = readFileSync(
  join(FIXTURE_ROOT, 'canonical', 'skills', 'design-critique', 'SKILL.md'),
  'utf-8',
);
const pulledDesignCritique = readFileSync(
  join(projectDir, 'configs', 'skills', 'design-critique', 'SKILL.md'),
  'utf-8',
);
expect(pulledDesignCritique).toBe(canonicalDesignCritique);
```

- [ ] **Step 3: Add failing command push test file**

```ts
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

function targetPaths(fakeHome: string) {
  return {
    claude: join(fakeHome, '.claude', 'commands'),
    opencode: join(fakeHome, '.config', 'opencode', 'command'),
    gemini: join(fakeHome, '.gemini', 'commands'),
    codex: join(fakeHome, '.codex', 'prompts'),
  };
}

describe('push-commands E2E', () => {
  test('pushes design commands to all 4 targets matching golden fixtures', async () => {
    const fakeHome = createTestHome('push-command-design');
    const projectDir = createTestProject('push-command-design', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);

    const result = await runPush({ projectDir, force: true, types: ['command'], homeDir: fakeHome });

    expect(result.written).toBeGreaterThan(0);
    expect(result.failed).toBe(0);

    const claudeAudit = readFileSync(join(paths.claude, 'design-audit.md'), 'utf-8');
    const claudeAuditGolden = readFileSync(
      join(FIXTURE_ROOT, 'claude', 'commands', 'design-audit.md'),
      'utf-8',
    );
    expect(claudeAudit).toBe(claudeAuditGolden);
  }, E2E_TIMEOUT);
});
```

- [ ] **Step 4: Add failing command pull test file**

```ts
import { describe, expect, test } from 'bun:test';
import { readFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTestHome, seedTargetFixtures } from '../helpers/backup';
import { runPull } from '../../src/cli/pull';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

function setupProjectDir(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'pull-command-test-'));
  mkdirSync(join(tmp, 'configs', 'commands'), { recursive: true });
  return tmp;
}

function plantTargetCommands(fakeHome: string): void {
  for (const target of ['claude', 'opencode', 'gemini', 'codex']) {
    seedTargetFixtures(fakeHome, FIXTURE_ROOT, target, 'commands');
  }
}

describe('pull-commands E2E', () => {
  test('pulls design commands from claude matching canonical fixtures', async () => {
    const fakeHome = createTestHome('pull-command-claude');
    plantTargetCommands(fakeHome);

    const projectDir = setupProjectDir();
    await runPull({ source: 'claude-code', force: true, projectDir, homeDir: fakeHome });

    const canonicalAudit = readFileSync(
      join(FIXTURE_ROOT, 'canonical', 'commands', 'design-audit.md'),
      'utf-8',
    );
    const pulledAudit = readFileSync(
      join(projectDir, 'configs', 'commands', 'design-audit.md'),
      'utf-8',
    );
    expect(pulledAudit).toBe(canonicalAudit);
  }, E2E_TIMEOUT);
});
```

- [ ] **Step 5: Run the new failing tests**

Run: `bun test test/__tests__/push-skills.test.ts test/__tests__/pull-skills.test.ts test/__tests__/push-commands.test.ts test/__tests__/pull-commands.test.ts`

Expected: FAIL because the new skill fixtures and command fixtures do not exist yet.

### Task 2: Implement the new and updated canonical skill files

**Files:**
- Modify: `configs/skills/frontend-design/SKILL.md`
- Create: `configs/skills/design-critique/SKILL.md`

- [ ] **Step 1: Update `frontend-design` with context protocol and sharper anti-patterns**

```md
## Context Protocol

Before design work:
- Check loaded instructions for project design context.
- Check `.design-context.md` in project root.
- If context is still missing, ask only for the minimum missing information.

Do not infer audience, jobs-to-be-done, brand personality, or emotional tone from code alone.

## Anti-Patterns

Never default to hero-metric templates, decorative gradient text, dark-mode glow palettes, glassmorphism everywhere, icon-over-heading templates, identical card grids, or spacing with no rhythm.

## Implementation Rules

- App UIs: fixed `rem`-based type scales
- Prefer `gap` over margins for sibling spacing
- Use Flexbox by default for 1D layouts; Grid for real 2D problems
- Tint neutrals; avoid pure black and white defaults
```

- [ ] **Step 2: Add new `design-critique` skill**

```md
---
name: design-critique
description: Review UI work for anti-slop tells, hierarchy, cognitive load, and UX quality. Use when the user asks to critique, review, evaluate, or improve an existing design.
---

Review the target UI and produce:

1. Anti-pattern verdict
2. Overall impression
3. What's working
4. Priority issues with P0-P3 severity
5. Recommended next commands

Evaluate:
- Anti-slop tells
- Visual hierarchy
- Cognitive load and information architecture
- Emotional tone and fit
- Discoverability and affordance
- Typography as communication
- States and edge cases
- Microcopy clarity

Keep the critique direct, specific, and actionable.
```

- [ ] **Step 3: Run focused skill tests again**

Run: `bun test test/__tests__/push-skills.test.ts test/__tests__/pull-skills.test.ts`

Expected: still FAIL until fixtures are added, but failures should now point at missing fixture files rather than missing canonical source files.

### Task 3: Implement the six canonical design commands

**Files:**
- Create: `configs/commands/teach-design-context.md`
- Create: `configs/commands/design-audit.md`
- Create: `configs/commands/design-critique.md`
- Create: `configs/commands/design-normalize.md`
- Create: `configs/commands/design-polish.md`
- Create: `configs/commands/design-typeset.md`

- [ ] **Step 1: Add `teach-design-context` command**

```md
---
description: Create or update .design-context.md for the current project
---

# Teach Design Context

Create or update `.design-context.md` in the current project root.

User input: $ARGUMENTS

## Steps

1. Read repo docs, existing UI patterns, tokens, and brand assets.
2. Ask only for missing context the code cannot answer.
3. Write a concise `.design-context.md` covering users, jobs to be done, brand personality, aesthetic direction, anti-references, accessibility expectations, and design principles.
4. Report what was captured and what future design work should follow.
```

- [ ] **Step 2: Add `design-audit` command**

```md
---
description: Run a technical UI audit covering accessibility, performance, tokens, responsiveness, and anti-patterns
---

# Design Audit

Audit the requested UI without editing code by default.

User input: $ARGUMENTS

## Checks

1. Accessibility
2. Performance
3. Theming and token usage
4. Responsiveness
5. Anti-pattern detection

## Output

1. Score table
2. P0-P3 issues
3. Positive findings
4. Recommended next commands
```

- [ ] **Step 3: Add `design-critique` command**

```md
---
description: Run a UX and taste review of an existing interface and recommend the highest-leverage next fixes
---

# Design Critique

Run the design critique workflow for the requested UI.

User input: $ARGUMENTS

Invoke the `design-critique` skill, then report:

1. Anti-pattern verdict
2. Overall impression
3. What's working
4. Priority issues
5. Recommended next commands
```

- [ ] **Step 4: Add `design-normalize`, `design-polish`, and `design-typeset` commands**

```md
---
description: Align a feature with the existing design system and UI conventions
---

# Design Normalize

Realign the requested feature with the project's existing design system, tokens, spacing, and interaction patterns.
```

```md
---
description: Perform a final UI quality pass before shipping
---

# Design Polish

Do a final pass on spacing, alignment, states, copy consistency, and micro-detail quality.
```

```md
---
description: Improve typography by fixing hierarchy, sizing, readability, and font usage
---

# Design Typeset

Improve the requested UI's typography without broad system or layout changes.
```

- [ ] **Step 5: Run command tests again**

Run: `bun test test/__tests__/push-commands.test.ts test/__tests__/pull-commands.test.ts`

Expected: still FAIL until fixtures are added, but failures should now be fixture mismatches only.

### Task 4: Add canonical and rendered golden fixtures

**Files:**
- Modify/create all fixture files listed in File Map

- [ ] **Step 1: Add canonical skill fixtures**

Create fixture files under `test/fixtures/canonical/skills/` that exactly mirror:

```text
configs/skills/frontend-design/SKILL.md
configs/skills/design-critique/SKILL.md
```

- [ ] **Step 2: Add rendered target skill fixtures**

Create fixture files under:

```text
test/fixtures/claude/skills/
test/fixtures/opencode/skills/
test/fixtures/gemini/skills/
test/fixtures/codex/skills/
```

For skills, target fixtures should match canonical content unless an adapter already proves otherwise.

- [ ] **Step 3: Add canonical command fixtures**

Create canonical golden files under `test/fixtures/canonical/commands/` matching the six new command files exactly.

- [ ] **Step 4: Add rendered target command fixtures**

Create target golden files under each target's `commands/` fixture directory for the six new commands, matching current adapter rendering rules.

- [ ] **Step 5: Run the full fixture-based test set**

Run: `bun test test/__tests__/push-skills.test.ts test/__tests__/pull-skills.test.ts test/__tests__/push-commands.test.ts test/__tests__/pull-commands.test.ts`

Expected: PASS

### Task 5: Update docs and run repo verification

**Files:**
- Modify: `docs/skills.md`

- [ ] **Step 1: Update `docs/skills.md` inventory and source notes**

```md
### Custom Skills

| `design-critique` | Reviewing UI for anti-slop tells, hierarchy, and UX quality | — |

### Impeccable Skill

| `frontend-design` | Building web UI with metronome-owned context protocol and anti-slop rules | SKILL.md |

### Design Commands

- `teach-design-context`
- `design-audit`
- `design-critique`
- `design-normalize`
- `design-polish`
- `design-typeset`
```

- [ ] **Step 2: Run the targeted test suite**

Run: `bun test test/__tests__/push-skills.test.ts test/__tests__/pull-skills.test.ts test/__tests__/push-commands.test.ts test/__tests__/pull-commands.test.ts`

Expected: PASS

- [ ] **Step 3: Run a broader verification pass**

Run: `bun test test/__tests__/push-skills.test.ts test/__tests__/pull-skills.test.ts test/__tests__/push-commands.test.ts test/__tests__/pull-commands.test.ts src/adapters/__tests__/skills.test.ts`

Expected: PASS

- [ ] **Step 4: Check formatted diff and final repo state**

Run: `rtk git diff --stat && rtk git status --short`

Expected: only the planned skill, command, fixture, test, and docs changes appear.

## Self-Review

Spec coverage check:

1. `frontend-design` upgrade: Task 2
2. `design-critique` skill: Task 2
3. six commands: Task 3
4. docs update: Task 5
5. sync-model fit via fixtures and adapter expectations: Tasks 1 and 4

Placeholder scan:

1. no TODO/TBD markers
2. all file paths explicit
3. test commands explicit

Consistency check:

1. names use `design-critique` consistently for both skill and command
2. context file name is consistently `.design-context.md`
3. command set matches the approved six-command scope
