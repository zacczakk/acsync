import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isCanonicalAgentForTarget, readCanonicalAgents, readCanonicalMCPServers, readCanonicalSkills } from '../canonical';

describe('canonical agent routing', () => {
  test('uses the approved GPT-5.6 tiers and reasoning efforts', async () => {
    const agents = await readCanonicalAgents(process.cwd(), () => false);
    const routing = Object.fromEntries(
      agents.map(({ name, metadata }) => [
        name,
        [metadata.model, metadata.reasoningEffort],
      ]),
    );

    expect(routing).toEqual({
      'api-review': ['tux/gpt-5.6-terra', 'medium'],
      docs: ['tux/gpt-5.6-luna', 'max'],
      execute: ['tux/gpt-5.6-terra', 'low'],
      'fast-worker': ['openai/gpt-5.6-luna-fast', 'max'],
      'foundry-sql': ['tux/gpt-5.6-luna', 'max'],
      'infra-review': ['tux/gpt-5.6-terra', 'medium'],
      release: ['tux/gpt-5.6-terra', 'low'],
      research: ['tux/gpt-5.6-luna', 'max'],
      'security-review': ['tux/gpt-5.6-sol', 'high'],
      'vault-ops': ['tux/gpt-5.6-luna', 'max'],
      verify: ['tux/gpt-5.6-terra', 'medium'],
    });
  });

  test('limits Foundry SQL agent to OpenCode targets', async () => {
    const agents = await readCanonicalAgents(process.cwd(), () => false);
    const agent = agents.find(({ name }) => name === 'foundry-sql');

    expect(agent?.metadata.targets).toEqual(['opencode', 'opencode2']);
    expect(agent && isCanonicalAgentForTarget(agent, 'opencode')).toBe(true);
    expect(agent && isCanonicalAgentForTarget(agent, 'opencode2')).toBe(true);
    expect(agent && isCanonicalAgentForTarget(agent, 'claude-code')).toBe(false);
    expect(agent && isCanonicalAgentForTarget(agent, 'codex')).toBe(false);
  });

  test('gives Foundry SQL agent access to the complete Palantir MCP namespace', async () => {
    const agents = await readCanonicalAgents(process.cwd(), () => false);
    const agent = agents.find(({ name }) => name === 'foundry-sql');

    expect(agent?.metadata.permission).toMatchObject({
      '*': 'deny',
      'palantir-mcp_*': 'allow',
    });
  });

  test('requires replayable Palantir calls in the Foundry SQL report', async () => {
    const agents = await readCanonicalAgents(process.cwd(), () => false);
    const agent = agents.find(({ name }) => name === 'foundry-sql');

    expect(agent?.content).toContain('Reproduction calls:');
    expect(agent?.content).toContain('exact native tool name');
    expect(agent?.content).toMatch(/complete JSON argument\s+object/);
    expect(agent?.content).toContain('Do not abbreviate, paraphrase');
  });

  test('routes OpenCode explore to Luna with low reasoning effort', () => {
    const settings = JSON.parse(
      readFileSync(join(process.cwd(), 'configs', 'settings', 'opencode.json'), 'utf8'),
    ) as { model?: string; agent?: Record<string, { model?: string; options?: { reasoningEffort?: string } }> };

    expect(settings.model).toBe('tux/gpt-5.6-luna');
    expect(settings.agent?.explore).toEqual({
      model: 'tux/gpt-5.6-luna',
      options: { reasoningEffort: 'low' },
    });
  });

  test('keeps all validated Tux reasoning variants for Luna and Terra', () => {
    const settings = JSON.parse(
      readFileSync(join(process.cwd(), 'configs', 'settings', 'opencode.json'), 'utf8'),
    ) as {
      provider?: {
        tux?: {
          models?: Record<string, {
            options?: { reasoningEffort?: string };
            variants?: Record<string, { reasoningEffort?: string }>;
          }>;
        };
      };
    };
    const expected = ['none', 'low', 'medium', 'high', 'xhigh', 'max'];

    for (const model of ['gpt-5.6-luna', 'gpt-5.6-terra']) {
      expect(Object.keys(settings.provider?.tux?.models?.[model]?.variants ?? {})).toEqual(expected);
    }
    expect(settings.provider?.tux?.models?.['gpt-5.6-luna']?.options?.reasoningEffort).toBe('max');
  });
});

