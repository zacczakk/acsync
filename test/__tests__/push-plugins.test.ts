import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestHome } from '../helpers/backup';
import { runPush } from '../../src/cli/push';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

describe('push plugins E2E', () => {
  test('pushes caveman OpenCode plugin matching golden', async () => {
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

    const actual = readFileSync(join(fakeHome, '.config', 'opencode', 'plugins', 'caveman-opencode.ts'), 'utf-8');
    const golden = readFileSync(join(FIXTURE_ROOT, 'opencode', 'plugins', 'caveman-opencode.ts'), 'utf-8');

    expect(actual).toBe(golden);
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
