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

  test('plan.md returns plan (no zz- prefix added)', () => {
    expect(adapter.testCommandNameFromFile('plan.md')).toBe('plan');
  });

  test('zz-plan.md returns zz-plan (name preserved as-is)', () => {
    expect(adapter.testCommandNameFromFile('zz-plan.md')).toBe('zz-plan');
  });

  test('plan.toml returns null (not .md)', () => {
    expect(adapter.testCommandNameFromFile('plan.toml')).toBeNull();
  });
});

describe('Gemini commandNameFromFile', () => {
  const adapter = new TestGeminiAdapter();

  test('zz-plan.toml returns zz-plan', () => {
    expect(adapter.testCommandNameFromFile('zz-plan.toml')).toBe('zz-plan');
  });

  test('zz-gate.toml returns zz-gate', () => {
    expect(adapter.testCommandNameFromFile('zz-gate.toml')).toBe('zz-gate');
  });

  test('zz-plan.md returns null (not .toml)', () => {
    expect(adapter.testCommandNameFromFile('zz-plan.md')).toBeNull();
  });
});

describe('Codex agentNameFromFile', () => {
  const adapter = new TestCodexAdapter();

  test('agent-zz-planner.md returns zz-planner', () => {
    expect(adapter.testAgentNameFromFile('agent-zz-planner.md')).toBe('zz-planner');
  });

  test('agent-zz-reviewer.md returns zz-reviewer', () => {
    expect(adapter.testAgentNameFromFile('agent-zz-reviewer.md')).toBe('zz-reviewer');
  });

  test('zz-planner.md returns null (no agent- prefix)', () => {
    expect(adapter.testAgentNameFromFile('zz-planner.md')).toBeNull();
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
    const input = `# /zz-plan\n\nPlan the task\n\nBody content here.\n`;
    const result = adapter.parseCommand('zz-plan', input);

    expect(result.name).toBe('zz-plan');
    expect(result.content).toBe('Body content here.');
    expect(result.metadata.description).toBe('Plan the task');
  });
});

describe('Codex parseAgent (flat markdown reverse)', () => {
  const adapter = new CodexAdapter();

  test('parses agent with allowed tools', () => {
    const input = `# Agent: zz-planner\n\n**Role**: Plans tasks\n\n**Allowed Tools**: Read, Write\n\nInstructions here.\n`;
    const result = adapter.parseAgent('zz-planner', input);

    expect(result.name).toBe('zz-planner');
    expect(result.content).toBe('Instructions here.');
    expect(result.metadata.description).toBe('Plans tasks');
    expect(result.metadata['allowed-tools']).toEqual(['Read', 'Write']);
  });

  test('parses agent without allowed tools', () => {
    const input = `# Agent: zz-reviewer\n\n**Role**: Reviews code\n\nReview instructions.\n`;
    const result = adapter.parseAgent('zz-reviewer', input);

    expect(result.name).toBe('zz-reviewer');
    expect(result.content).toBe('Review instructions.');
    expect(result.metadata.description).toBe('Reviews code');
    expect(result.metadata['allowed-tools']).toBeUndefined();
  });
});
