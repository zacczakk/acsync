import { describe, it, expect } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { ClaudeCodeAdapter } from '../claude-code';

const HOME = os.homedir();

const adapter = new ClaudeCodeAdapter();

const baseItem = {
  name: 'my-plan',
  content: 'This is the command body.\n',
  metadata: {
    description: 'Plan a feature',
    'argument-hint': '[feature]',
    'allowed-tools': ['Read', 'Write', 'Bash'],
  },
};

describe('ClaudeCodeAdapter.renderCommand', () => {
  it('nests directly under commands/ directory', () => {
    const result = adapter.renderCommand(baseItem);
    const expected = path.join(HOME, '.claude/commands/my-plan.md');
    expect(result.relativePath).toBe(expected);
  });

  it('preserves all frontmatter keys verbatim', () => {
    const result = adapter.renderCommand(baseItem);
    expect(result.content).toContain('description: Plan a feature');
    expect(result.content).toContain('argument-hint');
    expect(result.content).toContain('allowed-tools');
  });

  it('includes body verbatim', () => {
    const result = adapter.renderCommand(baseItem);
    expect(result.content).toContain('This is the command body.');
  });

  it('handles item with different name', () => {
    const item = { ...baseItem, name: 'mycommand' };
    const result = adapter.renderCommand(item);
    expect(result.relativePath).toBe(path.join(HOME, '.claude/commands/mycommand.md'));
  });

  it('produces valid frontmatter wrapped output', () => {
    const result = adapter.renderCommand(baseItem);
    expect(result.content.startsWith('---')).toBe(true);
  });
});

describe('ClaudeCodeAdapter.renderAgent', () => {
  it('produces correct agent file path', () => {
    const agentItem = {
      name: 'my-agent',
      content: 'Agent body content.\n',
      metadata: {
        name: 'my-agent',
        description: 'Does agent things',
        'allowed-tools': ['Read'],
      },
    };
    const result = adapter.renderAgent(agentItem);
    expect(result.relativePath).toBe(path.join(HOME, '.claude/agents/my-agent.md'));
  });

  it('preserves all frontmatter keys in agent output', () => {
    const agentItem = {
      name: 'my-agent',
      content: 'Agent body content.\n',
      metadata: {
        name: 'my-agent',
        description: 'Does agent things',
        'allowed-tools': ['Read', 'Write'],
      },
    };
    const result = adapter.renderAgent(agentItem);
    expect(result.content).toContain('description: Does agent things');
    expect(result.content).toContain('allowed-tools');
    expect(result.content).toContain('name: my-agent');
  });

  it('includes body verbatim in agent output', () => {
    const agentItem = {
      name: 'my-agent',
      content: 'Agent body content.\n',
      metadata: { description: 'A description' },
    };
    const result = adapter.renderAgent(agentItem);
    expect(result.content).toContain('Agent body content.');
  });
});

describe('ClaudeCodeAdapter capabilities', () => {
  it('reports all capabilities as true', () => {
    const caps = adapter.getCapabilities();
    expect(caps.commands).toBe(true);
    expect(caps.agents).toBe(true);
    expect(caps.mcp).toBe(true);
    expect(caps.instructions).toBe(true);
    expect(caps.skills).toBe(true);
  });

  it('has correct target and displayName', () => {
    expect(adapter.target).toBe('claude-code');
    expect(adapter.displayName).toBe('Claude Code');
  });
});
