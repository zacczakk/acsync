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
  const tmp = mkdtempSync(join(tmpdir(), 'pull-agent-test-'));
  mkdirSync(join(tmp, 'configs', 'agents'), { recursive: true });
  return tmp;
}

/** Target paths where agents live for each target */
const TARGET_AGENT_PATHS = {
  claude: join(homedir(), '.claude', 'agents'),
  opencode: join(homedir(), '.config', 'opencode', 'agents'),
  gemini: join(homedir(), '.gemini', 'agents'),
  codex: join(homedir(), '.codex', 'prompts'),
};

/** Plant target-format agent fixtures into real target directories */
function plantTargetAgents(): void {
  for (const [target, dir] of Object.entries(TARGET_AGENT_PATHS)) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    cpSync(join(FIXTURE_ROOT, target, 'agents'), dir, { recursive: true });
  }
}

describe('pull-agents E2E', () => {
  test('pulls agents from all 4 targets matching canonical fixtures', async () => {
    await withTargetBackup(async () => {
      plantTargetAgents();

      const canonicalTestAgent = readFileSync(join(FIXTURE_ROOT, 'canonical', 'agents', 'test-agent.md'), 'utf-8');
      const canonicalSimple = readFileSync(join(FIXTURE_ROOT, 'canonical', 'agents', 'simple-agent.md'), 'utf-8');

      // Pull from Claude (identity passthrough) — exact canonical match
      const claudeDir = setupProjectDir();
      await runPull({ source: 'claude-code', force: true, projectDir: claudeDir });

      const claudeTestAgent = readFileSync(join(claudeDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
      expect(claudeTestAgent).toBe(canonicalTestAgent);
      const claudeSimple = readFileSync(join(claudeDir, 'configs', 'agents', 'simple-agent.md'), 'utf-8');
      expect(claudeSimple).toBe(canonicalSimple);

      // Extract canonical body for structural comparisons
      const canonicalBody = canonicalTestAgent.split('---').slice(2).join('---').trim();

      // Pull from OpenCode — strips name/allowed-tools, adds mode: subagent
      const opencodeDir = setupProjectDir();
      await runPull({ source: 'opencode', force: true, projectDir: opencodeDir });
      const ocTestAgent = readFileSync(join(opencodeDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
      expect(ocTestAgent).toContain('description:');
      const ocBody = ocTestAgent.split('---').slice(2).join('---').trim();
      expect(ocBody).toBe(canonicalBody);

      // Pull from Gemini — agents use frontmatter md (strips name, adds kind: local)
      const geminiDir = setupProjectDir();
      await runPull({ source: 'gemini', force: true, projectDir: geminiDir });
      const gemTestAgent = readFileSync(join(geminiDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
      expect(gemTestAgent).toContain('description:');
      expect(gemTestAgent).toContain('allowed-tools:');
      const gemBody = gemTestAgent.split('---').slice(2).join('---').trim();
      expect(gemBody).toBe(canonicalBody);

      // Pull from Codex — reverse-parses flat markdown back to frontmatter
      const codexDir = setupProjectDir();
      await runPull({ source: 'codex', force: true, projectDir: codexDir });

      const cdxTestAgent = readFileSync(join(codexDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
      // Codex parseAgent reconstructs: name stripped from heading, description from **Role**,
      // allowed-tools from **Allowed Tools**, body is the rest
      expect(cdxTestAgent).toContain('description:');
      expect(cdxTestAgent).toContain('allowed-tools:');
      // Body content should match canonical body
      const cdxBody = cdxTestAgent.split('---').slice(2).join('---').trim();
      expect(cdxBody).toBe(canonicalBody);
    });
  }, E2E_TIMEOUT);

  test('force pull overwrites existing canonical agents', async () => {
    await withTargetBackup(async () => {
      plantTargetAgents();

      const projectDir = setupProjectDir();
      writeFileSync(join(projectDir, 'configs', 'agents', 'test-agent.md'), 'existing sentinel');

      await runPull({ source: 'claude-code', force: true, projectDir });

      const content = readFileSync(join(projectDir, 'configs', 'agents', 'test-agent.md'), 'utf-8');
      const canonical = readFileSync(join(FIXTURE_ROOT, 'canonical', 'agents', 'test-agent.md'), 'utf-8');
      expect(content).toBe(canonical);
    });
  }, E2E_TIMEOUT);
});
