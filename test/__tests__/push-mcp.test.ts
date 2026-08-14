import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { createAdapter } from '../../src/cli/canonical';
import type { TargetName } from '../../src/types';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');
const SEEDS_ROOT = join(FIXTURE_ROOT, 'seeds');
const E2E_TIMEOUT = 60_000;

/** Seed MCP files into fakeHome from seeds/ */
function seedMCPTargets(fakeHome: string): void {
  const targets: Array<{ target: TargetName; seedFile: string }> = [
    { target: 'claude-code', seedFile: join(SEEDS_ROOT, 'claude/mcp.json') },
    { target: 'opencode', seedFile: join(SEEDS_ROOT, 'opencode/mcp.jsonc') },
    { target: 'antigravity', seedFile: join(SEEDS_ROOT, 'antigravity/mcp.json') },
    { target: 'codex', seedFile: join(SEEDS_ROOT, 'codex/mcp.toml') },
  ];

  for (const { target, seedFile } of targets) {
    const adapter = createAdapter(target, fakeHome);
    const mcpPath = adapter.getPaths().getMCPConfigPath();
    mkdirSync(dirname(mcpPath), { recursive: true });
    cpSync(seedFile, mcpPath);
  }
}

/** Golden fixture paths per target */
const GOLDEN_PATHS: Record<TargetName, string> = {
  'claude-code': join(FIXTURE_ROOT, 'claude/mcp/settings.json'),
  opencode: join(FIXTURE_ROOT, 'opencode/mcp/opencode.jsonc'),
  antigravity: join(FIXTURE_ROOT, 'antigravity/mcp/settings.json'),
  codex: join(FIXTURE_ROOT, 'codex/mcp/mcp_servers.toml'),
};

const ALL_TARGETS: TargetName[] = ['claude-code', 'opencode', 'antigravity', 'codex'];

describe('push MCP E2E', () => {
  test('pushes MCP to all 4 targets, matches goldens, codex includes stdio+HTTP, idempotent, stale removal', async () => {
    const fakeHome = createTestHome('push-mcp');
    const projectDir = createTestProject('push-mcp', FIXTURE_ROOT);
    seedMCPTargets(fakeHome);

    // --- Push MCP ---
    const result = await runPush({ projectDir, force: true, types: ['mcp'], homeDir: fakeHome });
    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);
    expect(result.written).toBeGreaterThan(0);

    // --- Golden comparison for all 4 targets ---
    for (const target of ALL_TARGETS) {
      const adapter = createAdapter(target, fakeHome);
      const mcpPath = adapter.getPaths().getMCPConfigPath();
      const actual = readFileSync(mcpPath, 'utf-8');
      const golden = readFileSync(GOLDEN_PATHS[target], 'utf-8');
      expect(actual.trimEnd()).toBe(golden.trimEnd());
      expect(actual).not.toContain('sequential-thinking');
      expect(actual).not.toContain('@modelcontextprotocol/server-sequential-thinking');
    }

    // --- Codex: stdio + HTTP ---
    const codexAdapter = createAdapter('codex', fakeHome);
    const codexContent = readFileSync(codexAdapter.getPaths().getMCPConfigPath(), 'utf-8');
    expect(codexContent).toContain('context7');
    expect(codexContent).toContain('tavily');

    // --- Non-canonical "existing-server" removed by push ---
    for (const target of ['claude-code', 'opencode', 'antigravity'] as TargetName[]) {
      const adapter = createAdapter(target, fakeHome);
      const content = readFileSync(adapter.getPaths().getMCPConfigPath(), 'utf-8');
      expect(content).not.toContain('existing-server');
    }

    // --- Idempotency: second push reports no drift ---
    const result2 = await runPush({ projectDir, force: true, types: ['mcp'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  });

  test('pushes native OpenCode V2 GitHub codemode configuration and is idempotent', async () => {
    const fakeHome = createTestHome('push-mcp-opencode2');
    const projectDir = createTestProject('push-mcp-opencode2', FIXTURE_ROOT);
    const adapter = createAdapter('opencode2', fakeHome);
    const mcpPath = adapter.getPaths().getMCPConfigPath();
    mkdirSync(dirname(mcpPath), { recursive: true });
    writeFileSync(mcpPath, JSON.stringify({
      mcp: {
        servers: {
          'existing-server': { type: 'remote', url: 'https://example.com/mcp' },
          'sequential-thinking': {
            type: 'local',
            command: ['npx', '-y', '@modelcontextprotocol/server-sequential-thinking'],
          },
        },
      },
    }));

    const result = await runPush({
      projectDir,
      targets: ['opencode2'],
      force: true,
      types: ['mcp'],
      homeDir: fakeHome,
    });
    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);

    const rendered = JSON.parse(readFileSync(mcpPath, 'utf-8')) as {
      mcp: { servers: Record<string, Record<string, unknown>> };
    };
    expect(rendered.mcp.servers['existing-server']).toBeUndefined();
    expect(rendered.mcp.servers['sequential-thinking']).toBeUndefined();
    expect(rendered.mcp.servers.github).toEqual({
      type: 'remote',
      url: 'https://api.githubcopilot.com/mcp/',
      headers: { Authorization: 'Bearer {env:GITHUB_PERSONAL_ACCESS_TOKEN}' },
      oauth: false,
      codemode: true,
      disabled: false,
    });

    const second = await runPush({
      projectDir,
      targets: ['opencode2'],
      force: true,
      types: ['mcp'],
      homeDir: fakeHome,
    });
    expect(second.hasDrift).toBe(false);
    expect(second.written).toBe(0);
  }, E2E_TIMEOUT);
});
