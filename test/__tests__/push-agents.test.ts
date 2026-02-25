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
    claude: join(fakeHome, '.claude', 'agents'),
    opencode: join(fakeHome, '.config', 'opencode', 'agents'),
    gemini: join(fakeHome, '.gemini', 'agents'),
    codex: join(fakeHome, '.codex', 'prompts'),
  };
}

describe('push-agents E2E', () => {
  test('pushes agents to all 4 targets matching golden fixtures', async () => {
    const fakeHome = createTestHome('push-agent');
    const projectDir = createTestProject('push-agent', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);

    const result = await runPush({ projectDir, force: true, types: ['agent'], homeDir: fakeHome });

    expect(result.written).toBeGreaterThan(0);
    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);

    // Claude: test-agent.md
    const claudePushed = readFileSync(join(paths.claude, 'test-agent.md'), 'utf-8');
    const claudeGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'agents', 'test-agent.md'), 'utf-8');
    expect(claudePushed).toBe(claudeGolden);

    // OpenCode: test-agent.md
    const opencodePushed = readFileSync(join(paths.opencode, 'test-agent.md'), 'utf-8');
    const opencodeGolden = readFileSync(join(FIXTURE_ROOT, 'opencode', 'agents', 'test-agent.md'), 'utf-8');
    expect(opencodePushed).toBe(opencodeGolden);

    // Gemini: test-agent.md
    const geminiPushed = readFileSync(join(paths.gemini, 'test-agent.md'), 'utf-8');
    const geminiGolden = readFileSync(join(FIXTURE_ROOT, 'gemini', 'agents', 'test-agent.md'), 'utf-8');
    expect(geminiPushed).toBe(geminiGolden);

    // Codex: agent-test-agent.md (codex prefixes agents with agent-)
    const codexPushed = readFileSync(join(paths.codex, 'agent-test-agent.md'), 'utf-8');
    const codexGolden = readFileSync(join(FIXTURE_ROOT, 'codex', 'agents', 'agent-test-agent.md'), 'utf-8');
    expect(codexPushed).toBe(codexGolden);

    // Also verify simple-agent
    const claudeSimple = readFileSync(join(paths.claude, 'simple-agent.md'), 'utf-8');
    const claudeSimpleGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'agents', 'simple-agent.md'), 'utf-8');
    expect(claudeSimple).toBe(claudeSimpleGolden);
  }, E2E_TIMEOUT);

  test('second push is idempotent (no drift)', async () => {
    const fakeHome = createTestHome('push-agent-idem');
    const projectDir = createTestProject('push-agent-idem', FIXTURE_ROOT);

    await runPush({ projectDir, force: true, types: ['agent'], homeDir: fakeHome });

    const result2 = await runPush({ projectDir, force: true, types: ['agent'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  }, E2E_TIMEOUT);

  test('stale agent files are removed with deleteStale', async () => {
    const fakeHome = createTestHome('push-agent-stale');
    const projectDir = createTestProject('push-agent-stale', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);

    await runPush({ projectDir, force: true, types: ['agent'], homeDir: fakeHome });

    // Plant a stale agent in Claude agents dir
    const stalePath = join(paths.claude, 'stale-test-agent.md');
    writeFileSync(stalePath, '---\nname: stale-test-agent\n---\n\nStale agent.\n');
    expect(existsSync(stalePath)).toBe(true);

    await runPush({ projectDir, force: true, deleteStale: true, types: ['agent'], homeDir: fakeHome });

    expect(existsSync(stalePath)).toBe(false);
    expect(existsSync(join(paths.claude, 'test-agent.md'))).toBe(true);
  }, E2E_TIMEOUT);
});
