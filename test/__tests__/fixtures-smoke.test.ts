import { describe, it, expect } from 'bun:test';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ClaudeCodeAdapter } from '../../src/adapters/claude-code';
import { OpenCodeAdapter } from '../../src/adapters/opencode';
import { GeminiAdapter } from '../../src/adapters/gemini';
import { CodexAdapter } from '../../src/adapters/codex';
import { parseFrontmatter } from '../../src/formats/markdown';
import type { CanonicalItem, TargetName } from '../../src/types';
import type { ToolAdapter } from '../../src/adapters/base';

const FIXTURE_ROOT = join(import.meta.dir, '..', 'fixtures');
const CANONICAL = join(FIXTURE_ROOT, 'canonical');

const adapters: { name: TargetName; dirName: string; adapter: ToolAdapter }[] = [
  { name: 'claude-code', dirName: 'claude', adapter: new ClaudeCodeAdapter() },
  { name: 'opencode', dirName: 'opencode', adapter: new OpenCodeAdapter() },
  { name: 'gemini', dirName: 'gemini', adapter: new GeminiAdapter() },
  { name: 'codex', dirName: 'codex', adapter: new CodexAdapter() },
];

function readCanonical(subpath: string, name: string): CanonicalItem {
  const raw = readFileSync(join(CANONICAL, subpath), 'utf-8');
  const { data, content } = parseFrontmatter(raw);
  return { name, content, metadata: data };
}

// ── Fixture completeness ──────────────────────────────────────────────────

describe('Fixture completeness', () => {
  const canonicalTypes = ['commands', 'agents', 'mcp', 'settings', 'skills', 'instructions'];

  it('all 6 canonical type directories exist', () => {
    for (const type of canonicalTypes) {
      expect(existsSync(join(CANONICAL, type))).toBe(true);
    }
  });

  it('canonical commands has 2 files', () => {
    const files = ['groom-docs.md', 'obs-jot.md'];
    for (const f of files) {
      expect(existsSync(join(CANONICAL, 'commands', f))).toBe(true);
    }
  });

  it('canonical agents has 2 files', () => {
    const files = ['test-agent.md', 'simple-agent.md'];
    for (const f of files) {
      expect(existsSync(join(CANONICAL, 'agents', f))).toBe(true);
    }
  });

  it('canonical skills has 2 skill directories', () => {
    const skills = ['obsidian', 'web-design-guidelines'];
    for (const s of skills) {
      expect(existsSync(join(CANONICAL, 'skills', s, 'SKILL.md'))).toBe(true);
    }
  });

  it('canonical instructions has AGENTS.md', () => {
    expect(existsSync(join(CANONICAL, 'instructions', 'AGENTS.md'))).toBe(true);
  });

  it('all 4 target directories exist with expected subdirs', () => {
    for (const { dirName } of adapters) {
      const targetRoot = join(FIXTURE_ROOT, dirName);
      expect(existsSync(join(targetRoot, 'commands'))).toBe(true);
      expect(existsSync(join(targetRoot, 'agents'))).toBe(true);
      expect(existsSync(join(targetRoot, 'skills'))).toBe(true);
      expect(existsSync(join(targetRoot, 'instructions'))).toBe(true);
    }
  });
});

// ── Golden file accuracy ──────────────────────────────────────────────────

describe('Golden file accuracy', () => {
  const commandNames = ['groom-docs', 'obs-jot'];
  const agentNames = ['test-agent', 'simple-agent'];
  const skillNames = ['obsidian', 'web-design-guidelines'];

  const instructionFilenames: Record<TargetName, string> = {
    'claude-code': 'CLAUDE.md',
    'opencode': 'AGENTS.md',
    'gemini': 'AGENTS.md',
    'codex': 'AGENTS.md',
  };

  describe('commands', () => {
    for (const cmdName of commandNames) {
      for (const { name: target, dirName, adapter } of adapters) {
        it(`${cmdName} → ${target}`, () => {
          const item = readCanonical(`commands/${cmdName}.md`, cmdName);
          const rendered = adapter.renderCommand(item);
          const goldenPath = join(
            FIXTURE_ROOT,
            dirName,
            'commands',
            basename(rendered.relativePath),
          );
          const golden = readFileSync(goldenPath, 'utf-8');
          expect(rendered.content).toBe(golden);
        });
      }
    }
  });

  describe('agents', () => {
    for (const agentName of agentNames) {
      for (const { name: target, dirName, adapter } of adapters) {
        it(`${agentName} → ${target}`, () => {
          const item = readCanonical(`agents/${agentName}.md`, agentName);
          const rendered = adapter.renderAgent(item);
          const goldenPath = join(
            FIXTURE_ROOT,
            dirName,
            'agents',
            basename(rendered.relativePath),
          );
          const golden = readFileSync(goldenPath, 'utf-8');
          expect(rendered.content).toBe(golden);
        });
      }
    }
  });

  describe('skills (identity rendering)', () => {
    for (const skillName of skillNames) {
      for (const { name: target, dirName, adapter } of adapters) {
        it(`${skillName} → ${target}`, () => {
          const item = readCanonical(`skills/${skillName}/SKILL.md`, skillName);
          const rendered = adapter.renderSkill(item);
          const goldenPath = join(FIXTURE_ROOT, dirName, 'skills', skillName, 'SKILL.md');
          const golden = readFileSync(goldenPath, 'utf-8');
          expect(rendered.content).toBe(golden);
        });
      }
    }
  });

  describe('instructions (identity passthrough)', () => {
    for (const { name: target, dirName, adapter } of adapters) {
      it(`instructions → ${target}`, () => {
        const raw = readFileSync(join(CANONICAL, 'instructions', 'AGENTS.md'), 'utf-8');
        const rendered = adapter.renderInstructions(raw);
        const goldenPath = join(FIXTURE_ROOT, dirName, 'instructions', instructionFilenames[target]);
        const golden = readFileSync(goldenPath, 'utf-8');
        expect(rendered).toBe(golden);
      });
    }
  });
});

