import { describe, it, expect } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { GeminiAdapter } from '../gemini';

const HOME = os.homedir();

const adapter = new GeminiAdapter();

const baseCommandItem = {
  name: 'zz-plan',
  content: 'This is the command body.\nWith multiple lines.\n',
  metadata: {
    description: 'Plan a feature',
    'argument-hint': '[feature]',
    'allowed-tools': ['Read', 'Write'],
  },
};

const agentItem = {
  name: 'my-agent',
  content: 'Agent body content.\n',
  metadata: {
    name: 'my-agent',
    description: 'Does agent things',
    'allowed-tools': ['Read', 'Write'],
  },
};

describe('GeminiAdapter.renderCommand', () => {
  it('outputs .toml extension in path', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.relativePath).toBe(path.join(HOME, '.gemini/commands/zz-plan.toml'));
  });

  it('includes description as TOML key', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('description = "Plan a feature"');
  });

  it('includes prompt with triple-quoted string', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('prompt = """');
    expect(result.content).toContain('"""');
  });

  it('appends User arguments: {args} at end of prompt', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('User arguments: {args}');
  });

  it('includes original body in prompt', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('This is the command body.');
    expect(result.content).toContain('With multiple lines.');
  });

  it('does not include allowed-tools in TOML output', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).not.toContain('allowed-tools');
  });

  it('does not include argument-hint in TOML output', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).not.toContain('argument-hint');
  });

  it('handles empty description gracefully', () => {
    const item = { ...baseCommandItem, metadata: {} };
    const result = adapter.renderCommand(item);
    expect(result.content).toContain('description = ""');
  });
});

describe('GeminiAdapter.renderAgent', () => {
  it('produces correct agent file path (.md extension)', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.relativePath).toBe(path.join(HOME, '.gemini/agents/my-agent.md'));
  });

  it('adds kind: local to frontmatter', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content).toContain('kind: local');
  });

  it('keeps description in agent frontmatter', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content).toContain('description: Does agent things');
  });

  it('keeps allowed-tools in agent frontmatter', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content).toContain('allowed-tools');
  });

  it('includes body verbatim', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content).toContain('Agent body content.');
  });

  it('produces valid frontmatter-wrapped output', () => {
    const result = adapter.renderAgent(agentItem);
    expect(result.content.startsWith('---')).toBe(true);
  });
});

describe('GeminiAdapter capabilities', () => {
  it('reports skills as false', () => {
    const caps = adapter.getCapabilities();
    expect(caps.skills).toBe(false);
  });

  it('reports core capabilities as true', () => {
    const caps = adapter.getCapabilities();
    expect(caps.commands).toBe(true);
    expect(caps.agents).toBe(true);
    expect(caps.mcp).toBe(true);
    expect(caps.instructions).toBe(true);
  });

  it('has correct target and displayName', () => {
    expect(adapter.target).toBe('gemini');
    expect(adapter.displayName).toBe('Gemini');
  });
});
