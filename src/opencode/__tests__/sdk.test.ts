import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { alignOpenCodePluginSdk, compareOpenCodeVersions, OPTIONAL_V2_PLUGIN_IDS, parseGlobalOpenCodeVersion, parseOpenCodeExecutableVersion, parsePluginIDs, REQUIRED_V2_PLUGIN_IDS, restartAndVerifyOpenCodeV2, updateOpenCodeV2, updateOpenCodeV2Safely, verifyOpenCodeV2Plugins, type CommandRunner } from '../sdk';

describe('OpenCode V2 SDK alignment', () => {
  test('parses the exact global next build', () => {
    expect(parseGlobalOpenCodeVersion('└── @opencode-ai/cli@0.0.0-next-17098')).toBe('0.0.0-next-17098');
  });

  test('parses the executable build reported by opencode2', () => {
    expect(parseOpenCodeExecutableVersion('opencode2 v0.0.0-beta-17595')).toBe('0.0.0-beta-17595');
  });

  test('compares build numbers before release channels', () => {
    expect(compareOpenCodeVersions('0.0.0-next-17498', '0.0.0-beta-17595')).toBeLessThan(0);
  });

  test('aligns the local SDK to the global CLI build', async () => {
    const calls: Array<[string, string[], string | undefined]> = [];
    const runner: CommandRunner = async (command, args, cwd) => {
      calls.push([command, args, cwd]);
      return {
        stdout: command === 'bun' && args[0] === 'pm'
          ? '@opencode-ai/cli@0.0.0-next-17098'
          : command === 'opencode2' ? 'opencode2 v0.0.0-next-17098' : '',
        stderr: '',
      };
    };
    expect(await alignOpenCodePluginSdk('/config', runner)).toBe('0.0.0-next-17098');
    expect(calls.at(-1)).toEqual(['bun', ['add', '--exact', '--minimum-release-age=0', '@opencode-ai/plugin@0.0.0-next-17098'], '/config']);
  });

  test('skips SDK installation when the exact local package is already aligned', async () => {
    const configDir = await mkdtemp(join(tmpdir(), 'metronome-opencode-sdk-'));
    try {
      await mkdir(join(configDir, 'node_modules', '@opencode-ai', 'plugin'), { recursive: true });
      await writeFile(join(configDir, 'package.json'), JSON.stringify({ dependencies: { '@opencode-ai/plugin': '0.0.0-next-17098' } }));
      await writeFile(join(configDir, 'node_modules', '@opencode-ai', 'plugin', 'package.json'), JSON.stringify({ version: '0.0.0-next-17098' }));
      const calls: string[] = [];
      const runner: CommandRunner = async (command, args) => {
        calls.push(`${command} ${args.join(' ')}`);
        return { stdout: '@opencode-ai/cli@0.0.0-next-17098', stderr: '' };
      };

      expect(await alignOpenCodePluginSdk(configDir, runner)).toBe('0.0.0-next-17098');
      expect(calls).toEqual(['bun pm ls -g']);
    } finally {
      await rm(configDir, { recursive: true, force: true });
    }
  });

  test('updates the global CLI and returns its resolved build', async () => {
    const calls: string[] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push(`${command} ${args.join(' ')}`);
      if (args[0] === 'pm') return { stdout: '@opencode-ai/cli@0.0.0-next-17100', stderr: '' };
      if (command === 'opencode2') return { stdout: 'opencode2 v0.0.0-next-17100', stderr: '' };
      return { stdout: '', stderr: '' };
    };
    expect(await updateOpenCodeV2('/config', runner)).toBe('0.0.0-next-17100');
    expect(calls).toContain('bun install -g --force --trust --minimum-release-age=0 @opencode-ai/cli@next');
  });

  test('repairs a launcher that disagrees with the installed package', async () => {
    const calls: string[] = [];
    let packageVersion = '0.0.0-next-17098';
    let executable = '0.0.0-next-17098';
    const runner: CommandRunner = async (command, args) => {
      calls.push(`${command} ${args.join(' ')}`);
      if (args[0] === 'pm') return { stdout: `@opencode-ai/cli@${packageVersion}`, stderr: '' };
      if (command === 'opencode2') return { stdout: `opencode2 v${executable}`, stderr: '' };
      if (command === 'bun' && args[0] === 'install') {
        packageVersion = '0.0.0-next-17100';
        if (args.at(-1)?.includes('17100')) executable = packageVersion;
      }
      return { stdout: '', stderr: '' };
    };

    expect(await updateOpenCodeV2('/config', runner)).toBe('0.0.0-next-17100');
    expect(calls).toContain('bun remove -g @opencode-ai/cli');
    expect(calls).toContain('bun install -g --force --trust --minimum-release-age=0 @opencode-ai/cli@0.0.0-next-17100');
  });

  test('reports update and activation stages', async () => {
    const progress: string[] = [];
    const runner: CommandRunner = async (command, args) => ({
      stdout: args[0] === 'pm'
        ? '@opencode-ai/cli@0.0.0-next-17100'
        : command === 'opencode2' ? 'opencode2 v0.0.0-next-17100' : '',
      stderr: '',
    });

    await updateOpenCodeV2Safely('/config', async () => undefined, runner, (message) => progress.push(message));

    expect(progress[0]).toBe('Resolve current global CLI...');
    expect(progress.some((message) => message === 'Install @opencode-ai/cli@next...')).toBe(true);
    expect(progress.some((message) => message === 'Activate OpenCode V2 at 0.0.0-next-17100...')).toBe(true);
    expect(progress.some((message) => message.startsWith('Activate OpenCode V2 at 0.0.0-next-17100 done'))).toBe(true);
  });

  test('restores the exact global CLI build when updated profile activation fails', async () => {
    const calls: string[] = [];
    const progress: string[] = [];
    let packageVersion = '0.0.0-next-17098';
    let executable = '0.0.0-next-17098';
    const runner: CommandRunner = async (command, args) => {
      calls.push(`${command} ${args.join(' ')}`);
      if (args[0] === 'pm') {
        return { stdout: `@opencode-ai/cli@${packageVersion}`, stderr: '' };
      }
      if (command === 'opencode2') return { stdout: `opencode2 v${executable}`, stderr: '' };
      if (command === 'bun' && args[0] === 'install') {
        packageVersion = args.at(-1)?.includes('17102') ? '0.0.0-next-17102' : '0.0.0-next-17098';
        executable = packageVersion;
      }
      return { stdout: '', stderr: '' };
    };

    await expect(updateOpenCodeV2Safely('/config', async () => { throw new Error('activation failed'); }, runner, (message) => progress.push(message))).rejects.toThrow('activation failed');
    expect(calls).toContain('bun install -g --force --trust --minimum-release-age=0 @opencode-ai/cli@0.0.0-next-17098');
    expect(progress.some((message) => message === 'Restore global CLI 0.0.0-next-17098...')).toBe(true);
  });

  test('keeps the current build when the next channel returns an older build', async () => {
    const calls: string[] = [];
    let packageVersion = '0.0.0-beta-17595';
    let executable = '0.0.0-beta-17595';
    const activated: string[] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push(`${command} ${args.join(' ')}`);
      if (args[0] === 'pm') {
        return { stdout: `@opencode-ai/cli@${packageVersion}`, stderr: '' };
      }
      if (command === 'opencode2') return { stdout: `opencode2 v${executable}`, stderr: '' };
      if (command === 'bun' && args[0] === 'install') {
        packageVersion = args.at(-1)?.includes('next') ? '0.0.0-beta-17498' : '0.0.0-beta-17595';
        executable = packageVersion;
      }
      return { stdout: '', stderr: '' };
    };

    expect(await updateOpenCodeV2Safely('/config', async (version) => { activated.push(version); }, runner)).toBe('0.0.0-beta-17595');
    expect(activated).toEqual(['0.0.0-beta-17595']);
    expect(calls).toContain('bun install -g --force --trust --minimum-release-age=0 @opencode-ai/cli@0.0.0-beta-17595');
  });

  test('rejects a parseable response missing required plugins', async () => {
    const runner: CommandRunner = async (_command, args) => ({
      stdout: args.at(-1) === '/api/plugin' ? '[]' : '',
      stderr: '',
    });
    expect(restartAndVerifyOpenCodeV2(runner, 1, 0)).rejects.toThrow('did not activate required plugins');
  });

  test('accepts all required plugin IDs from the API envelope', async () => {
    const ids = [...REQUIRED_V2_PLUGIN_IDS];
    const runner: CommandRunner = async (_command, args) => ({ stdout: args.at(-1) === '/api/plugin' ? JSON.stringify({ data: ids.map((id) => ({ id })) }) : '', stderr: '' });
    expect(await restartAndVerifyOpenCodeV2(runner)).toEqual(ids);
    expect(parsePluginIDs(JSON.stringify(ids.map((id) => ({ id }))))).toEqual(ids);
  });

  test('does not fail readiness when the optional Muxy plugin is absent', async () => {
    const ids = [...REQUIRED_V2_PLUGIN_IDS];
    const progress: Array<{ status: string; missing: string[]; optionalMissing: string[] }> = [];
    const runner: CommandRunner = async (_command, args) => ({
      stdout: args.at(-1) === '/api/plugin' ? JSON.stringify({ data: ids.map((id) => ({ id })) }) : '',
      stderr: '',
    });

    expect(await verifyOpenCodeV2Plugins(runner, 1, 0, (event) => progress.push({
      status: event.status,
      missing: event.missing,
      optionalMissing: event.optionalMissing,
    }))).toEqual(ids);
    expect(progress).toEqual([{
      status: 'ready',
      missing: [],
      optionalMissing: OPTIONAL_V2_PLUGIN_IDS,
    }]);
  });

  test('proves readiness through the API when restart drops its client connection', async () => {
    const ids = [...REQUIRED_V2_PLUGIN_IDS];
    const runner: CommandRunner = async (_command, args) => {
      if (args[0] === 'service') throw new Error('connection closed');
      return { stdout: JSON.stringify({ data: ids.map((id) => ({ id })) }), stderr: '' };
    };
    expect(await restartAndVerifyOpenCodeV2(runner, 1, 0)).toEqual(ids);
  });

  test('reports the service restart stage before readiness checks', async () => {
    const ids = [...REQUIRED_V2_PLUGIN_IDS];
    const progress: string[] = [];
    const runner: CommandRunner = async (_command, args) => ({
      stdout: args.at(-1) === '/api/plugin' ? JSON.stringify({ data: ids.map((id) => ({ id })) }) : '',
      stderr: '',
    });

    await restartAndVerifyOpenCodeV2(runner, 1, 0, undefined, (message) => progress.push(message));

    expect(progress[0]).toBe('Restart OpenCode V2 service...');
    expect(progress[1]).toMatch(/^Restart OpenCode V2 service done \(\d+(\.\d+)?(ms|s)\)$/);
  });

  test('verifies a hot-reloaded profile without restarting the service', async () => {
    const ids = [...REQUIRED_V2_PLUGIN_IDS];
    const calls: string[] = [];
    const runner: CommandRunner = async (command, args) => {
      calls.push(`${command} ${args.join(' ')}`);
      return { stdout: JSON.stringify({ data: ids.map((id) => ({ id })) }), stderr: '' };
    };
    expect(await verifyOpenCodeV2Plugins(runner, 1, 0)).toEqual(ids);
    expect(calls).toEqual(['opencode2 api get /api/plugin']);
  });

  test('waits through a partial plugin catalog during service readiness', async () => {
    const ids = [...REQUIRED_V2_PLUGIN_IDS];
    let calls = 0;
    const progress: Array<{ attempt: number; status: string; missing: string[] }> = [];
    const runner: CommandRunner = async (_command, args) => {
      calls += 1;
      return {
        stdout: args.at(-1) === '/api/plugin'
          ? JSON.stringify({ data: (calls < 3 ? ids.slice(0, -1) : ids).map((id) => ({ id })) })
          : '',
        stderr: '',
      };
    };
    expect(await verifyOpenCodeV2Plugins(runner, 3, 0, (event) => progress.push({ attempt: event.attempt, status: event.status, missing: event.missing }))).toEqual(ids);
    expect(calls).toBe(3);
    expect(progress).toEqual([
      { attempt: 1, status: 'retrying', missing: ['opencode.chatgpt-websearch'] },
      { attempt: 2, status: 'retrying', missing: ['opencode.chatgpt-websearch'] },
      { attempt: 3, status: 'ready', missing: [] },
    ]);
  });
});
