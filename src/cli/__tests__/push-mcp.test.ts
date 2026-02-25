import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import os from 'node:os';
import { withTargetBackup } from '../../../test/helpers/backup';
import { runPush } from '../push';
import { createAdapter } from '../canonical';
import type { TargetName } from '../../types';

const FIXTURE_ROOT = join(import.meta.dir, '../../../test/fixtures');
const SEEDS_ROOT = join(FIXTURE_ROOT, 'seeds');
const CANONICAL_ROOT = join(FIXTURE_ROOT, 'canonical');

/** Build a temp project dir pointing at canonical fixtures */
function setupProjectDir(): string {
  const dir = join(os.tmpdir(), `push-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  cpSync(CANONICAL_ROOT, join(dir, 'configs'), { recursive: true });
  return dir;
}

/** Seed real target MCP files with pre-existing content from seeds/ */
function seedMCPTargets(): void {
  const targets: Array<{ target: TargetName; seedFile: string }> = [
    { target: 'claude-code', seedFile: join(SEEDS_ROOT, 'claude/mcp.json') },
    { target: 'opencode', seedFile: join(SEEDS_ROOT, 'opencode/mcp.jsonc') },
    { target: 'gemini', seedFile: join(SEEDS_ROOT, 'gemini/mcp.json') },
    { target: 'codex', seedFile: join(SEEDS_ROOT, 'codex/mcp.toml') },
  ];

  for (const { target, seedFile } of targets) {
    const adapter = createAdapter(target);
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
    await withTargetBackup(async () => {
      const projectDir = setupProjectDir();
      seedMCPTargets();

      // --- Push MCP ---
      const result = await runPush({ projectDir, force: true, types: ['mcp'] });
      expect(result.failed).toBe(0);
      expect(result.rolledBack).toBe(false);
      expect(result.written).toBeGreaterThan(0);

      // --- Golden comparison for all 4 targets ---
      for (const target of ALL_TARGETS) {
        const adapter = createAdapter(target);
        const mcpPath = adapter.getPaths().getMCPConfigPath();
        const actual = readFileSync(mcpPath, 'utf-8');
        const golden = readFileSync(GOLDEN_PATHS[target], 'utf-8');
        expect(actual).toBe(golden);
      }

      // --- Codex: HTTP-only (no tavily stdio) ---
      const codexAdapter = createAdapter('codex');
      const codexContent = readFileSync(codexAdapter.getPaths().getMCPConfigPath(), 'utf-8');
      expect(codexContent).toContain('context7');
      expect(codexContent).not.toContain('tavily');

      // --- Non-canonical "existing-server" removed by push ---
      for (const target of ['claude-code', 'opencode', 'gemini'] as TargetName[]) {
        const adapter = createAdapter(target);
        const content = readFileSync(adapter.getPaths().getMCPConfigPath(), 'utf-8');
        expect(content).not.toContain('existing-server');
      }

      // --- Idempotency: second push reports no drift ---
      const result2 = await runPush({ projectDir, force: true, types: ['mcp'] });
      expect(result2.hasDrift).toBe(false);
      expect(result2.written).toBe(0);
    });
  });
});
