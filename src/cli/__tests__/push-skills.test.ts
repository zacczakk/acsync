import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { cpSync, mkdtempSync } from 'node:fs';
import { withTargetBackup } from '../../../test/helpers/backup';
import { runPush } from '../push';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../../../test/fixtures');

function setupProjectDir(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'push-skill-test-'));
  const configsDir = join(tmp, 'configs');
  cpSync(join(FIXTURE_ROOT, 'canonical'), configsDir, { recursive: true });
  return tmp;
}

/** Target paths for skills across all 4 targets (opencode uses skill/ singular) */
const TARGET_PATHS = {
  claude: join(homedir(), '.claude', 'skills'),
  opencode: join(homedir(), '.config', 'opencode', 'skill'),
  gemini: join(homedir(), '.gemini', 'skills'),
  codex: join(homedir(), '.codex', 'skills'),
};

describe('push-skills E2E', () => {
  test('pushes skills to all 4 targets matching golden fixtures', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();
      const result = await runPush({ projectDir, force: true, types: ['skill'] });

      expect(result.written).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
      expect(result.rolledBack).toBe(false);

      // Skills use {target}/skills/{name}/SKILL.md structure
      // Claude: obsidian/SKILL.md
      const claudeObsidian = readFileSync(join(TARGET_PATHS.claude, 'obsidian', 'SKILL.md'), 'utf-8');
      const claudeObsidianGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
      expect(claudeObsidian).toBe(claudeObsidianGolden);

      // OpenCode: obsidian/SKILL.md (in skill/ dir, not skills/)
      const opencodeObsidian = readFileSync(join(TARGET_PATHS.opencode, 'obsidian', 'SKILL.md'), 'utf-8');
      const opencodeObsidianGolden = readFileSync(join(FIXTURE_ROOT, 'opencode', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
      expect(opencodeObsidian).toBe(opencodeObsidianGolden);

      // Gemini: obsidian/SKILL.md
      const geminiObsidian = readFileSync(join(TARGET_PATHS.gemini, 'obsidian', 'SKILL.md'), 'utf-8');
      const geminiObsidianGolden = readFileSync(join(FIXTURE_ROOT, 'gemini', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
      expect(geminiObsidian).toBe(geminiObsidianGolden);

      // Codex: obsidian/SKILL.md
      const codexObsidian = readFileSync(join(TARGET_PATHS.codex, 'obsidian', 'SKILL.md'), 'utf-8');
      const codexObsidianGolden = readFileSync(join(FIXTURE_ROOT, 'codex', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
      expect(codexObsidian).toBe(codexObsidianGolden);

      // Also verify web-design-guidelines skill (second skill)
      const claudeWdg = readFileSync(join(TARGET_PATHS.claude, 'web-design-guidelines', 'SKILL.md'), 'utf-8');
      const claudeWdgGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'skills', 'web-design-guidelines', 'SKILL.md'), 'utf-8');
      expect(claudeWdg).toBe(claudeWdgGolden);
    });
  }, E2E_TIMEOUT);

  test('second push is idempotent (no drift)', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();
      await runPush({ projectDir, force: true, types: ['skill'] });

      const result2 = await runPush({ projectDir, force: true, types: ['skill'] });
      expect(result2.hasDrift).toBe(false);
      expect(result2.written).toBe(0);
    });
  }, E2E_TIMEOUT);

  test('stale skill directories are removed with deleteStale', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();
      await runPush({ projectDir, force: true, types: ['skill'] });

      // Plant a stale skill directory in Claude skills dir
      const staleDir = join(TARGET_PATHS.claude, 'stale-test-skill');
      mkdirSync(staleDir, { recursive: true });
      writeFileSync(join(staleDir, 'SKILL.md'), '---\nname: stale-test-skill\n---\n\nStale skill.\n');
      expect(existsSync(join(staleDir, 'SKILL.md'))).toBe(true);

      await runPush({ projectDir, force: true, deleteStale: true, types: ['skill'] });

      // Stale skill directory should be removed entirely
      expect(existsSync(staleDir)).toBe(false);

      // Canonical skills should still exist
      expect(existsSync(join(TARGET_PATHS.claude, 'obsidian', 'SKILL.md'))).toBe(true);
    });
  }, E2E_TIMEOUT);
});
