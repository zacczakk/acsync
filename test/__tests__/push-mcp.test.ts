import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { createAdapter } from '../../src/cli/canonical';
import type { TargetName } from '../../src/types';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');
const SEEDS_ROOT = join(FIXTURE_ROOT, 'seeds');

/** Seed MCP files into fakeHome from seeds/ */
function seedMCPTargets(fakeHome: string): void {
  const targets: Array<{ target: TargetName; seedFile: string }> = [
    { target: 'claude-code', seedFile: join(SEEDS_ROOT, 'claude/mcp.json') },
    { target: 'opencode', seedFile: join(SEEDS_ROOT, 'opencode/mcp.jsonc') },
    { target: 'gemini', seedFile: join(SEEDS_ROOT, 'gemini/mcp.json') },
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
  gemini: join(FIXTURE_ROOT, 'gemini/mcp/settings.json'),
  codex: join(FIXTURE_ROOT, 'codex/mcp/mcp_servers.toml'),
};

const ALL_TARGETS: TargetName[] = ['claude-code', 'opencode', 'gemini', 'codex'];

describe('push MCP E2E', () => {
  test('pushes MCP to all 4 targets, matches goldens, codex HTTP-only, idempotent, stale removal', async () => {
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
      expect(actual).toBe(golden);
    }

    // --- Codex: HTTP-only (no tavily stdio) ---
    const codexAdapter = createAdapter('codex', fakeHome);
    const codexContent = readFileSync(codexAdapter.getPaths().getMCPConfigPath(), 'utf-8');
    expect(codexContent).toContain('context7');
    expect(codexContent).not.toContain('tavily');

    // --- Non-canonical "existing-server" removed by push ---
    for (const target of ['claude-code', 'opencode', 'gemini'] as TargetName[]) {
      const adapter = createAdapter(target, fakeHome);
      const content = readFileSync(adapter.getPaths().getMCPConfigPath(), 'utf-8');
      expect(content).not.toContain('existing-server');
    }

    // --- Idempotency: second push reports no drift ---
    const result2 = await runPush({ projectDir, force: true, types: ['mcp'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  });
});
