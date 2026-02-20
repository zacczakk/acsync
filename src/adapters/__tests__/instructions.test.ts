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
      test('concatenates base + addendum with newline separator', () => {
        const base = '# Base\n\nSome base content.';
        const addendum = '## Addendum\n\nCLI-specific content.';
        const result = adapter.renderInstructions(base, addendum);

        expect(result).toContain('# Base');
        expect(result).toContain('## Addendum');
        expect(result).toContain('Some base content.');
        expect(result).toContain('CLI-specific content.');
      });

      test('base content comes before addendum', () => {
        const base = 'FIRST';
        const addendum = 'SECOND';
        const result = adapter.renderInstructions(base, addendum);

        expect(result.indexOf('FIRST')).toBeLessThan(result.indexOf('SECOND'));
      });

      test('outputs end with newline', () => {
        const result = adapter.renderInstructions('base', 'addendum');
        expect(result.endsWith('\n')).toBe(true);
      });

      test('expands ~ to homedir via expandPaths if called in subclass', () => {
        // renderInstructions itself does not call expandPaths — that's up to the caller
        // Verify the tilde passes through unmodified (expandPaths is a protected helper)
        const base = '# Base\n\n~/some/path';
        const addendum = '~/another/path';
        const result = adapter.renderInstructions(base, addendum);
        // BaseAdapter.renderInstructions does NOT expand paths — it's a raw concatenation
        // expandPaths() is available as a protected helper for subclasses to call explicitly
        expect(result).toContain('~/some/path');
      });

      test('separator is double newline between base and addendum', () => {
        const base = 'BASE_CONTENT';
        const addendum = 'ADDENDUM_CONTENT';
        const result = adapter.renderInstructions(base, addendum);
        expect(result).toContain('BASE_CONTENT\n\nADDENDUM_CONTENT');
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
