import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

describe('OpenCode V2 plugin contracts', () => {
  test('Muxy uses the native V2 Plugin.define export', async () => {
    const source = await readFile(join(import.meta.dir, '../../../configs/opencode/v2/plugins/muxy-notify.js'), 'utf8');
    expect(source).toContain('import { Plugin } from "@opencode-ai/plugin"');
    expect(source).toContain('export default Plugin.define({');
    expect(source).not.toContain('export default {');
  });
});
