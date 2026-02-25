import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { withTargetBackup } from '../../../test/helpers/backup';
import { runPush } from '../push';
import { createAdapter } from '../canonical';
import type { TargetName } from '../../types';

const FIXTURE_ROOT = join(import.meta.dir, '../../../test/fixtures');
const CANONICAL_ROOT = join(FIXTURE_ROOT, 'canonical');

/** Build a temp project dir pointing at canonical fixtures */
function setupProjectDir(): string {
  const dir = join(os.tmpdir(), `push-instr-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  cpSync(CANONICAL_ROOT, join(dir, 'configs'), { recursive: true });
  return dir;
}

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
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();

      // --- Push instructions (no seeding needed — identity passthrough) ---
      const result = await runPush({ projectDir, force: true, types: ['instruction'] });
      expect(result.failed).toBe(0);
      expect(result.rolledBack).toBe(false);
      expect(result.written).toBe(4);

      // --- Golden comparison for all 4 targets ---
      for (const target of ALL_TARGETS) {
        const adapter = createAdapter(target);
        const instructionsPath = adapter.getPaths().getInstructionsPath();
        const actual = readFileSync(instructionsPath, 'utf-8');
        const golden = readFileSync(GOLDEN_PATHS[target], 'utf-8');
        expect(actual).toBe(golden);
      }

      // --- All 4 targets get identical content (identity passthrough) ---
      const contents = ALL_TARGETS.map((target) => {
        const adapter = createAdapter(target);
        return readFileSync(adapter.getPaths().getInstructionsPath(), 'utf-8');
      });
      for (let i = 1; i < contents.length; i++) {
        expect(contents[i]).toBe(contents[0]);
      }

      // --- Idempotency: second push reports no drift ---
      const result2 = await runPush({ projectDir, force: true, types: ['instruction'] });
      expect(result2.hasDrift).toBe(false);
      expect(result2.written).toBe(0);
    });
  });
});
