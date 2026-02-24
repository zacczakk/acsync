import { describe, it, expect } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { CodexAdapter } from '../codex';

const HOME = os.homedir();

const adapter = new CodexAdapter();

const baseCommandItem = {
  name: 'my-plan',
  content: 'This is the command body.\nWith details.\n',
  metadata: {
    description: 'Plan a feature',
    'argument-hint': '[feature]',
    'allowed-tools': ['Read', 'Write'],
  },
};

const agentWithTools = {
  name: 'my-agent',
  content: 'Agent body content.\n',
  metadata: {
    name: 'my-agent',
    description: 'Does agent things',
    'allowed-tools': ['Read', 'Write', 'Bash'],
  },
};

const agentWithoutTools = {
  name: 'simple-agent',
  content: 'Simple agent body.\n',
  metadata: {
    description: 'A simple agent',
  },
};

describe('CodexAdapter.renderCommand', () => {
  it('produces correct command file path (.md in prompts/)', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.relativePath).toBe(path.join(HOME, '.codex/prompts/my-plan.md'));
  });

  it('uses # /{name} heading', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('# /my-plan');
  });

  it('includes description as paragraph', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('Plan a feature');
  });

  it('includes body verbatim', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('This is the command body.');
    expect(result.content).toContain('With details.');
  });

  it('has no frontmatter (no --- delimiters)', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).not.toContain('---');
  });

  it('has no allowed-tools in output', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).not.toContain('allowed-tools');
  });

  it('orders: heading → description → body', () => {
    const result = adapter.renderCommand(baseCommandItem);
    const headingIdx = result.content.indexOf('# /my-plan');
    const descIdx = result.content.indexOf('Plan a feature');
    const bodyIdx = result.content.indexOf('This is the command body.');
    expect(headingIdx).toBeLessThan(descIdx);
    expect(descIdx).toBeLessThan(bodyIdx);
  });
});

describe('CodexAdapter.renderAgent', () => {
  it('produces correct agent file path (.md in prompts/)', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.relativePath).toBe(path.join(HOME, '.codex/prompts/agent-my-agent.md'));
  });

  it('uses # Agent: {name} heading', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).toContain('# Agent: my-agent');
  });

  it('includes **Role** line with description', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).toContain('**Role**: Does agent things');
  });

  it('includes **Allowed Tools** line when tools present', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).toContain('**Allowed Tools**: Read, Write, Bash');
  });

  it('omits **Allowed Tools** line when no tools in canonical', () => {
    const result = adapter.renderAgent(agentWithoutTools);
    expect(result.content).not.toContain('**Allowed Tools**');
  });

  it('includes body verbatim', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).toContain('Agent body content.');
  });

  it('has no frontmatter', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).not.toContain('---');
  });

  it('orders: heading → Role → AllowedTools → body', () => {
    const result = adapter.renderAgent(agentWithTools);
    const headingIdx = result.content.indexOf('# Agent:');
    const roleIdx = result.content.indexOf('**Role**');
    const toolsIdx = result.content.indexOf('**Allowed Tools**');
    const bodyIdx = result.content.indexOf('Agent body content.');
    expect(headingIdx).toBeLessThan(roleIdx);
    expect(roleIdx).toBeLessThan(toolsIdx);
    expect(toolsIdx).toBeLessThan(bodyIdx);
  });
});

describe('CodexAdapter capabilities', () => {
  it('declares skills capability', () => {
    const caps = adapter.getCapabilities();
    expect(caps.skills).toBe(true);
  });

  it('reports core capabilities as true', () => {
    const caps = adapter.getCapabilities();
    expect(caps.commands).toBe(true);
    expect(caps.agents).toBe(true);
    expect(caps.mcp).toBe(true);
    expect(caps.instructions).toBe(true);
  });

  it('has correct target and displayName', () => {
    expect(adapter.target).toBe('codex');
    expect(adapter.displayName).toBe('Codex');
  });

  it('resolves skills dir to ~/.codex/skills/', () => {
    expect(adapter.getPaths().getSkillsDir()).toBe(path.join(HOME, '.codex/skills/'));
  });
});
