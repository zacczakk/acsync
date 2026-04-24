import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { createAdapter } from '../../src/cli/canonical';
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
  test('pushes settings to claude + opencode + codex, matches goldens, skips gemini, idempotent', async () => {
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
    const cavemanSessionStartCommand = 'node "$HOME/Repos/zacczakk/metronome/configs/hooks/caveman-sessionstart-claude.js"';
    const cavemanUserPromptCommand = 'node "$HOME/Repos/zacczakk/metronome/configs/hooks/caveman-userprompt-claude.js"';

    expect(claudeActual.trimEnd()).toBe(claudeGolden.trimEnd());
    expect(claudeHooks.SessionStart).toBeArray();
    expect(sessionStartCommands).toContain(vaultLoaderCommand);
    expect(sessionStartCommands).toContain(cavemanSessionStartCommand);
    expect(claudeHooks.UserPromptSubmit).toBeArray();
    expect(userPromptSubmitGroups).toHaveLength(1);
    expect(userPromptSubmitCommands).toEqual([cavemanUserPromptCommand]);
    expect(sessionStartCommands.filter((command) => command === cavemanSessionStartCommand)).toHaveLength(1);
    expect(userPromptSubmitCommands.filter((command) => command === cavemanUserPromptCommand)).toHaveLength(1);

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

    // --- Gemini only: no settings capability ---
    const geminiCaps = createAdapter('gemini').getCapabilities();
    expect(geminiCaps.settings).toBe(false);
    const codexCaps = createAdapter('codex').getCapabilities();
    expect(codexCaps.settings).toBe(true);

    // --- Idempotency: second push reports no drift ---
    const result2 = await runPush({ projectDir, force: true, types: ['settings'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  });
});
