import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  discoverVariants,
  discoverAccountAndOrg,
  composeInstructions,
  syncInstructions,
  syncSkills,
  syncClaudeDesktop,
  type Variant,
} from '../claude-desktop-sync';

let homeDir: string;

const ACCOUNT = 'f2345c46-7345-402b-bf22-3bfd122ed95a';
const ORG = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), 'metronome-cd-test-'));
});

afterEach(() => {
  rmSync(homeDir, { recursive: true, force: true });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function variantBase(variant: Variant): string {
  return join(homeDir, 'Library/Application Support', variant === 'claude-3p' ? 'Claude-3p' : 'Claude');
}

function seedVariant(variant: Variant, opts: { withAccount?: boolean; withAnthropicSkills?: boolean } = {}): string {
  const base = variantBase(variant);
  mkdirSync(base, { recursive: true });
  if (opts.withAccount) {
    const acctDir = join(base, 'local-agent-mode-sessions', ACCOUNT, ORG);
    mkdirSync(acctDir, { recursive: true });
    writeFileSync(join(acctDir, 'cowork_account_settings.json'), '{}');
  }
  if (opts.withAnthropicSkills) {
    const skillsPluginDir = join(base, 'local-agent-mode-sessions', 'skills-plugin', ORG, ACCOUNT);
    mkdirSync(join(skillsPluginDir, '.claude-plugin'), { recursive: true });
    mkdirSync(join(skillsPluginDir, 'skills', 'schedule'), { recursive: true });
    writeFileSync(
      join(skillsPluginDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'anthropic-skills', version: '1.0.0', description: 'Anthropic-managed skills for Claude Desktop' }, null, 2),
    );
    writeFileSync(
      join(skillsPluginDir, 'manifest.json'),
      JSON.stringify(
        {
          lastUpdated: 1000000000000,
          skills: [
            {
              skillId: 'schedule',
              name: 'schedule',
              description: 'Anthropic schedule skill.',
              creatorType: 'anthropic',
              updatedAt: null,
              enabled: true,
            },
          ],
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(skillsPluginDir, 'skills', 'schedule', 'SKILL.md'),
      '---\nname: schedule\ndescription: Anthropic schedule skill.\n---\n\nbody\n',
    );
  }
  return base;
}

function seedSourceConfigs(): { configsDir: string; memoryVaultDir: string } {
  const configsDir = join(homeDir, 'configs');
  const memoryVaultDir = join(homeDir, 'Memory');
  mkdirSync(join(configsDir, 'instructions'), { recursive: true });
  mkdirSync(join(configsDir, 'skills', 'release'), { recursive: true });
  mkdirSync(join(configsDir, 'skills', 'brainstorming', 'subdir'), { recursive: true });
  mkdirSync(join(configsDir, 'mcp'), { recursive: true });
  mkdirSync(memoryVaultDir, { recursive: true });

  writeFileSync(join(configsDir, 'instructions', 'AGENTS.md'), '# AGENTS\n\nagents body\n');
  writeFileSync(join(memoryVaultDir, 'IDENTITY.md'), '# IDENTITY\n\nid body\n');
  writeFileSync(join(memoryVaultDir, 'SOUL.md'), '# SOUL\n\nsoul body\n');
  writeFileSync(join(memoryVaultDir, 'USER.md'), '# USER\n\nuser body\n');

  writeFileSync(
    join(configsDir, 'skills', 'release', 'SKILL.md'),
    '---\nname: release\ndescription: Release skill description.\n---\n\nrelease body\n',
  );
  writeFileSync(join(configsDir, 'skills', 'release', 'helper.md'), 'helper content\n');
  writeFileSync(
    join(configsDir, 'skills', 'brainstorming', 'SKILL.md'),
    '---\nname: brainstorming\ndescription: Brainstorming skill.\n---\n\nbs body\n',
  );
  writeFileSync(join(configsDir, 'skills', 'brainstorming', 'subdir', 'nested.md'), 'nested\n');

  writeFileSync(
    join(configsDir, 'mcp', 'tavily.json'),
    JSON.stringify({ command: 'npx', args: ['-y', 'tavily-mcp'], env: { TAVILY_API_KEY: '${TAVILY_API_KEY}' } }, null, 2),
  );
  writeFileSync(
    join(configsDir, 'mcp', 'context7.json'),
    JSON.stringify({ command: 'npx', args: ['-y', '@upstash/context7-mcp'] }, null, 2),
  );
  return { configsDir, memoryVaultDir };
}

// ── discoverVariants ────────────────────────────────────────────────────────

describe('discoverVariants', () => {
  test('returns empty when neither variant present', async () => {
    expect(await discoverVariants(homeDir)).toEqual([]);
  });

  test('returns claude-3p when only it exists', async () => {
    seedVariant('claude-3p');
    expect(await discoverVariants(homeDir)).toEqual(['claude-3p']);
  });

  test('returns claude when only it exists', async () => {
    seedVariant('claude');
    expect(await discoverVariants(homeDir)).toEqual(['claude']);
  });

  test('returns both when both present (3p first — primary target)', async () => {
    seedVariant('claude');
    seedVariant('claude-3p');
    expect(await discoverVariants(homeDir)).toEqual(['claude-3p', 'claude']);
  });
});

// ── discoverAccountAndOrg ───────────────────────────────────────────────────

describe('discoverAccountAndOrg', () => {
  test('returns null when local-agent-mode-sessions missing', async () => {
    const base = variantBase('claude-3p');
    mkdirSync(base, { recursive: true });
    expect(await discoverAccountAndOrg(base)).toBeNull();
  });

  test('discovers UUID pair, ignoring skills-plugin subtree', async () => {
    const base = seedVariant('claude-3p', { withAccount: true, withAnthropicSkills: true });
    const result = await discoverAccountAndOrg(base);
    expect(result).toEqual({ account: ACCOUNT, org: ORG });
  });

  test('returns null when only skills-plugin present (no real account)', async () => {
    const base = seedVariant('claude-3p', { withAnthropicSkills: true });
    expect(await discoverAccountAndOrg(base)).toBeNull();
  });
});

// ── composeInstructions ─────────────────────────────────────────────────────

describe('composeInstructions', () => {
  test('concatenates AGENTS + IDENTITY + SOUL + USER in order', async () => {
    const { configsDir, memoryVaultDir } = seedSourceConfigs();
    const out = await composeInstructions(configsDir, memoryVaultDir);
    const idxAgents = out.indexOf('agents body');
    const idxIdentity = out.indexOf('id body');
    const idxSoul = out.indexOf('soul body');
    const idxUser = out.indexOf('user body');
    expect(idxAgents).toBeGreaterThan(-1);
    expect(idxIdentity).toBeGreaterThan(idxAgents);
    expect(idxSoul).toBeGreaterThan(idxIdentity);
    expect(idxUser).toBeGreaterThan(idxSoul);
  });

  test('throws when AGENTS.md missing', async () => {
    const configsDir = join(homeDir, 'configs');
    const memoryVaultDir = join(homeDir, 'Memory');
    mkdirSync(memoryVaultDir, { recursive: true });
    writeFileSync(join(memoryVaultDir, 'IDENTITY.md'), 'x');
    writeFileSync(join(memoryVaultDir, 'SOUL.md'), 'x');
    writeFileSync(join(memoryVaultDir, 'USER.md'), 'x');
    await expect(composeInstructions(configsDir, memoryVaultDir)).rejects.toThrow();
  });

  test('tolerates missing optional Memory files (skips with header note)', async () => {
    const configsDir = join(homeDir, 'configs');
    mkdirSync(join(configsDir, 'instructions'), { recursive: true });
    writeFileSync(join(configsDir, 'instructions', 'AGENTS.md'), 'agents only\n');
    const out = await composeInstructions(configsDir, join(homeDir, 'Memory'));
    expect(out).toContain('agents only');
  });
});

// ── syncInstructions ────────────────────────────────────────────────────────

describe('syncInstructions', () => {
  test('writes CLAUDE.md to memory/ dir, creating it if missing', async () => {
    const base = seedVariant('claude-3p', { withAccount: true });
    await syncInstructions(base, ACCOUNT, ORG, 'instructions content\n');
    const path = join(base, 'local-agent-mode-sessions', ACCOUNT, ORG, 'memory', 'CLAUDE.md');
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf-8')).toBe('instructions content\n');
  });

  test('overwrites existing CLAUDE.md', async () => {
    const base = seedVariant('claude-3p', { withAccount: true });
    const memoryDir = join(base, 'local-agent-mode-sessions', ACCOUNT, ORG, 'memory');
    mkdirSync(memoryDir, { recursive: true });
    writeFileSync(join(memoryDir, 'CLAUDE.md'), 'old\n');
    await syncInstructions(base, ACCOUNT, ORG, 'new\n');
    expect(readFileSync(join(memoryDir, 'CLAUDE.md'), 'utf-8')).toBe('new\n');
  });
});

// ── syncSkills ──────────────────────────────────────────────────────────────

describe('syncSkills', () => {
  test('creates skills-plugin scaffold when none exists', async () => {
    const base = seedVariant('claude-3p', { withAccount: true });
    const { configsDir } = seedSourceConfigs();
    await syncSkills(base, ACCOUNT, ORG, join(configsDir, 'skills'));
    const root = join(base, 'local-agent-mode-sessions', 'skills-plugin', ORG, ACCOUNT);
    expect(existsSync(join(root, '.claude-plugin', 'plugin.json'))).toBe(true);
    expect(existsSync(join(root, 'manifest.json'))).toBe(true);
    expect(existsSync(join(root, 'skills', 'release', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(root, 'skills', 'release', 'helper.md'))).toBe(true);
    expect(existsSync(join(root, 'skills', 'brainstorming', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(root, 'skills', 'brainstorming', 'subdir', 'nested.md'))).toBe(true);
  });

  test('preserves Anthropic manifest entries, upserts user entries', async () => {
    const base = seedVariant('claude-3p', { withAccount: true, withAnthropicSkills: true });
    const { configsDir } = seedSourceConfigs();
    await syncSkills(base, ACCOUNT, ORG, join(configsDir, 'skills'));
    const manifestPath = join(base, 'local-agent-mode-sessions', 'skills-plugin', ORG, ACCOUNT, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

    const byName = Object.fromEntries(manifest.skills.map((s: any) => [s.name, s]));
    expect(byName.schedule).toBeDefined();
    expect(byName.schedule.creatorType).toBe('anthropic');
    expect(byName.release).toBeDefined();
    expect(byName.release.creatorType).toBe('user');
    expect(byName.release.description).toBe('Release skill description.');
    expect(byName.release.enabled).toBe(true);
    expect(byName.brainstorming).toBeDefined();
    expect(byName.brainstorming.creatorType).toBe('user');
  });

  test('idempotent: re-running yields same manifest content', async () => {
    const base = seedVariant('claude-3p', { withAccount: true, withAnthropicSkills: true });
    const { configsDir } = seedSourceConfigs();
    await syncSkills(base, ACCOUNT, ORG, join(configsDir, 'skills'));
    const manifestPath = join(base, 'local-agent-mode-sessions', 'skills-plugin', ORG, ACCOUNT, 'manifest.json');
    const first = readFileSync(manifestPath, 'utf-8');
    await syncSkills(base, ACCOUNT, ORG, join(configsDir, 'skills'));
    const second = readFileSync(manifestPath, 'utf-8');
    expect(second).toBe(first);
  });

  test('removes stale user skills no longer in source', async () => {
    const base = seedVariant('claude-3p', { withAccount: true, withAnthropicSkills: true });
    const { configsDir } = seedSourceConfigs();
    // First sync: creates release, brainstorming
    await syncSkills(base, ACCOUNT, ORG, join(configsDir, 'skills'));
    // Remove brainstorming from source
    rmSync(join(configsDir, 'skills', 'brainstorming'), { recursive: true });
    await syncSkills(base, ACCOUNT, ORG, join(configsDir, 'skills'));
    const root = join(base, 'local-agent-mode-sessions', 'skills-plugin', ORG, ACCOUNT);
    expect(existsSync(join(root, 'skills', 'brainstorming'))).toBe(false);
    expect(existsSync(join(root, 'skills', 'release'))).toBe(true);
    expect(existsSync(join(root, 'skills', 'schedule'))).toBe(true); // anthropic untouched
    const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf-8'));
    const names = manifest.skills.map((s: any) => s.name);
    expect(names).not.toContain('brainstorming');
    expect(names).toContain('schedule');
  });
});

// ── syncClaudeDesktop end-to-end ────────────────────────────────────────────

describe('syncClaudeDesktop', () => {
  test('skips when no variants present', async () => {
    const { configsDir, memoryVaultDir } = seedSourceConfigs();
    const result = await syncClaudeDesktop({ configsDir, memoryVaultDir, homeDir });
    expect(result.variants).toEqual([]);
  });

  test('syncs instructions + skills for present variant', async () => {
    seedVariant('claude-3p', { withAccount: true, withAnthropicSkills: true });
    const { configsDir, memoryVaultDir } = seedSourceConfigs();
    const result = await syncClaudeDesktop({ configsDir, memoryVaultDir, homeDir });
    expect(result.variants).toContain('claude-3p');
    const base = variantBase('claude-3p');
    expect(existsSync(join(base, 'local-agent-mode-sessions', ACCOUNT, ORG, 'memory', 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(base, 'local-agent-mode-sessions', 'skills-plugin', ORG, ACCOUNT, 'manifest.json'))).toBe(true);
  });

  test('skips variant without account (no UUID pair) but does not error', async () => {
    seedVariant('claude-3p'); // no account dir
    const { configsDir, memoryVaultDir } = seedSourceConfigs();
    const result = await syncClaudeDesktop({ configsDir, memoryVaultDir, homeDir });
    expect(result.variants).toEqual([]);
  });
});
