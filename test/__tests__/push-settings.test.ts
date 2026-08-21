import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { createAdapter } from '../../src/cli/canonical';
import { readJsonc } from '../../src/formats/jsonc';
import type { TargetName } from '../../src/types';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');
const SEEDS_ROOT = join(FIXTURE_ROOT, 'seeds');

/** Seed settings files into fakeHome from seeds/ */
function seedSettingsTargets(fakeHome: string): void {
  const targets: Array<{ target: TargetName; seedFile: string }> = [
    { target: 'claude-code', seedFile: join(SEEDS_ROOT, 'claude/settings.json') },
    { target: 'opencode', seedFile: join(SEEDS_ROOT, 'opencode/settings.jsonc') },
    { target: 'codex', seedFile: join(SEEDS_ROOT, 'codex/config.toml') },
  ];

  for (const { target, seedFile } of targets) {
    const adapter = createAdapter(target, fakeHome);
    const settingsPath = adapter.getPaths().getSettingsPath();
    mkdirSync(dirname(settingsPath), { recursive: true });
    cpSync(seedFile, settingsPath);
  }
}

describe('push settings E2E', () => {
    test('pushes settings to claude + opencode + codex, matches goldens, skips antigravity, idempotent', async () => {
    const fakeHome = createTestHome('push-settings');
    const projectDir = createTestProject('push-settings', FIXTURE_ROOT);
    cpSync(join(process.cwd(), 'configs', 'settings', 'claude.json'), join(projectDir, 'configs', 'settings', 'claude.json'));
    seedSettingsTargets(fakeHome);

    // --- Push settings ---
    const result = await runPush({ projectDir, force: true, types: ['settings'], homeDir: fakeHome });
    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);
    // Claude + OpenCode + Codex = 3 writes
    expect(result.written).toBe(3);

    // --- Claude golden comparison ---
    const claudeAdapter = createAdapter('claude-code', fakeHome);
    const claudeActual = readFileSync(claudeAdapter.getPaths().getSettingsPath(), 'utf-8');
    const claudeGolden = readFileSync(join(FIXTURE_ROOT, 'claude/settings/settings.json'), 'utf-8');
    const claudeParsed = JSON.parse(claudeActual) as {
      hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    const claudeHooks = claudeParsed.hooks ?? {};
    const sessionStartGroups = claudeHooks.SessionStart ?? [];
    const userPromptSubmitGroups = claudeHooks.UserPromptSubmit ?? [];
    const sessionStartCommands = sessionStartGroups.flatMap((group) => group.hooks.map((hook) => hook.command));
    const userPromptSubmitCommands = userPromptSubmitGroups.flatMap((group) => group.hooks.map((hook) => hook.command));
    const vaultLoaderCommand = 'node "$HOME/Repos/zacczakk/metronome/configs/hooks/vault-context-loader.js"';

    expect(claudeActual.trimEnd()).toBe(claudeGolden.trimEnd());
    expect(claudeHooks.SessionStart).toBeArray();
    expect(sessionStartCommands).toContain(vaultLoaderCommand);
    expect(sessionStartCommands.filter((command) => command.includes('caveman'))).toEqual([]);
    expect(userPromptSubmitGroups).toEqual([]);
    expect(userPromptSubmitCommands).toEqual([]);

    // --- OpenCode golden comparison ---
    const opencodeAdapter = createAdapter('opencode', fakeHome);
    const opencodeActual = readFileSync(opencodeAdapter.getPaths().getSettingsPath(), 'utf-8');
    const opencodeGolden = readFileSync(join(FIXTURE_ROOT, 'opencode/settings/opencode.json'), 'utf-8');
    expect(opencodeActual.trimEnd()).toBe(opencodeGolden.trimEnd());

    // --- Verify non-canonical keys preserved ---
    expect(claudeActual).toContain('customKey');
    expect(opencodeActual).toContain('customKey');

    // --- Codex golden comparison ---
    const codexAdapter = createAdapter('codex', fakeHome);
    const codexActual = readFileSync(codexAdapter.getPaths().getSettingsPath(), 'utf-8');
    const codexGolden = readFileSync(join(FIXTURE_ROOT, 'codex/settings/config.toml'), 'utf-8');
    expect(codexActual.trimEnd()).toBe(codexGolden.trimEnd());

    // --- Antigravity only: no settings capability ---
    const antigravityCaps = createAdapter('antigravity').getCapabilities();
    expect(antigravityCaps.settings).toBe(false);
    const codexCaps = createAdapter('codex').getCapabilities();
    expect(codexCaps.settings).toBe(true);

    // --- Idempotency: second push reports no drift ---
    const result2 = await runPush({ projectDir, force: true, types: ['settings'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  });

  test('composes settings and MCP updates sharing the OpenCode config path', async () => {
    const fakeHome = createTestHome('push-settings-mcp');
    const projectDir = createTestProject('push-settings-mcp', FIXTURE_ROOT);
    seedSettingsTargets(fakeHome);

    const result = await runPush({
      projectDir,
      force: true,
      targets: ['opencode'],
      types: ['settings', 'mcp'],
      homeDir: fakeHome,
    });

    expect(result.failed).toBe(0);
    const opencodeAdapter = createAdapter('opencode', fakeHome);
    const config = readJsonc<{
      model?: string;
      mcp?: Record<string, { enabled?: boolean }>;
    }>(readFileSync(opencodeAdapter.getPaths().getSettingsPath(), 'utf-8'));

    expect(config.model).toBe('throttle-tux/claude-opus-4-6');
    expect(config.mcp?.['palantir-mcp']?.enabled).toBe(true);
  });

  test('syncs V2 agent variants when pushing agents alone', async () => {
    const fakeHome = createTestHome('push-v2-agent-variants');
    const projectDir = createTestProject('push-v2-agent-variants', FIXTURE_ROOT);
    rmSync(join(projectDir, 'configs', 'agents', 'simple-agent.md'));
    writeFileSync(join(projectDir, 'configs', 'settings', 'opencode.json'), JSON.stringify({
      provider: {
        tux: {
          npm: '@ai-sdk/openai',
          models: {
            'gpt-5.6-terra': {
              variants: { medium: { reasoningEffort: 'medium' } },
            },
          },
        },
      },
    }));
    writeFileSync(join(projectDir, 'configs', 'agents', 'test-agent.md'), [
      '---',
      'model: tux/gpt-5.6-terra',
      'reasoningEffort: medium',
      'textVerbosity: low',
      '---',
      '',
      'Verify.',
      '',
    ].join('\n'));

    const result = await runPush({
      projectDir,
      force: true,
      targets: ['opencode2'],
      types: ['agent'],
      homeDir: fakeHome,
    });

    expect(result.failed).toBe(0);
    expect(result.written).toBe(2);
    const config = JSON.parse(readFileSync(join(fakeHome, '.config', 'opencode', 'opencode.json'), 'utf8')) as {
      providers: Record<string, { models: Record<string, { variants: Array<{ id: string; settings: Record<string, string> }> }> }>;
    };
    expect(config.providers.tux.models['gpt-5.6-terra'].variants).toContainEqual({
      id: 'agent-test-agent',
      settings: { reasoningEffort: 'medium', textVerbosity: 'low' },
    });

    config.providers.openai = {
      models: {
        'gpt-5.6-luna-fast': {
          variants: [{ id: 'agent-test-agent', settings: { reasoningEffort: 'medium', textVerbosity: 'low' } }],
        },
      },
    };
    writeFileSync(join(fakeHome, '.config', 'opencode', 'opencode.json'), JSON.stringify(config));

    rmSync(join(projectDir, 'configs', 'agents', 'test-agent.md'));
    const cleanup = await runPush({
      projectDir,
      force: true,
      deleteStale: true,
      targets: ['opencode2'],
      types: ['agent'],
      homeDir: fakeHome,
    });

    expect(cleanup.failed).toBe(0);
    const cleanedConfig = JSON.parse(readFileSync(join(fakeHome, '.config', 'opencode', 'opencode.json'), 'utf8')) as {
      providers: {
        tux: { models: { 'gpt-5.6-terra': { variants: Array<{ id: string }> } } };
        openai?: { models?: { 'gpt-5.6-luna-fast'?: { variants: Array<{ id: string }> } } };
      };
    };
    expect(cleanedConfig.providers.tux.models['gpt-5.6-terra'].variants.map(({ id }) => id)).not.toContain('agent-test-agent');
    expect(cleanedConfig.providers.openai?.models?.['gpt-5.6-luna-fast']).toBeUndefined();
  });
});
