import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { createTestHome } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { runPull } from '../../src/cli/pull';
import type { TargetName } from '../../src/types';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');
const CANONICAL_ROOT = join(FIXTURE_ROOT, 'canonical');
const E2E_TIMEOUT = 60_000;

const ALL_TARGETS: TargetName[] = ['claude-code', 'opencode', 'gemini', 'codex'];

/** Build a temp project dir pointing at canonical fixtures */
function setupProjectDir(suffix: string): string {
  const dir = join(os.tmpdir(), `pull-instr-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  cpSync(CANONICAL_ROOT, join(dir, 'configs'), { recursive: true });
  return dir;
}

/** Build an empty temp project dir (no configs/) */
function emptyProjectDir(suffix: string): string {
  const dir = join(os.tmpdir(), `pull-instr-empty-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('pull instructions E2E', () => {
  test('round-trip: push then pull instructions matches canonical', async () => {
    const fakeHome = createTestHome('pull-instr-rt');
    // Push canonical instructions to all 4 targets
    const pushDir = setupProjectDir('push');
    const pushResult = await runPush({ projectDir: pushDir, force: true, types: ['instruction'], homeDir: fakeHome });
    expect(pushResult.failed).toBe(0);
    expect(pushResult.written).toBe(4);

    const canonicalContent = readFileSync(join(CANONICAL_ROOT, 'instructions/AGENTS.md'), 'utf-8');

    // Pull from each target into fresh projectDir
    for (const target of ALL_TARGETS) {
      const pullDir = emptyProjectDir(`pull-${target}`);
      const pullResult = await runPull({ source: target, force: true, projectDir: pullDir, homeDir: fakeHome });
      expect(pullResult.rolledBack).toBe(false);

      const pulledPath = join(pullDir, 'configs/instructions/AGENTS.md');
      expect(existsSync(pulledPath)).toBe(true);
      const pulledContent = readFileSync(pulledPath, 'utf-8');
      // Instructions are identity passthrough — pulled content must match canonical exactly
      expect(pulledContent).toBe(canonicalContent);
    }
  }, E2E_TIMEOUT);

  test('force pull overwrites existing instructions, non-force skips', async () => {
    const fakeHome = createTestHome('pull-instr-force');
    // Push instructions to all targets
    const pushDir = setupProjectDir('push-force');
    await runPush({ projectDir: pushDir, force: true, types: ['instruction'], homeDir: fakeHome });

    // Pre-populate pullDir with sentinel AGENTS.md
    const pullDir = emptyProjectDir('pull-force');
    mkdirSync(join(pullDir, 'configs/instructions'), { recursive: true });
    writeFileSync(join(pullDir, 'configs/instructions/AGENTS.md'), 'sentinel content\n');

    // Force pull from claude — sentinel overwritten
    await runPull({ source: 'claude-code', force: true, projectDir: pullDir, homeDir: fakeHome });
    const afterForce = readFileSync(join(pullDir, 'configs/instructions/AGENTS.md'), 'utf-8');
    expect(afterForce).not.toContain('sentinel');
    const canonicalContent = readFileSync(join(CANONICAL_ROOT, 'instructions/AGENTS.md'), 'utf-8');
    expect(afterForce).toBe(canonicalContent);

    // Non-force pull from opencode — file should be skipped (already exists)
    await runPull({ source: 'opencode', projectDir: pullDir, homeDir: fakeHome });
    const afterNonForce = readFileSync(join(pullDir, 'configs/instructions/AGENTS.md'), 'utf-8');
    expect(afterNonForce).toBe(canonicalContent); // unchanged from force pull above
  }, E2E_TIMEOUT);
});
