import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { createAdapter } from '../../src/cli/canonical';
import type { TargetName } from '../../src/types';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

/** Golden fixture paths per target */
const GOLDEN_PATHS: Record<TargetName, string> = {
  'claude-code': join(FIXTURE_ROOT, 'claude/instructions/CLAUDE.md'),
  opencode: join(FIXTURE_ROOT, 'opencode/instructions/AGENTS.md'),
  gemini: join(FIXTURE_ROOT, 'gemini/instructions/AGENTS.md'),
  codex: join(FIXTURE_ROOT, 'codex/instructions/AGENTS.md'),
};

const ALL_TARGETS: TargetName[] = ['claude-code', 'opencode', 'gemini', 'codex'];

describe('push instructions E2E', () => {
  test('pushes instructions to all 4 targets, matches goldens, identity passthrough, idempotent', async () => {
    const fakeHome = createTestHome('push-instr');
    const projectDir = createTestProject('push-instr', FIXTURE_ROOT);

    // --- Push instructions (no seeding needed — identity passthrough) ---
    const result = await runPush({ projectDir, force: true, types: ['instruction'], homeDir: fakeHome });
    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);
    expect(result.written).toBe(4);

    // --- Golden comparison for all 4 targets ---
    for (const target of ALL_TARGETS) {
      const adapter = createAdapter(target, fakeHome);
      const instructionsPath = adapter.getPaths().getInstructionsPath();
      const actual = readFileSync(instructionsPath, 'utf-8');
      const golden = readFileSync(GOLDEN_PATHS[target], 'utf-8');
      expect(actual).toBe(golden);
    }

    // --- All 4 targets get identical content (identity passthrough) ---
    const contents = ALL_TARGETS.map((target) => {
      const adapter = createAdapter(target, fakeHome);
      return readFileSync(adapter.getPaths().getInstructionsPath(), 'utf-8');
    });
    for (let i = 1; i < contents.length; i++) {
      expect(contents[i]).toBe(contents[0]);
    }

    // --- Idempotency: second push reports no drift ---
    const result2 = await runPush({ projectDir, force: true, types: ['instruction'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  });
});
