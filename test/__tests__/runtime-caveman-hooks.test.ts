import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestHome } from '../helpers/backup';

type Target = 'codex' | 'claude';

interface HookOutput {
  hookSpecificOutput: {
    hookEventName: string;
    additionalContext: string;
  };
}

interface HookRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface EarlyStdoutResult {
  firstChunk: string;
  reader: ReadableStreamDefaultReader<Uint8Array>;
}

function targetDir(fakeHome: string, target: Target): string {
  return join(fakeHome, target === 'codex' ? '.codex' : '.claude');
}

function statePath(fakeHome: string, target: Target): string {
  return join(targetDir(fakeHome, target), '.caveman-active');
}

function ensureTargetDir(fakeHome: string, target: Target): void {
  mkdirSync(targetDir(fakeHome, target), { recursive: true });
}

function writeState(fakeHome: string, target: Target, mode: 'off' | 'lite' | 'full' | 'ultra'): void {
  ensureTargetDir(fakeHome, target);
  writeFileSync(statePath(fakeHome, target), mode);
}

function readState(fakeHome: string, target: Target): string {
  return readFileSync(statePath(fakeHome, target), 'utf8');
}

function spawnHook(scriptName: string, fakeHome: string): Bun.Subprocess<'pipe', 'pipe', 'pipe'> {
  return Bun.spawn(['node', join(process.cwd(), 'configs/hooks', scriptName)], {
    cwd: process.cwd(),
    env: { ...process.env, HOME: fakeHome },
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

async function readStream(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) {
    return '';
  }

  return await new Response(stream).text();
}

async function runHook(scriptName: string, fakeHome: string, input?: string): Promise<HookRunResult> {
  const proc = spawnHook(scriptName, fakeHome);

  if (input) {
    proc.stdin.write(input);
  }
  proc.stdin.end();

  const [stdout, stderr, exitCode] = await Promise.all([
    readStream(proc.stdout),
    readStream(proc.stderr),
    proc.exited,
  ]);

  return { stdout, stderr, exitCode };
}

function parseHookOutput(stdout: string): HookOutput {
  return JSON.parse(stdout);
}

function expectFilteredHookOutput(stdout: string, eventName: 'SessionStart' | 'UserPromptSubmit'): HookOutput {
  const parsed = parseHookOutput(stdout);

  expect(parsed).toHaveProperty('hookSpecificOutput');
  expect(parsed.hookSpecificOutput).toBeObject();
  expect(parsed.hookSpecificOutput).toHaveProperty('hookEventName');
  expect(parsed.hookSpecificOutput).toHaveProperty('additionalContext');
  expect(parsed.hookSpecificOutput.hookEventName).toBe(eventName);
  expect(typeof parsed.hookSpecificOutput.additionalContext).toBe('string');

  return parsed;
}

async function waitForInitialStdout(proc: Bun.Subprocess<'pipe', 'pipe', 'pipe'>, timeoutMs: number): Promise<EarlyStdoutResult> {
  const stdout = proc.stdout;
  if (!stdout) {
    expect.unreachable('expected stdout pipe');
  }

  const reader = stdout.getReader();
  const settled = await Promise.race([
    reader.read().then((result) => ({ kind: 'read' as const, result })),
    new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs)),
  ]);

  if (settled.kind === 'timeout') {
    reader.releaseLock();
    expect.unreachable(`stdout produced no data within ${timeoutMs}ms`);
  }

  expect(settled.result.done).toBe(false);
  expect(settled.result.value).toBeDefined();

  return {
    firstChunk: new TextDecoder().decode(settled.result.value),
    reader,
  };
}

async function readRemainingFromReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let output = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  reader.releaseLock();
  return output;
}

