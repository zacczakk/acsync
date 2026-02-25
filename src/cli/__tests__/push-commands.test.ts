import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { cpSync, mkdtempSync } from 'node:fs';
import { withTargetBackup } from '../../../test/helpers/backup';
import { runPush } from '../push';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../../../test/fixtures');

/** Copy canonical fixtures into a temp dir structured as a project (configs/ subdirectory) */
function setupProjectDir(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'push-cmd-test-'));
  const configsDir = join(tmp, 'configs');
  cpSync(join(FIXTURE_ROOT, 'canonical'), configsDir, { recursive: true });
  return tmp;
}

/** Target paths for commands across all 4 targets */
const TARGET_PATHS = {
  claude: join(homedir(), '.claude', 'commands'),
  opencode: join(homedir(), '.config', 'opencode', 'command'),
  gemini: join(homedir(), '.gemini', 'commands'),
  codex: join(homedir(), '.codex', 'prompts'),
};

/** Remove command files from all targets so push always detects drift */
function clearTargetCommands(): void {
  for (const dir of Object.values(TARGET_PATHS)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('push-commands E2E', () => {
  test('pushes commands to all 4 targets matching golden fixtures', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();
      clearTargetCommands();
      const result = await runPush({ projectDir, force: true, types: ['command'] });

      // OrchestratorPushResult assertions
      expect(result.written).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
      expect(result.rolledBack).toBe(false);

      // Claude: groom-docs.md
      const claudePushed = readFileSync(join(TARGET_PATHS.claude, 'groom-docs.md'), 'utf-8');
      const claudeGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'commands', 'groom-docs.md'), 'utf-8');
      expect(claudePushed).toBe(claudeGolden);

      // OpenCode: groom-docs.md
      const opencodePushed = readFileSync(join(TARGET_PATHS.opencode, 'groom-docs.md'), 'utf-8');
      const opencodeGolden = readFileSync(join(FIXTURE_ROOT, 'opencode', 'commands', 'groom-docs.md'), 'utf-8');
      expect(opencodePushed).toBe(opencodeGolden);

      // Gemini: groom-docs.toml
      const geminiPushed = readFileSync(join(TARGET_PATHS.gemini, 'groom-docs.toml'), 'utf-8');
      const geminiGolden = readFileSync(join(FIXTURE_ROOT, 'gemini', 'commands', 'groom-docs.toml'), 'utf-8');
      expect(geminiPushed).toBe(geminiGolden);

      // Codex: groom-docs.md (commands go to prompts/)
      const codexPushed = readFileSync(join(TARGET_PATHS.codex, 'groom-docs.md'), 'utf-8');
      const codexGolden = readFileSync(join(FIXTURE_ROOT, 'codex', 'commands', 'groom-docs.md'), 'utf-8');
      expect(codexPushed).toBe(codexGolden);

      // Also check obs-jot command across targets
      const claudeObsJot = readFileSync(join(TARGET_PATHS.claude, 'obs-jot.md'), 'utf-8');
      const claudeObsJotGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'commands', 'obs-jot.md'), 'utf-8');
      expect(claudeObsJot).toBe(claudeObsJotGolden);
    });
  }, E2E_TIMEOUT);

  test('second push is idempotent (no drift)', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();

      // First push
      await runPush({ projectDir, force: true, types: ['command'] });

      // Second push — should detect no drift
      const result2 = await runPush({ projectDir, force: true, types: ['command'] });
      expect(result2.hasDrift).toBe(false);
      expect(result2.written).toBe(0);
    });
  }, E2E_TIMEOUT);

  test('stale command files are removed with deleteStale', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();

      // First push to establish baseline
      await runPush({ projectDir, force: true, types: ['command'] });

      // Plant a stale file in Claude commands dir
      const stalePath = join(TARGET_PATHS.claude, 'stale-test-command.md');
      writeFileSync(stalePath, '---\ndescription: stale\n---\n\nStale command.\n');
      expect(existsSync(stalePath)).toBe(true);

      // Push with deleteStale
      await runPush({ projectDir, force: true, deleteStale: true, types: ['command'] });

      // Stale file should be gone
      expect(existsSync(stalePath)).toBe(false);

      // Canonical commands should still exist
      expect(existsSync(join(TARGET_PATHS.claude, 'groom-docs.md'))).toBe(true);
    });
  }, E2E_TIMEOUT);
});
