import { afterEach, describe, expect, test } from 'bun:test';
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { switchOpenCodeVersion } from '../profile';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(): Promise<{ projectDir: string; homeDir: string }> {
  const root = await mkdtemp(join(tmpdir(), 'metronome-opencode-'));
  roots.push(root);
  const projectDir = join(root, 'project');
  const homeDir = join(root, 'home');
  await mkdir(join(projectDir, 'configs', 'settings'), { recursive: true });
  await mkdir(join(projectDir, 'configs', 'agents'), { recursive: true });
  await mkdir(join(projectDir, 'configs', 'mcp'), { recursive: true });
  await mkdir(join(projectDir, 'configs', 'plugins'), { recursive: true });
  await mkdir(join(projectDir, 'configs', 'opencode', 'v1', 'plugins'), { recursive: true });
  await mkdir(join(projectDir, 'configs', 'opencode', 'v2', 'plugins'), { recursive: true });
  await mkdir(join(homeDir, '.config', 'opencode', 'plugins'), { recursive: true });
  await mkdir(join(homeDir, '.opencode', 'plugins'), { recursive: true });

  await writeFile(join(projectDir, 'configs', 'settings', 'opencode.json'), JSON.stringify({
    instructions: ['~/.config/opencode/AGENTS.md', '~/Vaults/Memory/SOUL.md'],
    permission: { bash: { '*': 'allow' } },
    plugin: ['context-mode', './chatgpt-websearch'],
    websearch: { provider: 'chatgpt' },
    provider: { acme: { npm: '@ai-sdk/anthropic', models: { claude: { name: 'Claude' } } } },
  }));
  await writeFile(join(projectDir, 'configs', 'agents', 'review.md'), '---\nmodel: acme/claude\nreasoningEffort: high\npermission:\n  edit: deny\n---\nReview.\n');
  await writeFile(join(projectDir, 'configs', 'mcp', 'tool.json'), JSON.stringify({ transport: 'stdio', command: 'tool', enabled: true }));
  for (const name of ['memory-vault-advisor.ts', 'read-guard.ts', 'validate-commit.ts']) {
    await writeFile(join(projectDir, 'configs', 'plugins', name), `// v1 ${name}\n`);
  }
  for (const name of ['instructions-loader.ts', 'memory-vault-advisor.ts', 'read-guard.ts', 'validate-commit.ts']) {
    await writeFile(join(projectDir, 'configs', 'opencode', 'v2', 'plugins', name), `// v2 ${name}\n`);
  }
  await writeFile(join(projectDir, 'configs', 'opencode', 'v1', 'plugins', 'muxy-notify.js'), '// v1 muxy\n');
  await writeFile(join(projectDir, 'configs', 'opencode', 'v2', 'plugins', 'muxy-notify.js'), '// v2 muxy\n');
  await writeFile(join(homeDir, '.config', 'opencode', 'opencode.json'), JSON.stringify({ provider: { tux: { name: 'Tux overlay' } }, custom: true }));
  await writeFile(join(homeDir, '.config', 'opencode', 'plugins', 'third-party.ts'), '// preserve\n');
  await writeFile(join(homeDir, '.opencode', 'plugins', 'muxy-notify.js'), '// external muxy\n');
  await writeFile(join(root, 'cursor.js'), '// cursor\n');
  await symlink(join(root, 'cursor.js'), join(homeDir, '.config', 'opencode', 'plugins', 'cursor-oauth.js'));
  return { projectDir, homeDir };
}

