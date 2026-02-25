import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import os from 'node:os';
import { withTargetBackup } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { runPull } from '../../src/cli/pull';
import { createAdapter } from '../../src/cli/canonical';
import type { TargetName } from '../../src/types';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');
const SEEDS_ROOT = join(FIXTURE_ROOT, 'seeds');
const CANONICAL_ROOT = join(FIXTURE_ROOT, 'canonical');
const E2E_TIMEOUT = 60_000;

/** Build a temp project dir pointing at canonical fixtures */
function setupProjectDir(suffix: string): string {
  const dir = join(os.tmpdir(), `pull-settings-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  cpSync(CANONICAL_ROOT, join(dir, 'configs'), { recursive: true });
  return dir;
}

/** Seed real target settings files with pre-existing content from seeds/ */
function seedSettingsTargets(): void {
  const targets: Array<{ target: TargetName; seedFile: string }> = [
    { target: 'claude-code', seedFile: join(SEEDS_ROOT, 'claude/settings.json') },
    { target: 'opencode', seedFile: join(SEEDS_ROOT, 'opencode/settings.jsonc') },
  ];

  for (const { target, seedFile } of targets) {
    const adapter = createAdapter(target);
    const settingsPath = adapter.getPaths().getSettingsPath();
    rmSync(settingsPath, { force: true });
    mkdirSync(dirname(settingsPath), { recursive: true });
    cpSync(seedFile, settingsPath);
  }
}

describe('pull settings E2E', () => {
  test('round-trip: push then pull settings matches canonical', async () => {
    await withTargetBackup(async () => {
      // Push settings to claude + opencode (seed first for merge behavior)
      const pushDir = setupProjectDir('push');
      seedSettingsTargets();
      const pushResult = await runPush({ projectDir: pushDir, force: true, types: ['settings'] });
      expect(pushResult.failed).toBe(0);
      expect(pushResult.written).toBe(2); // claude + opencode

      // Pull settings back — needs canonical settings in pullDir so pull knows which keys to manage
      for (const target of ['claude-code', 'opencode'] as TargetName[]) {
        const pullDir = setupProjectDir(`pull-${target}`);
        const pullResult = await runPull({ source: target, force: true, projectDir: pullDir });
        expect(pullResult.rolledBack).toBe(false);

        // Pulled settings should contain canonical keys
        const settingsFile = target === 'claude-code' ? 'claude.json' : 'opencode.json';
        const pulledPath = join(pullDir, 'configs/settings', settingsFile);
        const pulledContent = readFileSync(pulledPath, 'utf-8');
        const pulled = JSON.parse(pulledContent);
        const canonical = JSON.parse(readFileSync(join(CANONICAL_ROOT, 'settings', settingsFile), 'utf-8'));

        // Check canonical keys round-trip
        for (const key of Object.keys(canonical)) {
          expect(pulled).toHaveProperty(key);
          expect(JSON.stringify(pulled[key])).toBe(JSON.stringify(canonical[key]));
        }
      }
    });
  }, E2E_TIMEOUT);

  test('gemini and codex have no settings capability', () => {
    const geminiCaps = createAdapter('gemini').getCapabilities();
    expect(geminiCaps.settings).toBe(false);
    const codexCaps = createAdapter('codex').getCapabilities();
    expect(codexCaps.settings).toBe(false);
  });
});
