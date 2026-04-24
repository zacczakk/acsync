import { describe, expect, test } from 'bun:test';
import { readFileSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { createAdapter } from '../../src/cli/canonical';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');
const SEEDS_ROOT = join(FIXTURE_ROOT, 'seeds');

function seedCodexTarget(fakeHome: string): void {
  const adapter = createAdapter('codex', fakeHome);
  const settingsPath = adapter.getPaths().getSettingsPath();
  mkdirSync(dirname(settingsPath), { recursive: true });
  cpSync(join(SEEDS_ROOT, 'codex/config.toml'), settingsPath);
}

async function readStdout(proc: Bun.Subprocess<'pipe', 'pipe', 'inherit'>): Promise<string> {
  return await new Response(proc.stdout).text();
}

describe('push codex hooks E2E', () => {
  test('pushes codex settings and hook config matching goldens', async () => {
    const fakeHome = createTestHome('push-codex-hooks');
    const projectDir = createTestProject('push-codex-hooks', FIXTURE_ROOT);
    seedCodexTarget(fakeHome);

    const result = await runPush({ projectDir, force: true, targets: ['codex'], types: ['settings', 'hook'], homeDir: fakeHome });

    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);
    expect(result.written).toBe(2);

    const adapter = createAdapter('codex', fakeHome);
    const settingsActual = readFileSync(adapter.getPaths().getSettingsPath(), 'utf-8');
    const hooksActual = readFileSync(adapter.getPaths().getHooksPath(), 'utf-8');

    const settingsGolden = readFileSync(join(FIXTURE_ROOT, 'codex/settings/config.toml'), 'utf-8');
    const hooksGolden = readFileSync(join(FIXTURE_ROOT, 'codex/hooks/hooks.json'), 'utf-8');

    expect(settingsActual.trimEnd()).toBe(settingsGolden.trimEnd());
    expect(hooksActual.trimEnd()).toBe(hooksGolden.trimEnd());

    const hooksParsed = JSON.parse(hooksActual) as {
      hooks: {
        SessionStart: Array<{
          matcher: string;
          hooks: Array<{ type: string; command: string }>;
        }>;
        UserPromptSubmit: Array<{
          matcher: string;
          hooks: Array<{ type: string; command: string }>;
        }>;
      };
    };

    expect(Object.keys(hooksParsed.hooks)).toEqual(['SessionStart', 'UserPromptSubmit']);
    expect(hooksParsed.hooks.SessionStart).toHaveLength(1);
    expect(hooksParsed.hooks.SessionStart[0]).toEqual({
      matcher: 'startup|resume',
      hooks: [
        {
          type: 'command',
          command: 'node "$HOME/Repos/zacczakk/metronome/configs/hooks/vault-context-loader-codex.js"',
        },
        {
          type: 'command',
          command: 'node "$HOME/Repos/zacczakk/metronome/configs/hooks/caveman-sessionstart-codex.js"',
        },
      ],
    });
    expect(hooksParsed.hooks.UserPromptSubmit).toHaveLength(1);
    expect(hooksParsed.hooks.UserPromptSubmit[0]).toEqual({
      matcher: '.*',
      hooks: [
        {
          type: 'command',
          command: 'node "$HOME/Repos/zacczakk/metronome/configs/hooks/caveman-userprompt-codex.js"',
        },
      ],
    });

    const result2 = await runPush({ projectDir, force: true, targets: ['codex'], types: ['settings', 'hook'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  });

  test('session start hook emits active context without waiting for stdin end', async () => {
    const fakeHome = createTestHome('codex-sessionstart-hook');
    mkdirSync(join(fakeHome, '.codex'), { recursive: true });
    writeFileSync(join(fakeHome, '.codex', '.caveman-active'), 'lite');

    const proc = Bun.spawn(['node', join(process.cwd(), 'configs/hooks/caveman-sessionstart-codex.js')], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: fakeHome },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'inherit',
    });

    const stdoutPromise = readStdout(proc);
    const settled = await Promise.race([
      stdoutPromise.then((stdout) => ({ kind: 'stdout' as const, stdout })),
      new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), 500)),
    ]);

    if (settled.kind === 'timeout') {
      proc.kill();
      expect.unreachable('session start hook waited for stdin end');
    }

    expect(settled.stdout).toContain('SessionStart');
    expect(settled.stdout).toContain('CAVEMAN MODE ACTIVE');

    proc.stdin.end();
    await proc.exited;
  });
});
