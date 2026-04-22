import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  ALL_TARGETS,
  createAdapter,
  readCanonicalCommands,
  readCanonicalSkills,
  readCanonicalMCPServers,
  readCanonicalInstructions,
} from '../canonical';
import { createExclusionFilter } from '../../infra/exclusion';

const projectDir = join(import.meta.dir, '..', '..', '..');

describe('render subcommand logic', () => {
  test('renders a canonical command for all 4 targets', async () => {
    const isExcluded = createExclusionFilter();
    const commands = await readCanonicalCommands(projectDir, isExcluded);
    expect(commands.length).toBeGreaterThan(0);

    const first = commands[0]!;
    for (const target of ALL_TARGETS) {
      const adapter = createAdapter(target);
      const rendered = adapter.renderCommand(first);
      expect(rendered.content.length).toBeGreaterThan(0);
      expect(rendered.relativePath.length).toBeGreaterThan(0);
    }
  });

  test('renders instructions for a target', async () => {
    const content = await readCanonicalInstructions(projectDir);
    expect(content).not.toBeNull();

    const adapter = createAdapter('claude-code');
    const rendered = adapter.renderInstructions(content!);
    expect(rendered.length).toBeGreaterThan(0);
  });

  test('renders a canonical skill for targets that support skills', async () => {
    const isExcluded = createExclusionFilter();
    const skills = await readCanonicalSkills(projectDir, isExcluded);
    if (skills.length === 0) return;

    const first = skills[0]!;
    for (const target of ALL_TARGETS) {
      const adapter = createAdapter(target);
      const caps = adapter.getCapabilities();
      if (!caps.skills) continue;
      const rendered = adapter.renderSkill(first);
      expect(rendered.content.length).toBeGreaterThan(0);
    }
  });

  test('single target filter returns only that target rendering', async () => {
    const isExcluded = createExclusionFilter();
    const commands = await readCanonicalCommands(projectDir, isExcluded);
    expect(commands.length).toBeGreaterThan(0);

    const first = commands[0]!;
    const adapter = createAdapter('claude-code');
    const rendered = adapter.renderCommand(first);
    expect(rendered.content.length).toBeGreaterThan(0);
  });

  test('nonexistent command is not found in canonical list', async () => {
    const isExcluded = createExclusionFilter();
    const commands = await readCanonicalCommands(projectDir, isExcluded);
    const missing = commands.find((c) => c.name === 'this-does-not-exist-xyz');
    expect(missing).toBeUndefined();
  });

  test('renders MCP servers', async () => {
    const servers = await readCanonicalMCPServers(projectDir);
    expect(servers.length).toBeGreaterThan(0);

    const adapter = createAdapter('claude-code');
    const rendered = adapter.renderMCPServers(servers);
    expect(rendered.length).toBeGreaterThan(0);
  });

  test('canonical palantir-mcp mirrors Tux launcher shape', async () => {
    const servers = await readCanonicalMCPServers(projectDir);
    const palantir = servers.find((server) => server.name === 'palantir-mcp');

    expect(palantir).toEqual({
      name: 'palantir-mcp',
      description: 'Palantir Foundry data access MCP server via Tux launcher',
      transport: 'stdio',
      command: 'tux',
      args: ['palantir-mcp', 'start'],
      enabled: false,
      targetOptions: {
        'claude-code': { type: 'stdio', disabled: true },
        opencode: { timeout: 20000 },
      },
    });
  });

  test('palantir-mcp renders to Claude/OpenCode with Tux launcher', async () => {
    const servers = await readCanonicalMCPServers(projectDir);
    const palantir = servers.find((server) => server.name === 'palantir-mcp');
    expect(palantir).toBeDefined();

    const claudeRendered = createAdapter('claude-code').renderMCPServers([palantir!]);
    expect(claudeRendered).toContain('"command": "tux"');
    expect(claudeRendered).toContain('"palantir-mcp"');
    expect(claudeRendered).toContain('"start"');
    expect(claudeRendered).toContain('"type": "stdio"');
    expect(claudeRendered).toContain('"disabled": true');
    expect(claudeRendered).not.toContain('"enabled": false');
    expect(claudeRendered.indexOf('"type": "stdio"')).toBeLessThan(claudeRendered.indexOf('"command": "tux"'));
    expect(claudeRendered).not.toContain('palantir-mcp@latest');
    expect(claudeRendered).not.toContain('FOUNDRY_TOKEN');

    const opencodeRendered = createAdapter('opencode').renderMCPServers([palantir!]);
    expect(opencodeRendered).toContain('"tux"');
    expect(opencodeRendered).toContain('"palantir-mcp"');
    expect(opencodeRendered).toContain('"start"');
    expect(opencodeRendered).toContain('"timeout": 20000');
    expect(opencodeRendered).not.toContain('palantir-mcp@latest');
    expect(opencodeRendered).not.toContain('FOUNDRY_TOKEN');

    const codexRendered = createAdapter('codex').renderMCPServers([palantir!]);
    expect(codexRendered).toContain('[mcp_servers.palantir-mcp]');
    expect(codexRendered).toContain('command = "tux"');
    expect(codexRendered).toContain('enabled = false');

    const geminiRendered = createAdapter('gemini').renderMCPServers([palantir!]);
    expect(geminiRendered).toContain('"palantir-mcp"');
    expect(geminiRendered).toContain('"command": "tux"');
    expect(geminiRendered).toContain('"excluded"');
    expect(geminiRendered).toContain('"palantir-mcp"');
  });
});
