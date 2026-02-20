import { describe, it, expect } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { OpenCodeAdapter } from '../opencode';

const HOME = os.homedir();

const adapter = new OpenCodeAdapter();

const baseCommandItem = {
  name: 'zz-plan',
  content: 'This is the command body.\n',
  metadata: {
    description: 'Plan a feature',
    'argument-hint': '[feature]',
    'allowed-tools': ['Read', 'Write', 'Bash'],
  },
};

describe('OpenCodeAdapter.renderCommand', () => {
  it('produces correct command file path (keeps zz- prefix)', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.relativePath).toBe(path.join(HOME, '.config/opencode/command/zz-plan.md'));
  });

  it('keeps description in frontmatter', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('description: Plan a feature');
  });

  it('strips allowed-tools from frontmatter', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).not.toContain('allowed-tools');
  });

  it('strips argument-hint from frontmatter', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).not.toContain('argument-hint');
  });

  it('includes body verbatim', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('This is the command body.');
  });

  it('handles item with no description gracefully (no frontmatter emitted)', () => {
    const item = { ...baseCommandItem, metadata: {} };
    const result = adapter.renderCommand(item);
    // gray-matter omits frontmatter delimiters when data is empty — body only
    expect(result.content).toContain('This is the command body.');
  });
});

describe('OpenCodeAdapter.renderAgent', () => {
  const agentItem = {
    name: 'my-agent',
    content: 'Agent body content.\n',
    metadata: {
      name: 'my-agent',
      description: 'Does agent things',
      'allowed-tools': ['Read', 'Write'],
    },
  };

  it('produces correct agent file path', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.relativePath).toBe(path.join(HOME, '.config/opencode/agents/my-agent.md'));
  });

  it('adds mode: subagent to frontmatter', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content).toContain('mode: subagent');
  });

  it('strips name from frontmatter', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content).not.toContain('name: my-agent');
  });

  it('strips allowed-tools from agent frontmatter', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content).not.toContain('allowed-tools');
  });

  it('keeps description in agent frontmatter', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content).toContain('description: Does agent things');
  });

  it('includes body verbatim', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content).toContain('Agent body content.');
  });
});

describe('OpenCodeAdapter capabilities', () => {
  it('reports all capabilities as true', () => {
    const caps = adapter.getCapabilities();
    expect(caps.commands).toBe(true);
    expect(caps.agents).toBe(true);
    expect(caps.mcp).toBe(true);
    expect(caps.instructions).toBe(true);
    expect(caps.skills).toBe(true);
  });

  it('has correct target and displayName', () => {
    expect(adapter.target).toBe('opencode');
    expect(adapter.displayName).toBe('OpenCode');
  });
});
