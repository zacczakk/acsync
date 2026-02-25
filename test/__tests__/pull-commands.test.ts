import { describe, expect, test } from 'bun:test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { createTestHome, seedTargetFixtures } from '../helpers/backup';
import { runPull } from '../../src/cli/pull';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

function setupProjectDir(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'pull-cmd-test-'));
  mkdirSync(join(tmp, 'configs', 'commands'), { recursive: true });
  return tmp;
}

/** Seed all 4 targets' command fixtures into fakeHome */
function plantTargetCommands(fakeHome: string): void {
  for (const target of ['claude', 'opencode', 'gemini', 'codex']) {
    seedTargetFixtures(fakeHome, FIXTURE_ROOT, target, 'commands');
  }
}

describe('pull-commands E2E', () => {
  test('pulls commands from all 4 targets matching canonical fixtures', async () => {
    const fakeHome = createTestHome('pull-cmd-all');
    plantTargetCommands(fakeHome);

    // Pull from Claude (identity passthrough) — exact canonical match
    const claudeDir = setupProjectDir();
    await runPull({ source: 'claude-code', force: true, projectDir: claudeDir, homeDir: fakeHome });

    const claudeGroom = readFileSync(join(claudeDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
    const canonicalGroom = readFileSync(join(FIXTURE_ROOT, 'canonical', 'commands', 'groom-docs.md'), 'utf-8');
    expect(claudeGroom).toBe(canonicalGroom);

    const claudeObsJot = readFileSync(join(claudeDir, 'configs', 'commands', 'obs-jot.md'), 'utf-8');
    const canonicalObsJot = readFileSync(join(FIXTURE_ROOT, 'canonical', 'commands', 'obs-jot.md'), 'utf-8');
    expect(claudeObsJot).toBe(canonicalObsJot);

    // Pull from OpenCode — also identity passthrough (frontmatter md)
    const opencodeDir = setupProjectDir();
    await runPull({ source: 'opencode', force: true, projectDir: opencodeDir, homeDir: fakeHome });

    const ocGroom = readFileSync(join(opencodeDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
    expect(ocGroom).toBe(canonicalGroom);

    // Pull from Gemini (TOML -> canonical): description present, body matches
    const geminiDir = setupProjectDir();
    await runPull({ source: 'gemini', force: true, projectDir: geminiDir, homeDir: fakeHome });

    const gemGroom = readFileSync(join(geminiDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
    expect(gemGroom).toContain('description:');
    // Body content should match canonical body (after frontmatter)
    const canonicalBody = canonicalGroom.split('---').slice(2).join('---').trim();
    const gemBody = gemGroom.split('---').slice(2).join('---').trim();
    expect(gemBody).toBe(canonicalBody);

    // Pull from Codex (flat md -> canonical): description present, body matches
    const codexDir = setupProjectDir();
    await runPull({ source: 'codex', force: true, projectDir: codexDir, homeDir: fakeHome });

    const cdxGroom = readFileSync(join(codexDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
    expect(cdxGroom).toContain('description:');
    const cdxBody = cdxGroom.split('---').slice(2).join('---').trim();
    expect(cdxBody).toBe(canonicalBody);
  }, E2E_TIMEOUT);

  test('non-force pull skips existing canonical commands', async () => {
    const fakeHome = createTestHome('pull-cmd-skip');
    plantTargetCommands(fakeHome);

    const projectDir = setupProjectDir();
    // Pre-populate with sentinel content
    writeFileSync(join(projectDir, 'configs', 'commands', 'groom-docs.md'), 'existing sentinel');

    const result = await runPull({ source: 'claude-code', projectDir, homeDir: fakeHome });

    // groom-docs should have been skipped (sentinel preserved)
    const content = readFileSync(join(projectDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
    expect(content).toBe('existing sentinel');

    // Result items should show skip for groom-docs
    const groomItem = result.items.find((i) => i.type === 'command' && i.name === 'groom-docs');
    expect(groomItem?.action).toBe('skip');
  }, E2E_TIMEOUT);

  test('force pull overwrites existing canonical commands', async () => {
    const fakeHome = createTestHome('pull-cmd-force');
    plantTargetCommands(fakeHome);

    const projectDir = setupProjectDir();
    // Pre-populate with sentinel content
    writeFileSync(join(projectDir, 'configs', 'commands', 'groom-docs.md'), 'existing sentinel');

    await runPull({ source: 'claude-code', force: true, projectDir, homeDir: fakeHome });

    // groom-docs should now match canonical fixture
    const content = readFileSync(join(projectDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
    const canonical = readFileSync(join(FIXTURE_ROOT, 'canonical', 'commands', 'groom-docs.md'), 'utf-8');
    expect(content).toBe(canonical);
  }, E2E_TIMEOUT);
});
