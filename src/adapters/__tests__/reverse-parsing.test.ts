import { describe, expect, test } from 'bun:test';
import { ClaudeCodeAdapter } from '../claude-code';
import { GeminiAdapter } from '../gemini';
import { CodexAdapter } from '../codex';

// Test subclasses to expose protected methods

class TestClaudeAdapter extends ClaudeCodeAdapter {
  public testCommandNameFromFile(f: string) {
    return this.commandNameFromFile(f);
  }
}

class TestGeminiAdapter extends GeminiAdapter {
  public testCommandNameFromFile(f: string) {
    return this.commandNameFromFile(f);
  }
}

class TestCodexAdapter extends CodexAdapter {
  public testAgentNameFromFile(f: string) {
    return this.agentNameFromFile(f);
  }
}

describe('Claude commandNameFromFile', () => {
  const adapter = new TestClaudeAdapter();

  test('plan.md returns plan (name preserved as-is)', () => {
    expect(adapter.testCommandNameFromFile('plan.md')).toBe('plan');
  });

  test('my-plan.md returns my-plan (name preserved as-is)', () => {
    expect(adapter.testCommandNameFromFile('my-plan.md')).toBe('my-plan');
  });

  test('plan.toml returns null (not .md)', () => {
    expect(adapter.testCommandNameFromFile('plan.toml')).toBeNull();
  });
});

describe('Gemini commandNameFromFile', () => {
  const adapter = new TestGeminiAdapter();

  test('my-plan.toml returns my-plan', () => {
    expect(adapter.testCommandNameFromFile('my-plan.toml')).toBe('my-plan');
  });

  test('my-gate.toml returns my-gate', () => {
    expect(adapter.testCommandNameFromFile('my-gate.toml')).toBe('my-gate');
  });

  test('my-plan.md returns null (not .toml)', () => {
    expect(adapter.testCommandNameFromFile('my-plan.md')).toBeNull();
  });
});

describe('Codex agentNameFromFile', () => {
  const adapter = new TestCodexAdapter();

  test('agent-my-planner.md returns my-planner', () => {
    expect(adapter.testAgentNameFromFile('agent-my-planner.md')).toBe('my-planner');
  });

  test('agent-my-reviewer.md returns my-reviewer', () => {
    expect(adapter.testAgentNameFromFile('agent-my-reviewer.md')).toBe('my-reviewer');
  });

  test('my-planner.md returns null (no agent- prefix)', () => {
    expect(adapter.testAgentNameFromFile('my-planner.md')).toBeNull();
  });
});

describe('Gemini parseCommand (TOML reverse)', () => {
  const adapter = new GeminiAdapter();

  test('parses TOML with description and prompt, strips trailing User arguments suffix', () => {
    const toml = `description = "Test"\nprompt = """\nDo the thing.\n\nUser arguments: {args}\n"""\n`;
    const result = adapter.parseCommand('test', toml);

    expect(result.name).toBe('test');
    expect(result.content).toBe('Do the thing.');
    expect(result.metadata.description).toBe('Test');
  });
});

describe('Codex parseCommand (flat markdown reverse)', () => {
  const adapter = new CodexAdapter();

  test('parses heading, description, and body from flat markdown', () => {
    const input = `# /my-plan\n\nPlan the task\n\nBody content here.\n`;
    const result = adapter.parseCommand('my-plan', input);

    expect(result.name).toBe('my-plan');
    expect(result.content).toBe('Body content here.');
    expect(result.metadata.description).toBe('Plan the task');
  });
});

describe('Codex parseAgent (flat markdown reverse)', () => {
  const adapter = new CodexAdapter();

  test('parses agent with allowed tools', () => {
    const input = `# Agent: my-planner\n\n**Role**: Plans tasks\n\n**Allowed Tools**: Read, Write\n\nInstructions here.\n`;
    const result = adapter.parseAgent('my-planner', input);

    expect(result.name).toBe('my-planner');
    expect(result.content).toBe('Instructions here.');
    expect(result.metadata.description).toBe('Plans tasks');
    expect(result.metadata['allowed-tools']).toEqual(['Read', 'Write']);
  });

  test('parses agent without allowed tools', () => {
    const input = `# Agent: my-reviewer\n\n**Role**: Reviews code\n\nReview instructions.\n`;
    const result = adapter.parseAgent('my-reviewer', input);

    expect(result.name).toBe('my-reviewer');
    expect(result.content).toBe('Review instructions.');
    expect(result.metadata.description).toBe('Reviews code');
    expect(result.metadata['allowed-tools']).toBeUndefined();
  });
});
