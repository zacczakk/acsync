import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLI_VERSION } from '../version';

describe('CLI version', () => {
  test('matches package.json', () => {
    const packageJson = JSON.parse(
      readFileSync(join(import.meta.dir, '../../../package.json'), 'utf-8'),
    ) as { version: string };

    expect(CLI_VERSION).toBe(packageJson.version);
  });
});
