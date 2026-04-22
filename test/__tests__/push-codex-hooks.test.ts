import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { createAdapter } from '../../src/cli/canonical';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');
const SEEDS_ROOT = join(FIXTURE_ROOT, 'seeds');

function seedCodexTarget(fakeHome: string): void {
  const adapter = createAdapter('codex', fakeHome);
  const settingsPath = adapter.getPaths().getSettingsPath();
  mkdirSync(dirname(settingsPath), { recursive: true });
  cpSync(join(SEEDS_ROOT, 'codex/config.toml'), settingsPath);
}

describe('push codex hooks E2E', () => {
  test('pushes codex settings and hook config matching goldens', async () => {
    const fakeHome = createTestHome('push-codex-hooks');
    const projectDir = createTestProject('push-codex-hooks', FIXTURE_ROOT);
    seedCodexTarget(fakeHome);

    const result = await runPush({ projectDir, force: true, targets: ['codex'], types: ['settings', 'hook'], homeDir: fakeHome });

    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);
    expect(result.written).toBe(2);

    const adapter = createAdapter('codex', fakeHome);
    const settingsActual = readFileSync(adapter.getPaths().getSettingsPath(), 'utf-8');
    const hooksActual = readFileSync(adapter.getPaths().getHooksPath(), 'utf-8');

    const settingsGolden = readFileSync(join(FIXTURE_ROOT, 'codex/settings/config.toml'), 'utf-8');
    const hooksGolden = readFileSync(join(FIXTURE_ROOT, 'codex/hooks/hooks.json'), 'utf-8');

    expect(settingsActual.trimEnd()).toBe(settingsGolden.trimEnd());
    expect(hooksActual.trimEnd()).toBe(hooksGolden.trimEnd());

    const result2 = await runPush({ projectDir, force: true, targets: ['codex'], types: ['settings', 'hook'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  });
});
