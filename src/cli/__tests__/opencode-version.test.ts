import { describe, expect, test } from 'bun:test';
import { opencodeVersionCommand } from '../opencode-version';

describe('opencode version command', () => {
  test('exposes use, status, and update-v2 commands', () => {
    expect(opencodeVersionCommand.commands.map((command) => command.name())).toEqual(['use', 'status', 'update-v2']);
  });

  test('documents SDK opt-out for isolated switching', () => {
    expect(opencodeVersionCommand.commands.find((command) => command.name() === 'use')?.helpInformation()).toContain('--no-align-sdk');
  });
});
