import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestHome } from '../helpers/backup';
import { runPush } from '../../src/cli/push';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

describe('push plugins E2E', () => {
  test('does not push caveman OpenCode plugin', async () => {
    const fakeHome = createTestHome('push-plugins');

    const result = await runPush({
      projectDir: process.cwd(),
      force: true,
      targets: ['opencode'],
      types: ['plugin'],
      homeDir: fakeHome,
    });

    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);
    expect(existsSync(join(fakeHome, '.config', 'opencode', 'plugins', 'caveman-opencode.ts'))).toBe(false);
  }, E2E_TIMEOUT);

  test('removes stale caveman OpenCode plugin with deleteStale', async () => {
    const fakeHome = createTestHome('push-plugins-stale');
    const stalePath = join(fakeHome, '.config', 'opencode', 'plugins', 'caveman-opencode.ts');
    mkdirSync(join(fakeHome, '.config', 'opencode', 'plugins'), { recursive: true });
    writeFileSync(stalePath, 'export const Caveman = {}\n');

    await runPush({
      projectDir: process.cwd(),
      force: true,
      deleteStale: true,
      targets: ['opencode'],
      types: ['plugin'],
      homeDir: fakeHome,
    });

    expect(existsSync(stalePath)).toBe(false);
  }, E2E_TIMEOUT);

  test('second plugin push is idempotent', async () => {
    const fakeHome = createTestHome('push-plugins-idem');

    await runPush({
      projectDir: process.cwd(),
      force: true,
      targets: ['opencode'],
      types: ['plugin'],
      homeDir: fakeHome,
    });

    const result = await runPush({
      projectDir: process.cwd(),
      force: true,
      targets: ['opencode'],
      types: ['plugin'],
      homeDir: fakeHome,
    });

    expect(result.hasDrift).toBe(false);
    expect(result.written).toBe(0);
  }, E2E_TIMEOUT);
});
