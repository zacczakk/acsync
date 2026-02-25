import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

/** Target output paths inside a fakeHome */
function targetPaths(fakeHome: string) {
  return {
    claude: join(fakeHome, '.claude', 'commands'),
    opencode: join(fakeHome, '.config', 'opencode', 'command'),
    gemini: join(fakeHome, '.gemini', 'commands'),
    codex: join(fakeHome, '.codex', 'prompts'),
  };
}

describe('push-commands E2E', () => {
  test('pushes commands to all 4 targets matching golden fixtures', async () => {
    const fakeHome = createTestHome('push-cmd');
    const projectDir = createTestProject('push-cmd', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);

    const result = await runPush({ projectDir, force: true, types: ['command'], homeDir: fakeHome });

    expect(result.written).toBeGreaterThan(0);
    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);

    // Claude: groom-docs.md
    const claudePushed = readFileSync(join(paths.claude, 'groom-docs.md'), 'utf-8');
    const claudeGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'commands', 'groom-docs.md'), 'utf-8');
    expect(claudePushed).toBe(claudeGolden);

    // OpenCode: groom-docs.md
    const opencodePushed = readFileSync(join(paths.opencode, 'groom-docs.md'), 'utf-8');
    const opencodeGolden = readFileSync(join(FIXTURE_ROOT, 'opencode', 'commands', 'groom-docs.md'), 'utf-8');
    expect(opencodePushed).toBe(opencodeGolden);

    // Gemini: groom-docs.toml
    const geminiPushed = readFileSync(join(paths.gemini, 'groom-docs.toml'), 'utf-8');
    const geminiGolden = readFileSync(join(FIXTURE_ROOT, 'gemini', 'commands', 'groom-docs.toml'), 'utf-8');
    expect(geminiPushed).toBe(geminiGolden);

    // Codex: groom-docs.md (commands go to prompts/)
    const codexPushed = readFileSync(join(paths.codex, 'groom-docs.md'), 'utf-8');
    const codexGolden = readFileSync(join(FIXTURE_ROOT, 'codex', 'commands', 'groom-docs.md'), 'utf-8');
    expect(codexPushed).toBe(codexGolden);

    // Also check obs-jot command across targets
    const claudeObsJot = readFileSync(join(paths.claude, 'obs-jot.md'), 'utf-8');
    const claudeObsJotGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'commands', 'obs-jot.md'), 'utf-8');
    expect(claudeObsJot).toBe(claudeObsJotGolden);
  }, E2E_TIMEOUT);

  test('second push is idempotent (no drift)', async () => {
    const fakeHome = createTestHome('push-cmd-idem');
    const projectDir = createTestProject('push-cmd-idem', FIXTURE_ROOT);

    await runPush({ projectDir, force: true, types: ['command'], homeDir: fakeHome });

    const result2 = await runPush({ projectDir, force: true, types: ['command'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  }, E2E_TIMEOUT);

  test('stale command files are removed with deleteStale', async () => {
    const fakeHome = createTestHome('push-cmd-stale');
    const projectDir = createTestProject('push-cmd-stale', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);

    // First push to establish baseline
    await runPush({ projectDir, force: true, types: ['command'], homeDir: fakeHome });

    // Plant a stale file in Claude commands dir
    const stalePath = join(paths.claude, 'stale-test-command.md');
    writeFileSync(stalePath, '---\ndescription: stale\n---\n\nStale command.\n');
    expect(existsSync(stalePath)).toBe(true);

    // Push with deleteStale
    await runPush({ projectDir, force: true, deleteStale: true, types: ['command'], homeDir: fakeHome });

    // Stale file should be gone
    expect(existsSync(stalePath)).toBe(false);

    // Canonical commands should still exist
    expect(existsSync(join(paths.claude, 'groom-docs.md'))).toBe(true);
  }, E2E_TIMEOUT);
});
