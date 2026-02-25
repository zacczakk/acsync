import { describe, expect, test } from 'bun:test';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { cpSync, mkdtempSync } from 'node:fs';
import { withTargetBackup } from '../helpers/backup';
import { runPull } from '../../src/cli/pull';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

/** Create a bare project dir with empty configs/ structure (no canonical items pre-populated) */
function setupProjectDir(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'pull-cmd-test-'));
  mkdirSync(join(tmp, 'configs', 'commands'), { recursive: true });
  return tmp;
}

/** Target paths where commands live for each target */
const TARGET_COMMAND_PATHS = {
  claude: join(homedir(), '.claude', 'commands'),
  opencode: join(homedir(), '.config', 'opencode', 'command'),
  gemini: join(homedir(), '.gemini', 'commands'),
  codex: join(homedir(), '.codex', 'prompts'),
};

/** Plant target-format command fixtures into real target directories */
function plantTargetCommands(): void {
  for (const [target, dir] of Object.entries(TARGET_COMMAND_PATHS)) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    cpSync(join(FIXTURE_ROOT, target, 'commands'), dir, { recursive: true });
  }
}

describe('pull-commands E2E', () => {
  test('pulls commands from all 4 targets matching canonical fixtures', async () => {
    await withTargetBackup(async () => {
      plantTargetCommands();

      // Pull from Claude (identity passthrough) — exact canonical match
      const claudeDir = setupProjectDir();
      await runPull({ source: 'claude-code', force: true, projectDir: claudeDir });

      const claudeGroom = readFileSync(join(claudeDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
      const canonicalGroom = readFileSync(join(FIXTURE_ROOT, 'canonical', 'commands', 'groom-docs.md'), 'utf-8');
      expect(claudeGroom).toBe(canonicalGroom);

      const claudeObsJot = readFileSync(join(claudeDir, 'configs', 'commands', 'obs-jot.md'), 'utf-8');
      const canonicalObsJot = readFileSync(join(FIXTURE_ROOT, 'canonical', 'commands', 'obs-jot.md'), 'utf-8');
      expect(claudeObsJot).toBe(canonicalObsJot);

      // Pull from OpenCode — also identity passthrough (frontmatter md)
      const opencodeDir = setupProjectDir();
      await runPull({ source: 'opencode', force: true, projectDir: opencodeDir });

      const ocGroom = readFileSync(join(opencodeDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
      expect(ocGroom).toBe(canonicalGroom);

      // Pull from Gemini (TOML → canonical): description present, body matches
      const geminiDir = setupProjectDir();
      await runPull({ source: 'gemini', force: true, projectDir: geminiDir });

      const gemGroom = readFileSync(join(geminiDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
      expect(gemGroom).toContain('description:');
      // Body content should match canonical body (after frontmatter)
      const canonicalBody = canonicalGroom.split('---').slice(2).join('---').trim();
      const gemBody = gemGroom.split('---').slice(2).join('---').trim();
      expect(gemBody).toBe(canonicalBody);

      // Pull from Codex (flat md → canonical): description present, body matches
      const codexDir = setupProjectDir();
      await runPull({ source: 'codex', force: true, projectDir: codexDir });

      const cdxGroom = readFileSync(join(codexDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
      expect(cdxGroom).toContain('description:');
      const cdxBody = cdxGroom.split('---').slice(2).join('---').trim();
      expect(cdxBody).toBe(canonicalBody);
    });
  }, E2E_TIMEOUT);

  test('non-force pull skips existing canonical commands', async () => {
    await withTargetBackup(async () => {
      plantTargetCommands();

      const projectDir = setupProjectDir();
      // Pre-populate with sentinel content
      writeFileSync(join(projectDir, 'configs', 'commands', 'groom-docs.md'), 'existing sentinel');

      const result = await runPull({ source: 'claude-code', projectDir });

      // groom-docs should have been skipped (sentinel preserved)
      const content = readFileSync(join(projectDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
      expect(content).toBe('existing sentinel');

      // Result items should show skip for groom-docs
      const groomItem = result.items.find((i) => i.type === 'command' && i.name === 'groom-docs');
      expect(groomItem?.action).toBe('skip');
    });
  }, E2E_TIMEOUT);

  test('force pull overwrites existing canonical commands', async () => {
    await withTargetBackup(async () => {
      plantTargetCommands();

      const projectDir = setupProjectDir();
      // Pre-populate with sentinel content
      writeFileSync(join(projectDir, 'configs', 'commands', 'groom-docs.md'), 'existing sentinel');

      await runPull({ source: 'claude-code', force: true, projectDir });

      // groom-docs should now match canonical fixture
      const content = readFileSync(join(projectDir, 'configs', 'commands', 'groom-docs.md'), 'utf-8');
      const canonical = readFileSync(join(FIXTURE_ROOT, 'canonical', 'commands', 'groom-docs.md'), 'utf-8');
      expect(content).toBe(canonical);
    });
  }, E2E_TIMEOUT);
});
