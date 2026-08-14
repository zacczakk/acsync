import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { alignOpenCodePluginSdk, parseGlobalOpenCodeVersion, parsePluginIDs, REQUIRED_V2_PLUGIN_IDS, restartAndVerifyOpenCodeV2, updateOpenCodeV2, updateOpenCodeV2Safely, verifyOpenCodeV2Plugins, type CommandRunner } from '../sdk';

describe('OpenCode V2 SDK alignment', () => {
  test('parses the exact global next build', () => {
    expect(parseGlobalOpenCodeVersion('└── @opencode-ai/cli@0.0.0-next-17098')).toBe('0.0.0-next-17098');
  });

  test('aligns the local SDK to the global CLI build', async () => {
    const calls: Array<[string, string[], string | undefined]> = [];
    const runner: CommandRunner = async (command, args, cwd) => {
      calls.push([command, args, cwd]);
      return { stdout: command === 'bun' && args[0] === 'pm' ? '@opencode-ai/cli@0.0.0-next-17098' : '', stderr: '' };
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
      return { stdout: '', stderr: '' };
    };
    expect(await updateOpenCodeV2('/config', runner)).toBe('0.0.0-next-17100');
    expect(calls).toContain('bun install -g --force --trust --minimum-release-age=0 @opencode-ai/cli@next');
  });

  test('restores the exact global CLI build when updated profile activation fails', async () => {
    const calls: string[] = [];
    let listed = 0;
    const runner: CommandRunner = async (command, args) => {
      calls.push(`${command} ${args.join(' ')}`);
      if (args[0] === 'pm') {
        listed += 1;
        return { stdout: `@opencode-ai/cli@0.0.0-next-${listed === 1 ? '17098' : '17102'}`, stderr: '' };
      }
      return { stdout: '', stderr: '' };
    };

    await expect(updateOpenCodeV2Safely('/config', async () => { throw new Error('activation failed'); }, runner)).rejects.toThrow('activation failed');
    expect(calls.at(-1)).toBe('bun install -g --force --trust --minimum-release-age=0 @opencode-ai/cli@0.0.0-next-17098');
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

  test('proves readiness through the API when restart drops its client connection', async () => {
    const ids = [...REQUIRED_V2_PLUGIN_IDS];
    const runner: CommandRunner = async (_command, args) => {
      if (args[0] === 'service') throw new Error('connection closed');
      return { stdout: JSON.stringify({ data: ids.map((id) => ({ id })) }), stderr: '' };
    };
    expect(await restartAndVerifyOpenCodeV2(runner, 1, 0)).toEqual(ids);
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
