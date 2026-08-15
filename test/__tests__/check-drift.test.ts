import { describe, expect, test } from 'bun:test';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { createAdapter } from '../../src/cli/canonical';
import { runCheck } from '../../src/cli/check';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

function seedCodex(homeDir: string, fixtureName: 'config.toml' | 'mcp.toml'): string {
  const adapter = createAdapter('codex', homeDir);
  const path = adapter.getPaths().getSettingsPath();
  mkdirSync(dirname(path), { recursive: true });
  cpSync(join(FIXTURE_ROOT, 'seeds', 'codex', fixtureName), path);
  return path;
}

function seedCodexMcpGolden(homeDir: string): string {
  const adapter = createAdapter('codex', homeDir);
  const path = adapter.getPaths().getSettingsPath();
  mkdirSync(dirname(path), { recursive: true });
  cpSync(join(FIXTURE_ROOT, 'codex', 'mcp', 'mcp_servers.toml'), path);
  return path;
}

describe('semantic drift checks', () => {
  test('ignores Codex TOML formatting and unrelated settings', async () => {
    const homeDir = createTestHome('check-settings-semantic');
    const projectDir = createTestProject('check-settings-semantic', FIXTURE_ROOT);
    const path = seedCodex(homeDir, 'config.toml');
    writeFileSync(path, [
      "model = 'gpt-5.6-luna'",
      "model_provider = 'tux'",
      "model_reasoning_effort = 'xhigh'",
      'approval_policy = "never"',
      'sandbox_mode = "workspace-write"',
      'personality = "pragmatic"',
      '',
      '[features]',
      'multi_agent = true',
      'hooks = true',
      '',
    ].join('\n'));

    const result = await runCheck({
      projectDir,
      homeDir,
      targets: ['codex'],
      types: ['settings'],
    });

    expect(result.hasDrift).toBe(false);
    expect(result.diffs[0]?.summary.update).toBe(0);
  });

  test('reports only the MCP server whose parsed value changed', async () => {
    const homeDir = createTestHome('check-mcp-per-server');
    const projectDir = createTestProject('check-mcp-per-server', FIXTURE_ROOT);
    const path = seedCodexMcpGolden(homeDir);
    const content = readFileSync(path, 'utf-8').replace(
      'url = "https://mcp.context7.com/mcp"',
      'url = "https://mcp.context7.com/changed"',
    );
    writeFileSync(path, `model = "gpt-5.6-luna"\n\n${content}`);

    const result = await runCheck({
      projectDir,
      homeDir,
      targets: ['codex'],
      types: ['mcp'],
    });
    const updates = result.diffs[0]?.operations.filter((operation) => operation.type === 'update') ?? [];

    expect(updates.map((operation) => operation.name)).toEqual(['context7']);
  });
});
