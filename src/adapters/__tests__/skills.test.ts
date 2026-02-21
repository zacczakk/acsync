import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClaudeCodeAdapter } from '../claude-code';

let fixtureDir: string;
let adapter: ClaudeCodeAdapter;

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'skills-test-'));

  // skill-a: simple skill, no support files
  const skillADir = join(fixtureDir, 'skill-a');
  mkdirSync(skillADir);
  writeFileSync(
    join(skillADir, 'SKILL.md'),
    '---\nname: skill-a\ndescription: A simple skill\n---\nSkill A body content.\n',
  );

  // skill-b: skill with support files
  const skillBDir = join(fixtureDir, 'skill-b');
  mkdirSync(skillBDir);
  writeFileSync(
    join(skillBDir, 'SKILL.md'),
    '---\nname: skill-b\ndescription: A complex skill\n---\nSkill B body content.\n',
  );
  writeFileSync(join(skillBDir, 'AGENTS.md'), '# Agents\nSome agent config.\n');
  const rulesDir = join(skillBDir, 'rules');
  mkdirSync(rulesDir);
  writeFileSync(join(rulesDir, 'rule1.md'), '# Rule 1\nFirst rule.\n');

  // .hidden-skill: dot-prefixed, should be excluded
  const hiddenDir = join(fixtureDir, '.hidden-skill');
  mkdirSync(hiddenDir);
  writeFileSync(join(hiddenDir, 'SKILL.md'), '---\nname: hidden\n---\nHidden.\n');

  // Create adapter and point skills dir to fixture
  adapter = new ClaudeCodeAdapter();
  const paths = adapter.getPaths();
  paths.getSkillsDir = () => fixtureDir;
});

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

describe('BaseAdapter.renderSkill', () => {
  test('returns correct SKILL.md path under skills dir', () => {
    const item = {
      name: 'my-skill',
      content: 'Skill body content.\n',
      metadata: {
        name: 'my-skill',
        description: 'A test skill',
      },
    };
    const result = adapter.renderSkill(item);
    expect(result.relativePath).toBe(join(fixtureDir, 'my-skill/SKILL.md'));
  });

  test('content includes stringified frontmatter and body', () => {
    const item = {
      name: 'my-skill',
      content: 'Skill body content.\n',
      metadata: {
        name: 'my-skill',
        description: 'A test skill',
      },
    };
    const result = adapter.renderSkill(item);
    expect(result.content).toContain('---');
    expect(result.content).toContain('description: A test skill');
    expect(result.content).toContain('Skill body content.');
  });

  test('handles skill name with special characters', () => {
    const item = {
      name: 'vercel-react-best-practices',
      content: 'React perf tips.\n',
      metadata: { description: 'Performance guidelines' },
    };
    const result = adapter.renderSkill(item);
    expect(result.relativePath).toBe(
      join(fixtureDir, 'vercel-react-best-practices/SKILL.md'),
    );
  });
});

describe('BaseAdapter.listExistingSkillNames', () => {
  test('returns names of subdirectories containing SKILL.md', async () => {
    const names = await adapter.listExistingSkillNames();

    expect(names).toContain('skill-a');
    expect(names).toContain('skill-b');
  });

  test('does not include dot-prefixed directories', async () => {
    const names = await adapter.listExistingSkillNames();
    for (const name of names) {
      expect(name.startsWith('.')).toBe(false);
    }
  });
});

describe('BaseAdapter.readSkill', () => {
  test('reads SKILL.md content and metadata', async () => {
    const skill = await adapter.readSkill('skill-a');

    expect(skill.name).toBe('skill-a');
    expect(skill.content).toContain('Skill A body content.');
    expect(skill.metadata).toBeDefined();
    expect(typeof skill.metadata).toBe('object');
    expect(skill.metadata.name).toBe('skill-a');
    expect(skill.metadata.description).toBe('A simple skill');
  });

  test('includes support files when present', async () => {
    const skill = await adapter.readSkill('skill-b');

    expect(skill.supportFiles).toBeDefined();
    expect(skill.supportFiles!.length).toBeGreaterThan(0);

    const paths = skill.supportFiles!.map((f) => f.relativePath);
    expect(paths).toContain('AGENTS.md');
    expect(paths.some((p) => p.startsWith('rules/'))).toBe(true);
  });

  test('excludes SKILL.md from support files', async () => {
    const skill = await adapter.readSkill('skill-b');

    const paths = skill.supportFiles!.map((f) => f.relativePath);
    expect(paths).not.toContain('SKILL.md');
  });

  test('returns empty supportFiles for skill with no extra files', async () => {
    const skill = await adapter.readSkill('skill-a');

    expect(skill.supportFiles).toBeDefined();
    expect(skill.supportFiles).toEqual([]);
  });
});
