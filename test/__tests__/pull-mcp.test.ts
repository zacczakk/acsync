import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { withTargetBackup } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { runPull } from '../../src/cli/pull';
import { createAdapter } from '../../src/cli/canonical';
import type { TargetName } from '../../src/types';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');
const SEEDS_ROOT = join(FIXTURE_ROOT, 'seeds');
const CANONICAL_ROOT = join(FIXTURE_ROOT, 'canonical');
const E2E_TIMEOUT = 60_000;

const ALL_TARGETS: TargetName[] = ['claude-code', 'opencode', 'gemini', 'codex'];

/** Build a temp project dir pointing at canonical fixtures */
function setupProjectDir(suffix: string): string {
  const dir = join(os.tmpdir(), `pull-mcp-test-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  cpSync(CANONICAL_ROOT, join(dir, 'configs'), { recursive: true });
  return dir;
}

/** Build an empty temp project dir (no configs/) */
function emptyProjectDir(suffix: string): string {
  const dir = join(os.tmpdir(), `pull-mcp-empty-${suffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Seed MCP targets with pre-existing content from seeds/ */
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
    mkdirSync(join(mcpPath, '..'), { recursive: true });
    cpSync(seedFile, mcpPath);
  }
}

describe('pull MCP E2E', () => {
  test('round-trip: push then pull MCP matches canonical', async () => {
    await withTargetBackup(async () => {
      // Push canonical MCP to all targets
      const pushDir = setupProjectDir('push');
      seedMCPTargets();
      const pushResult = await runPush({ projectDir: pushDir, force: true, types: ['mcp'] });
      expect(pushResult.failed).toBe(0);

      // Pull from each target into fresh projectDir, verify canonical match
      for (const target of ALL_TARGETS) {
        const pullDir = emptyProjectDir(`pull-${target}`);
        const pullResult = await runPull({ source: target, force: true, projectDir: pullDir });
        expect(pullResult.rolledBack).toBe(false);

        // Codex only supports HTTP — only context7 should be pulled (tavily is stdio)
        if (target === 'codex') {
          const context7Path = join(pullDir, 'configs/mcp/context7.json');
          expect(existsSync(context7Path)).toBe(true);
          const pulled = JSON.parse(readFileSync(context7Path, 'utf-8'));
          const canonical = JSON.parse(readFileSync(join(CANONICAL_ROOT, 'mcp/context7.json'), 'utf-8'));
          // Pulled should have transport + url
          expect(pulled.transport).toBe(canonical.transport);
          expect(pulled.url).toBe(canonical.url);
          // tavily (stdio) must NOT be pulled from codex
          expect(existsSync(join(pullDir, 'configs/mcp/tavily.json'))).toBe(false);
          continue;
        }

        // Non-codex targets: both tavily and context7 should be pulled
        const tavilyPath = join(pullDir, 'configs/mcp/tavily.json');
        const context7Path = join(pullDir, 'configs/mcp/context7.json');
        expect(existsSync(tavilyPath)).toBe(true);
        expect(existsSync(context7Path)).toBe(true);

        const pulledTavily = JSON.parse(readFileSync(tavilyPath, 'utf-8'));
        const canonicalTavily = JSON.parse(readFileSync(join(CANONICAL_ROOT, 'mcp/tavily.json'), 'utf-8'));
        expect(pulledTavily.transport).toBe(canonicalTavily.transport);
        expect(pulledTavily.command).toBe(canonicalTavily.command);
        expect(pulledTavily.args).toEqual(canonicalTavily.args);

        const pulledContext7 = JSON.parse(readFileSync(context7Path, 'utf-8'));
        const canonicalContext7 = JSON.parse(readFileSync(join(CANONICAL_ROOT, 'mcp/context7.json'), 'utf-8'));
        expect(pulledContext7.transport).toBe(canonicalContext7.transport);
        expect(pulledContext7.url).toBe(canonicalContext7.url);
      }
    });
  }, E2E_TIMEOUT);

  test('non-force pull skips existing MCP files', async () => {
    await withTargetBackup(async () => {
      // Push MCP to claude target
      const pushDir = setupProjectDir('push-skip');
      seedMCPTargets();
      await runPush({ projectDir: pushDir, force: true, types: ['mcp'] });

      // Pre-populate pullDir with sentinel tavily.json
      const pullDir = emptyProjectDir('pull-skip');
      mkdirSync(join(pullDir, 'configs/mcp'), { recursive: true });
      writeFileSync(join(pullDir, 'configs/mcp/tavily.json'), '{"sentinel": true}\n');

      // Pull without force — existing file should be skipped
      const pullResult = await runPull({ source: 'claude-code', projectDir: pullDir });
      const tavilyContent = readFileSync(join(pullDir, 'configs/mcp/tavily.json'), 'utf-8');
      expect(tavilyContent).toContain('sentinel');

      // context7 should still be pulled (didn't exist)
      const context7Path = join(pullDir, 'configs/mcp/context7.json');
      expect(existsSync(context7Path)).toBe(true);
      const context7Content = JSON.parse(readFileSync(context7Path, 'utf-8'));
      expect(context7Content.transport).toBe('http');
    });
  }, E2E_TIMEOUT);

  test('force pull overwrites existing MCP files', async () => {
    await withTargetBackup(async () => {
      // Push MCP to claude target
      const pushDir = setupProjectDir('push-force');
      seedMCPTargets();
      await runPush({ projectDir: pushDir, force: true, types: ['mcp'] });

      // Pre-populate pullDir with sentinel tavily.json
      const pullDir = emptyProjectDir('pull-force');
      mkdirSync(join(pullDir, 'configs/mcp'), { recursive: true });
      writeFileSync(join(pullDir, 'configs/mcp/tavily.json'), '{"sentinel": true}\n');

      // Pull with force — sentinel should be overwritten
      await runPull({ source: 'claude-code', force: true, projectDir: pullDir });
      const tavilyContent = readFileSync(join(pullDir, 'configs/mcp/tavily.json'), 'utf-8');
      expect(tavilyContent).not.toContain('sentinel');
      expect(JSON.parse(tavilyContent).transport).toBe('stdio');
    });
  }, E2E_TIMEOUT);
});
