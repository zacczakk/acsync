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
  const tmp = mkdtempSync(join(tmpdir(), 'pull-agent-test-'));
  mkdirSync(join(tmp, 'configs', 'agents'), { recursive: true });
  return tmp;
}

/** Seed all 4 targets' agent fixtures into fakeHome */
function plantTargetAgents(fakeHome: string): void {
  for (const target of ['claude', 'opencode', 'gemini', 'codex']) {
    seedTargetFixtures(fakeHome, FIXTURE_ROOT, target, 'agents');
  }
}

describe('pull-agents E2E', () => {
  test('pulls agents from all 4 targets matching canonical fixtures', async () => {
    const fakeHome = createTestHome('pull-agent-all');
    plantTargetAgents(fakeHome);

    const canonicalTestAgent = readFileSync(join(FIXTURE_ROOT, 'canonical', 'agents', 'test-agent.md'), 'utf-8');
    const canonicalSimple = readFileSync(join(FIXTURE_ROOT, 'canonical', 'agents', 'simple-agent.md'), 'utf-8');

    // Pull from Claude (identity passthrough) — exact canonical match
    const claudeDir = setupProjectDir();
    await runPull({ source: 'claude-code', force: true, projectDir: claudeDir, homeDir: fakeHome });

    const claudeTestAgent = readFileSync(join(claudeDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
    expect(claudeTestAgent).toBe(canonicalTestAgent);
    const claudeSimple = readFileSync(join(claudeDir, 'configs', 'agents', 'simple-agent.md'), 'utf-8');
    expect(claudeSimple).toBe(canonicalSimple);

    // Extract canonical body for structural comparisons
    const canonicalBody = canonicalTestAgent.split('---').slice(2).join('---').trim();

    // Pull from OpenCode — strips name/allowed-tools, adds mode: subagent
    const opencodeDir = setupProjectDir();
    await runPull({ source: 'opencode', force: true, projectDir: opencodeDir, homeDir: fakeHome });
    const ocTestAgent = readFileSync(join(opencodeDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
    expect(ocTestAgent).toContain('description:');
    const ocBody = ocTestAgent.split('---').slice(2).join('---').trim();
    expect(ocBody).toBe(canonicalBody);

    // Pull from Gemini — agents use frontmatter md (strips name, adds kind: local)
    const geminiDir = setupProjectDir();
    await runPull({ source: 'gemini', force: true, projectDir: geminiDir, homeDir: fakeHome });
    const gemTestAgent = readFileSync(join(geminiDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
    expect(gemTestAgent).toContain('description:');
    expect(gemTestAgent).toContain('allowed-tools:');
    const gemBody = gemTestAgent.split('---').slice(2).join('---').trim();
    expect(gemBody).toBe(canonicalBody);

    // Pull from Codex — reverse-parses flat markdown back to frontmatter
    const codexDir = setupProjectDir();
    await runPull({ source: 'codex', force: true, projectDir: codexDir, homeDir: fakeHome });

    const cdxTestAgent = readFileSync(join(codexDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
    expect(cdxTestAgent).toContain('description:');
    expect(cdxTestAgent).toContain('allowed-tools:');
    // Body content should match canonical body
    const cdxBody = cdxTestAgent.split('---').slice(2).join('---').trim();
    expect(cdxBody).toBe(canonicalBody);
  }, E2E_TIMEOUT);

  test('force pull overwrites existing canonical agents', async () => {
    const fakeHome = createTestHome('pull-agent-force');
    plantTargetAgents(fakeHome);

    const projectDir = setupProjectDir();
    writeFileSync(join(projectDir, 'configs', 'agents', 'test-agent.md'), 'existing sentinel');

    await runPull({ source: 'claude-code', force: true, projectDir, homeDir: fakeHome });

    const content = readFileSync(join(projectDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
    const canonical = readFileSync(join(FIXTURE_ROOT, 'canonical', 'agents', 'test-agent.md'), 'utf-8');
    expect(content).toBe(canonical);
  }, E2E_TIMEOUT);
});