describe('canonical vault retrieval policy', () => {
  test('does not launch the Obsidian app for routine reads or searches', () => {
    const walk = (directory: string): string[] => readdirSync(directory).flatMap((entry) => {
      const path = join(directory, entry);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
    const files = [
      ...walk(join(process.cwd(), 'configs', 'agents')),
      ...walk(join(process.cwd(), 'configs', 'commands')),
      ...walk(join(process.cwd(), 'configs', 'plugins')),
      'configs/skills/memory-retrieval/SKILL.md',
      'configs/skills/obsidian-vault-conventions/SKILL.md',
    ].map((file) => file.startsWith('/') ? file : join(process.cwd(), file));

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/obsidian\s+(?:vault=\w+\s+)?(?:files|read|search(?::context)?|create|append|move|delete|task|links|backlinks)(?:\s|`)/);
    }
  });
});

describe('upstream skill registry', () => {
  test('does not resync removed skills and tracks Matt replacements', () => {
    const registry = JSON.parse(
      readFileSync(join(process.cwd(), 'configs', 'skills', 'registry.json'), 'utf8'),
    ) as {
      upstreams: Record<string, {
        repo: string;
        basePath: string;
        skills: Record<string, unknown>;
      }>;
    };
    const registeredSkills = Object.values(registry.upstreams)
      .flatMap((upstream) => Object.keys(upstream.skills));
    const removedSkills = [
      'doc-coauthoring',
      'dispatching-parallel-agents',
      'finishing-a-development-branch',
      'receiving-code-review',
      'requesting-code-review',
      'skill-creator',
      'systematic-debugging',
      'test-driven-development',
      'using-git-worktrees',
      'webapp-testing',
      'writing-skills',
    ];

    for (const skill of removedSkills) {
      expect(registeredSkills).not.toContain(skill);
      expect(existsSync(join(process.cwd(), 'configs', 'skills', skill))).toBe(false);
    }
    expect(existsSync(join(process.cwd(), 'configs', 'skills', 'diagnosing-bugs', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(process.cwd(), 'configs', 'skills', 'tdd', 'SKILL.md'))).toBe(true);
    expect(registry.upstreams.mattpocock).toEqual({
      repo: 'https://github.com/mattpocock/skills.git',
      basePath: 'skills/engineering',
      skills: {
        'diagnosing-bugs': { sync: 'auto' },
        tdd: { sync: 'auto' },
      },
    });
  });
});

describe('readCanonicalMCPServers', () => {
  test('normalizes snake_case MCP fields from canonical JSON', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'canonical-mcp-'));
    const mcpDir = join(projectDir, 'configs', 'mcp');
    mkdirSync(mcpDir, { recursive: true });

    writeFileSync(join(mcpDir, 'context7.json'), JSON.stringify({
      transport: 'http',
      url: 'https://mcp.context7.com/mcp',
      headers: { 'X-Env': '${CONTEXT7_API_KEY}' },
      env_vars: ['CONTEXT7_API_KEY'],
      disabled_for: ['codex'],
      target_options: {
        opencode: { timeout: 20_000 },
      },
      enabled: false,
    }, null, 2));

    const [server] = await readCanonicalMCPServers(projectDir);

    expect(server).toEqual({
      name: 'context7',
      transport: 'http',
      url: 'https://mcp.context7.com/mcp',
      headers: { 'X-Env': '${CONTEXT7_API_KEY}' },
      envVars: ['CONTEXT7_API_KEY'],
      disabledFor: ['codex'],
      targetOptions: {
        opencode: { timeout: 20_000 },
      },
      enabled: false,
    });
  });
});

describe('readCanonicalSkills', () => {
  test('fails closed when the canonical skills root is missing', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'canonical-skills-missing-'));

    await expect(readCanonicalSkills(projectDir, () => false)).rejects.toThrow('Unable to read canonical skills root');
  });
});
