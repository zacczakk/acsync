import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import os from 'node:os';
import { withTargetBackup } from '../../../test/helpers/backup';
import { runPush } from '../push';
import { createAdapter } from '../canonical';
import type { TargetName } from '../../types';

const FIXTURE_ROOT = join(import.meta.dir, '../../../test/fixtures');
const SEEDS_ROOT = join(FIXTURE_ROOT, 'seeds');
const CANONICAL_ROOT = join(FIXTURE_ROOT, 'canonical');

/** Build a temp project dir pointing at canonical fixtures */
function setupProjectDir(): string {
  const dir = join(os.tmpdir(), `push-settings-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  cpSync(CANONICAL_ROOT, join(dir, 'configs'), { recursive: true });
  return dir;
}

/** Seed real target settings files with pre-existing content */
function seedSettingsTargets(): void {
  const targets: Array<{ target: TargetName; seedFile: string }> = [
    { target: 'claude-code', seedFile: join(SEEDS_ROOT, 'claude/settings.json') },
    { target: 'opencode', seedFile: join(SEEDS_ROOT, 'opencode/settings.jsonc') },
  ];

  for (const { target, seedFile } of targets) {
    const adapter = createAdapter(target);
    const settingsPath = adapter.getPaths().getSettingsPath();
    mkdirSync(dirname(settingsPath), { recursive: true });
    cpSync(seedFile, settingsPath);
  }
}

describe('push settings E2E', () => {
  test('pushes settings to claude + opencode, matches goldens, skips gemini/codex, idempotent', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();
      seedSettingsTargets();

      // --- Push settings ---
      const result = await runPush({ projectDir, force: true, types: ['settings'] });
      expect(result.failed).toBe(0);
      expect(result.rolledBack).toBe(false);
      // Claude + OpenCode = 2 writes
      expect(result.written).toBe(2);

      // --- Claude golden comparison ---
      const claudeAdapter = createAdapter('claude-code');
      const claudeActual = readFileSync(claudeAdapter.getPaths().getSettingsPath(), 'utf-8');
      const claudeGolden = readFileSync(join(FIXTURE_ROOT, 'claude/settings/settings.json'), 'utf-8');
      expect(claudeActual).toBe(claudeGolden);

      // --- OpenCode golden comparison ---
      const opencodeAdapter = createAdapter('opencode');
      const opencodeActual = readFileSync(opencodeAdapter.getPaths().getSettingsPath(), 'utf-8');
      const opencodeGolden = readFileSync(join(FIXTURE_ROOT, 'opencode/settings/opencode.json'), 'utf-8');
      expect(opencodeActual).toBe(opencodeGolden);

      // --- Verify non-canonical keys preserved ---
      expect(claudeActual).toContain('customKey');
      expect(opencodeActual).toContain('customKey');

      // --- Gemini/Codex: settings capability is false, no writes expected ---
      const geminiCaps = createAdapter('gemini').getCapabilities();
      expect(geminiCaps.settings).toBe(false);
      const codexCaps = createAdapter('codex').getCapabilities();
      expect(codexCaps.settings).toBe(false);

      // --- Idempotency: second push reports no drift ---
      const result2 = await runPush({ projectDir, force: true, types: ['settings'] });
      expect(result2.hasDrift).toBe(false);
      expect(result2.written).toBe(0);
    });
  });
});