describe('switchOpenCodeVersion', () => {
  test('round trips V2 and V1 while preserving unknown state and logging backups', async () => {
    const paths = await fixture();
    const first = await switchOpenCodeVersion({ ...paths, version: 'v2', now: new Date('2026-08-10T12:00:00Z') });
    const v2 = JSON.parse(await readFile(join(paths.homeDir, '.config', 'opencode', 'opencode.json'), 'utf8'));
    expect(v2.custom).toBe(true);
    expect(v2.provider.tux.name).toBe('Tux overlay');
    expect(v2.providers.acme.models.claude.limit).toEqual({ output: 64000 });
    expect(v2.permissions[0]).toEqual({ action: 'shell', resource: '*', effect: 'allow' });
    expect(v2.mcp.servers.tool.disabled).toBe(false);
    expect(v2.plugins).not.toContain('context-mode');
    expect(v2.plugins).toEqual(['./chatgpt-websearch']);
    expect(v2.websearch).toEqual({ provider: 'chatgpt' });
    expect(await readFile(join(paths.homeDir, '.config', 'opencode', 'plugins', 'third-party.ts'), 'utf8')).toBe('// preserve\n');
    expect(await readFile(join(paths.homeDir, '.config', 'opencode', 'plugins', 'muxy-notify.js'), 'utf8')).toBe('// v2 muxy\n');
    expect(await readFile(join(paths.homeDir, '.opencode', 'plugins', 'muxy-notify.js'), 'utf8')).toBe('// external muxy\n');
    expect(await Bun.file(join(paths.homeDir, '.config', 'opencode', 'plugins', 'cursor-oauth.js')).exists()).toBe(false);
    expect(await Bun.file(join(first.backupPath, '.config', 'opencode', 'plugins', 'cursor-oauth.js')).exists()).toBe(true);

    await switchOpenCodeVersion({ ...paths, version: 'v1', now: new Date('2026-08-10T13:00:00Z') });
    const v1 = JSON.parse(await readFile(join(paths.homeDir, '.config', 'opencode', 'opencode.json'), 'utf8'));
    expect(v1.permission.bash['*']).toBe('allow');
    expect(v1.provider.acme.models.claude.limit).toBeUndefined();
    expect(v1.provider.tux.name).toBe('Tux overlay');
    expect(v1.mcp.tool.enabled).toBe(true);
    expect(v1.plugin).not.toContain('./chatgpt-websearch');
    expect(v1.websearch).toBeUndefined();
    expect(await Bun.file(join(paths.homeDir, '.config', 'opencode', 'plugins', 'muxy-notify.js')).exists()).toBe(false);
    expect(await readFile(join(paths.homeDir, '.opencode', 'plugins', 'muxy-notify.js'), 'utf8')).toBe('// external muxy\n');
    expect(await Bun.file(join(paths.homeDir, '.config', 'opencode', 'plugins', 'cursor-oauth.js')).exists()).toBe(true);
    const manifest = JSON.parse(await readFile(join(paths.homeDir, '.config', 'opencode', 'migration-manifest.json'), 'utf8'));
    expect(manifest.active).toBe('v1');
    expect(manifest.history).toHaveLength(2);
    expect(manifest.history[0].plugins['context-mode']).toBe('unsupported');
    expect(manifest.history[0].plugins['opencode.chatgpt-websearch']).toBe('inactive');
  });

  test('records observed V1 plugin state instead of assuming optional integrations exist', async () => {
    const paths = await fixture();
    await rm(join(paths.homeDir, '.opencode', 'plugins', 'muxy-notify.js'));
    await rm(join(paths.homeDir, '.config', 'opencode', 'plugins', 'cursor-oauth.js'));

    await switchOpenCodeVersion({ ...paths, version: 'v1', now: new Date('2026-08-10T13:30:00Z') });

    const manifest = JSON.parse(await readFile(join(paths.homeDir, '.config', 'opencode', 'migration-manifest.json'), 'utf8'));
    expect(manifest.history[0].plugins).toMatchObject({
      'memory-vault-advisor': 'active',
      'muxy-notify': 'inactive',
      'cursor-oauth': 'inactive',
      'context-mode': 'active',
    });
  });

  test('dry run writes nothing', async () => {
    const paths = await fixture();
    const before = await readFile(join(paths.homeDir, '.config', 'opencode', 'opencode.json'), 'utf8');
    const result = await switchOpenCodeVersion({ ...paths, version: 'v2', dryRun: true });
    expect(result.written).toEqual([]);
    expect(await readFile(join(paths.homeDir, '.config', 'opencode', 'opencode.json'), 'utf8')).toBe(before);
  });

  test('preserves JSONC-only unrelated and Tux state', async () => {
    const paths = await fixture();
    await writeFile(join(paths.homeDir, '.config', 'opencode', 'opencode.json'), `{
      // third-party state
      "custom": true,
      "provider": { "tux": { "name": "Tux overlay" } },
    }`);
    await switchOpenCodeVersion({ ...paths, version: 'v2', now: new Date('2026-08-10T14:00:00Z') });
    const config = JSON.parse(await readFile(join(paths.homeDir, '.config', 'opencode', 'opencode.json'), 'utf8'));
    expect(config.custom).toBe(true);
    expect(config.provider.tux.name).toBe('Tux overlay');
  });

  test('restores the complete backup when protected preparation fails', async () => {
    const paths = await fixture();
    const configPath = join(paths.homeDir, '.config', 'opencode', 'opencode.json');
    const packagePath = join(paths.homeDir, '.config', 'opencode', 'package.json');
    await writeFile(packagePath, '{"dependencies":{"plugin":"old"}}\n');
    const before = await readFile(configPath, 'utf8');
    let rolledBack = false;
    await expect(switchOpenCodeVersion({
      ...paths,
      version: 'v2',
      now: new Date('2026-08-10T15:00:00Z'),
      prepare: async () => {
        await writeFile(configPath, '{"broken":true}\n');
        await writeFile(packagePath, '{"dependencies":{"plugin":"new"}}\n');
        throw new Error('prepare failed');
      },
      rollback: async () => { rolledBack = true; },
    })).rejects.toThrow('prepare failed');
    expect(await readFile(configPath, 'utf8')).toBe(before);
    expect(await readFile(packagePath, 'utf8')).toBe('{"dependencies":{"plugin":"old"}}\n');
    expect(rolledBack).toBe(true);
  });

  test('restores rendered files when manifest persistence fails', async () => {
    const paths = await fixture();
    const configPath = join(paths.homeDir, '.config', 'opencode', 'opencode.json');
    const manifestPath = join(paths.homeDir, '.config', 'opencode', 'migration-manifest.json');
    const before = await readFile(configPath, 'utf8');
    await mkdir(manifestPath);

    await expect(switchOpenCodeVersion({
      ...paths,
      version: 'v2',
      now: new Date('2026-08-10T16:00:00Z'),
    })).rejects.toThrow('Failed to write file atomically');

    expect(await readFile(configPath, 'utf8')).toBe(before);
    expect((await lstat(manifestPath)).isDirectory()).toBe(true);
  });
});
