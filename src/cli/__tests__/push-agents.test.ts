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
  const tmp = mkdtempSync(join(tmpdir(), 'push-agent-test-'));
  const configsDir = join(tmp, 'configs');
  cpSync(join(FIXTURE_ROOT, 'canonical'), configsDir, { recursive: true });
  return tmp;
}

/** Target paths for agents across all 4 targets */
const TARGET_PATHS = {
  claude: join(homedir(), '.claude', 'agents'),
  opencode: join(homedir(), '.config', 'opencode', 'agents'),
  gemini: join(homedir(), '.gemini', 'agents'),
  codex: join(homedir(), '.codex', 'prompts'),
};

describe('push-agents E2E', () => {
  test('pushes agents to all 4 targets matching golden fixtures', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();
      const result = await runPush({ projectDir, force: true, types: ['agent'] });

      expect(result.written).toBeGreaterThan(0);
      expect(result.failed).toBe(0);
      expect(result.rolledBack).toBe(false);

      // Claude: test-agent.md
      const claudePushed = readFileSync(join(TARGET_PATHS.claude, 'test-agent.md'), 'utf-8');
      const claudeGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'agents', 'test-agent.md'), 'utf-8');
      expect(claudePushed).toBe(claudeGolden);

      // OpenCode: test-agent.md
      const opencodePushed = readFileSync(join(TARGET_PATHS.opencode, 'test-agent.md'), 'utf-8');
      const opencodeGolden = readFileSync(join(FIXTURE_ROOT, 'opencode', 'agents', 'test-agent.md'), 'utf-8');
      expect(opencodePushed).toBe(opencodeGolden);

      // Gemini: test-agent.md
      const geminiPushed = readFileSync(join(TARGET_PATHS.gemini, 'test-agent.md'), 'utf-8');
      const geminiGolden = readFileSync(join(FIXTURE_ROOT, 'gemini', 'agents', 'test-agent.md'), 'utf-8');
      expect(geminiPushed).toBe(geminiGolden);

      // Codex: agent-test-agent.md (codex prefixes agents with agent-)
      const codexPushed = readFileSync(join(TARGET_PATHS.codex, 'agent-test-agent.md'), 'utf-8');
      const codexGolden = readFileSync(join(FIXTURE_ROOT, 'codex', 'agents', 'agent-test-agent.md'), 'utf-8');
      expect(codexPushed).toBe(codexGolden);

      // Also verify simple-agent
      const claudeSimple = readFileSync(join(TARGET_PATHS.claude, 'simple-agent.md'), 'utf-8');
      const claudeSimpleGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'agents', 'simple-agent.md'), 'utf-8');
      expect(claudeSimple).toBe(claudeSimpleGolden);
    });
  }, E2E_TIMEOUT);

  test('second push is idempotent (no drift)', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();
      await runPush({ projectDir, force: true, types: ['agent'] });

      const result2 = await runPush({ projectDir, force: true, types: ['agent'] });
      expect(result2.hasDrift).toBe(false);
      expect(result2.written).toBe(0);
    });
  }, E2E_TIMEOUT);

  test('stale agent files are removed with deleteStale', async () => {
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();
      await runPush({ projectDir, force: true, types: ['agent'] });

      // Plant a stale agent in Claude agents dir
      const stalePath = join(TARGET_PATHS.claude, 'stale-test-agent.md');
      writeFileSync(stalePath, '---\nname: stale-test-agent\n---\n\nStale agent.\n');
      expect(existsSync(stalePath)).toBe(true);

      await runPush({ projectDir, force: true, deleteStale: true, types: ['agent'] });

      expect(existsSync(stalePath)).toBe(false);
      expect(existsSync(join(TARGET_PATHS.claude, 'test-agent.md'))).toBe(true);
    });
  }, E2E_TIMEOUT);
});
