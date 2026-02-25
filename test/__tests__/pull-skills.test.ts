import { describe, expect, test } from 'bun:test';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { cpSync, mkdtempSync } from 'node:fs';
import { withTargetBackup } from '../helpers/backup';
import { runPull } from '../../src/cli/pull';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

/** Create a bare project dir with empty configs/ structure */
function setupProjectDir(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'pull-skill-test-'));
  mkdirSync(join(tmp, 'configs', 'skills'), { recursive: true });
  return tmp;
}

/** Target paths where skills live for each target */
const TARGET_SKILL_PATHS = {
  claude: join(homedir(), '.claude', 'skills'),
  opencode: join(homedir(), '.config', 'opencode', 'skill'),
  gemini: join(homedir(), '.gemini', 'skills'),
  codex: join(homedir(), '.codex', 'skills'),
};

/** Plant target-format skill fixtures into real target directories */
function plantTargetSkills(): void {
  for (const [target, dir] of Object.entries(TARGET_SKILL_PATHS)) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const fixtureDir = join(FIXTURE_ROOT, target, 'skills');
    cpSync(fixtureDir, dir, { recursive: true });
  }
}

describe('pull-skills E2E', () => {
  test('pulls skills from claude matching canonical fixtures', async () => {
    await withTargetBackup(async () => {
      plantTargetSkills();

      const projectDir = setupProjectDir();
      await runPull({ source: 'claude-code', force: true, projectDir });

      // Skills are identity passthrough — should match canonical exactly
      const canonicalObsidian = readFileSync(join(FIXTURE_ROOT, 'canonical', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
      const pulledObsidian = readFileSync(join(projectDir, 'configs', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
      expect(pulledObsidian).toBe(canonicalObsidian);

      const canonicalWdg = readFileSync(join(FIXTURE_ROOT, 'canonical', 'skills', 'web-design-guidelines', 'SKILL.md'), 'utf-8');
      const pulledWdg = readFileSync(join(projectDir, 'configs', 'skills', 'web-design-guidelines', 'SKILL.md'), 'utf-8');
      expect(pulledWdg).toBe(canonicalWdg);
    });
  }, E2E_TIMEOUT);

  test('pulls skills from opencode matching canonical fixtures', async () => {
    await withTargetBackup(async () => {
      plantTargetSkills();

      const projectDir = setupProjectDir();
      await runPull({ source: 'opencode', force: true, projectDir });

      const canonicalObsidian = readFileSync(join(FIXTURE_ROOT, 'canonical', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
      const pulledObsidian = readFileSync(join(projectDir, 'configs', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
      expect(pulledObsidian).toBe(canonicalObsidian);
    });
  }, E2E_TIMEOUT);
});
