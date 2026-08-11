import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTargetAdapter } from '../canonical';

describe('active OpenCode target', () => {
  test('uses V2 when the migration manifest remembers V2', async () => {
    const home = await mkdtemp(join(tmpdir(), 'metronome-opencode-profile-'));
    await mkdir(join(home, '.config', 'opencode'), { recursive: true });
    await writeFile(join(home, '.config', 'opencode', 'migration-manifest.json'), JSON.stringify({ version: 1, active: 'v2', history: [] }));

    const adapter = await createTargetAdapter('opencode', home);
    const rendered = adapter.renderSettings({ target: 'opencode', keys: { permission: { bash: 'allow' } } });

    expect(rendered).toContain('"permissions"');
  });

  test('defaults to V1 when the migration manifest is invalid', async () => {
    const home = await mkdtemp(join(tmpdir(), 'metronome-opencode-profile-'));
    await mkdir(join(home, '.config', 'opencode'), { recursive: true });
    await writeFile(join(home, '.config', 'opencode', 'migration-manifest.json'), '{}');

    const adapter = await createTargetAdapter('opencode', home);
    const rendered = adapter.renderSettings({ target: 'opencode', keys: { permission: { bash: 'allow' } } });

    expect(rendered).toContain('"permission"');
  });
});
