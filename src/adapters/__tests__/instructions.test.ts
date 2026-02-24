import { describe, test, expect } from 'bun:test';
import os from 'node:os';
import { ClaudeCodeAdapter } from '../claude-code';
import { OpenCodeAdapter } from '../opencode';
import { GeminiAdapter } from '../gemini';
import { CodexAdapter } from '../codex';

const adapters = [
  new ClaudeCodeAdapter(),
  new OpenCodeAdapter(),
  new GeminiAdapter(),
  new CodexAdapter(),
];

describe('renderInstructions (all adapters)', () => {
  for (const adapter of adapters) {
    describe(adapter.displayName, () => {
      test('returns content unchanged (identity passthrough)', () => {
        const content = '# Agent OS\n\nBase content.\n\n## CLI-Specific Notes\n\nPer-CLI stuff.\n';
        const result = adapter.renderInstructions(content);
        expect(result).toBe(content);
      });

      test('preserves tildes (expandPaths not called by renderInstructions)', () => {
        const content = '# Base\n\n~/some/path\n';
        const result = adapter.renderInstructions(content);
        expect(result).toContain('~/some/path');
      });
    });
  }
});

describe('expandPaths helper (via ClaudeCodeAdapter)', () => {
  // Expose expandPaths by creating a test subclass
  class TestAdapter extends ClaudeCodeAdapter {
    public testExpandPaths(content: string): string {
      return this.expandPaths(content);
    }
  }

  const testAdapter = new TestAdapter();

  test('converts ~/ to homedir', () => {
    const content = 'Path: ~/.claude/settings.json';
    const result = testAdapter.testExpandPaths(content);
    expect(result).toBe(`Path: ${os.homedir()}/.claude/settings.json`);
  });

  test('converts multiple ~/ occurrences', () => {
    const content = '~/first and ~/second';
    const result = testAdapter.testExpandPaths(content);
    const home = os.homedir();
    expect(result).toBe(`${home}/first and ${home}/second`);
  });

  test('leaves content without ~/ unchanged', () => {
    const content = 'No tilde here';
    expect(testAdapter.testExpandPaths(content)).toBe('No tilde here');
  });
});
