import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { createTestHome, seedTargetFixtures } from '../helpers/backup';
import { runPull } from '../../src/cli/pull';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

function setupProjectDir(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'pull-skill-test-'));
  mkdirSync(join(tmp, 'configs', 'skills'), { recursive: true });
  return tmp;
}

/** Seed all 4 targets' skill fixtures into fakeHome */
function plantTargetSkills(fakeHome: string): void {
  for (const target of ['claude', 'opencode', 'gemini', 'codex']) {
    seedTargetFixtures(fakeHome, FIXTURE_ROOT, target, 'skills');
  }
}

describe('pull-skills E2E', () => {
  test('pulls skills from claude matching canonical fixtures', async () => {
    const fakeHome = createTestHome('pull-skill-claude');
    plantTargetSkills(fakeHome);

    const projectDir = setupProjectDir();
    await runPull({ source: 'claude-code', force: true, projectDir, homeDir: fakeHome });

    // Skills are identity passthrough — should match canonical exactly
    const canonicalObsidian = readFileSync(join(FIXTURE_ROOT, 'canonical', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
    const pulledObsidian = readFileSync(join(projectDir, 'configs', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
    expect(pulledObsidian).toBe(canonicalObsidian);

    const canonicalWdg = readFileSync(join(FIXTURE_ROOT, 'canonical', 'skills', 'web-design-guidelines', 'SKILL.md'), 'utf-8');
    const pulledWdg = readFileSync(join(projectDir, 'configs', 'skills', 'web-design-guidelines', 'SKILL.md'), 'utf-8');
    expect(pulledWdg).toBe(canonicalWdg);
  }, E2E_TIMEOUT);

  test('pulls skills from opencode matching canonical fixtures', async () => {
    const fakeHome = createTestHome('pull-skill-opencode');
    plantTargetSkills(fakeHome);

    const projectDir = setupProjectDir();
    await runPull({ source: 'opencode', force: true, projectDir, homeDir: fakeHome });

    const canonicalObsidian = readFileSync(join(FIXTURE_ROOT, 'canonical', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
    const pulledObsidian = readFileSync(join(projectDir, 'configs', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
    expect(pulledObsidian).toBe(canonicalObsidian);
  }, E2E_TIMEOUT);
});