describe('caveman runtime hooks', () => {
  test('codex SessionStart emits filtered active context immediately when mode is active', async () => {
    const fakeHome = createTestHome('runtime-caveman-codex-sessionstart-active');
    writeState(fakeHome, 'codex', 'lite');

    const proc = spawnHook('caveman-sessionstart-codex.js', fakeHome);
    const { firstChunk, reader } = await waitForInitialStdout(proc, 500);

    proc.stdin.end();

    const stdout = firstChunk + await readRemainingFromReader(reader);
    const parsed = expectFilteredHookOutput(stdout, 'SessionStart');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('CAVEMAN MODE ACTIVE');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('level: lite');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Boundaries:');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Auto Clarity:');
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain('name: caveman');
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain('## Boundaries');

    const [stderr, exitCode] = await Promise.all([readStream(proc.stderr), proc.exited]);
    expect(stderr).toBe('');
    expect(exitCode).toBe(0);
  });

  test('codex SessionStart stays quiet when no active mode resolves to context', async () => {
    const fakeHome = createTestHome('runtime-caveman-codex-sessionstart-off');
    ensureTargetDir(fakeHome, 'codex');
    expect(existsSync(statePath(fakeHome, 'codex'))).toBe(false);

    const result = await runHook('caveman-sessionstart-codex.js', fakeHome);

    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(existsSync(statePath(fakeHome, 'codex'))).toBe(false);
  });

  test('codex UserPromptSubmit activates fallback full mode for bare /caveman', async () => {
    const fakeHome = createTestHome('runtime-caveman-codex-userprompt-default');
    ensureTargetDir(fakeHome, 'codex');

    const result = await runHook(
      'caveman-userprompt-codex.js',
      fakeHome,
      JSON.stringify({ prompt: '/caveman' }),
    );

    const parsed = expectFilteredHookOutput(result.stdout, 'UserPromptSubmit');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('CAVEMAN REMINDER: level=full');
    expect(readState(fakeHome, 'codex')).toBe('full');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });

  test('codex UserPromptSubmit deactivates and suppresses reminder output', async () => {
    const fakeHome = createTestHome('runtime-caveman-codex-userprompt-off');
    writeState(fakeHome, 'codex', 'lite');

    const result = await runHook(
      'caveman-userprompt-codex.js',
      fakeHome,
      JSON.stringify({ userPrompt: '/caveman off' }),
    );

    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(readState(fakeHome, 'codex')).toBe('off');
  });

  test('claude SessionStart emits filtered active context for active mode', async () => {
    const fakeHome = createTestHome('runtime-caveman-claude-sessionstart-active');
    writeState(fakeHome, 'claude', 'ultra');

    const result = await runHook('caveman-sessionstart-claude.js', fakeHome, JSON.stringify({ transcript_path: '/tmp/ignored.jsonl' }));

    const parsed = expectFilteredHookOutput(result.stdout, 'SessionStart');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('CAVEMAN MODE ACTIVE');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('level: ultra');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Level Rules (ultra):');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Examples (ultra):');
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain('name: caveman');
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain('## Boundaries');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });

  test('claude SessionStart stays quiet when no active mode resolves to context', async () => {
    const fakeHome = createTestHome('runtime-caveman-claude-sessionstart-off');
    ensureTargetDir(fakeHome, 'claude');
    expect(existsSync(statePath(fakeHome, 'claude'))).toBe(false);

    const result = await runHook('caveman-sessionstart-claude.js', fakeHome, '{}');

    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(existsSync(statePath(fakeHome, 'claude'))).toBe(false);
  });

  test('claude UserPromptSubmit activates explicit mode and emits reminder', async () => {
    const fakeHome = createTestHome('runtime-caveman-claude-userprompt-explicit');
    ensureTargetDir(fakeHome, 'claude');

    const result = await runHook(
      'caveman-userprompt-claude.js',
      fakeHome,
      JSON.stringify({ userPrompt: '/caveman lite' }),
    );

    const parsed = expectFilteredHookOutput(result.stdout, 'UserPromptSubmit');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('CAVEMAN REMINDER: level=lite');
    expect(readState(fakeHome, 'claude')).toBe('lite');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });

  test('claude UserPromptSubmit deactivates and suppresses reminder output', async () => {
    const fakeHome = createTestHome('runtime-caveman-claude-userprompt-stop');
    writeState(fakeHome, 'claude', 'full');

    const result = await runHook(
      'caveman-userprompt-claude.js',
      fakeHome,
      JSON.stringify({ prompt: '/caveman stop' }),
    );

    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
    expect(existsSync(statePath(fakeHome, 'claude'))).toBe(true);
    expect(readState(fakeHome, 'claude')).toBe('off');
  });
});
