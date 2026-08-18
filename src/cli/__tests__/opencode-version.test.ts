import { describe, expect, test } from 'bun:test';
import { opencodeVersionCommand, verificationReporter } from '../opencode-version';

describe('opencode version command', () => {
  test('exposes use, status, and update-v2 commands', () => {
    expect(opencodeVersionCommand.commands.map((command) => command.name())).toEqual(['use', 'status', 'update-v2']);
  });

  test('documents SDK opt-out for isolated switching', () => {
    expect(opencodeVersionCommand.commands.find((command) => command.name() === 'use')?.helpInformation()).toContain('--no-align-sdk');
  });

  test('compacts unchanged plugin retries while surfacing optional gaps', () => {
    const messages: string[] = [];
    const report = verificationReporter((message) => messages.push(message));
    const retry = {
      attempt: 1,
      attempts: 60,
      status: 'retrying' as const,
      missing: ['required-plugin'],
      optionalMissing: ['metronome.muxy-notify'],
      attemptMs: 100,
      elapsedMs: 100,
    };

    report(retry);
    report({ ...retry, attempt: 2, attemptMs: 200, elapsedMs: 200 });
    report({ ...retry, attempt: 10, attemptMs: 300, elapsedMs: 300 });
    report({ ...retry, attempt: 11, status: 'ready', missing: [], attemptMs: 400, elapsedMs: 400 });

    expect(messages).toEqual([
      'Plugin catalog waiting (1/60; 100ms; required missing: required-plugin; optional unavailable: metronome.muxy-notify)',
      'Plugin catalog waiting (10/60; 300ms; required missing: required-plugin; optional unavailable: metronome.muxy-notify)',
      'Plugin catalog ready (11/60; 400ms; optional unavailable: metronome.muxy-notify)',
    ]);
  });
});
