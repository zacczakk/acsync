import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runPush } from '../../src/cli/push';

const REMINDER_PREFIX = 'CAVEMAN REMINDER: level=';

type PromptPart = { type: string; text: string };

async function installPlugin(homeDir: string) {
  await runPush({
    projectDir: process.cwd(),
    force: true,
    targets: ['opencode'],
    types: ['plugin'],
    homeDir,
  });

}

type CommandInvocation = {
  kind: 'command';
  command: string;
  args: string;
  sessionID: string;
};

type EventInvocation = {
  kind: 'event';
  event: { type: string; properties?: unknown };
};

type Invocation = CommandInvocation | EventInvocation;

type PluginRunResult = {
  prompts: Array<{ path: { id: string }; body: { noReply: boolean; parts: PromptPart[] } }>;
  output: { parts: PromptPart[] };
};

function runPluginInvocations(
  homeDir: string,
  invocations: Invocation[],
  configPath?: string,
): PluginRunResult {
  const runnerPath = path.join(homeDir, 'run-caveman-plugin.mjs');
  const pluginPath = pathToFileURL(path.join(homeDir, '.config', 'opencode', 'plugins', 'caveman-opencode.ts')).href;

  const invocationLines = invocations.map((inv) => {
    if (inv.kind === 'command') {
      return `await plugin["command.execute.before"]?.(${JSON.stringify({
        command: inv.command,
        arguments: inv.args,
        sessionID: inv.sessionID,
      })}, output);`;
    }
    return `await plugin.event?.(${JSON.stringify({ event: inv.event })});`;
  });

  writeFileSync(
    runnerPath,
    [
      `const mod = await import(${JSON.stringify(`${pluginPath}?t=${Date.now()}-${Math.random()}`)});`,
      'const prompts = [];',
      'const output = { parts: [] };',
      'const plugin = await mod.CavemanOpenCodePlugin({',
      '  client: {',
      '    session: {',
      '      prompt: async (payload) => {',
      '        prompts.push(payload);',
      '      },',
      '    },',
      '  },',
      '});',
      ...invocationLines,
      'process.stdout.write(JSON.stringify({ prompts, output }));',
    ].join('\n'),
  );

  const proc = Bun.spawnSync(['bun', runnerPath], {
    env: {
      ...process.env,
      HOME: homeDir,
      METRONOME_REPO_ROOT: process.cwd(),
      ...(configPath ? { METRONOME_CAVEMAN_CONFIG_PATH: configPath } : {}),
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode !== 0) {
    throw new Error(Buffer.from(proc.stderr).toString('utf8'));
  }

  return JSON.parse(Buffer.from(proc.stdout).toString('utf8')) as PluginRunResult;
}

function runInstalledPlugin(homeDir: string, command: string, args: string, sessionID: string, configPath?: string) {
  return runPluginInvocations(homeDir, [{ kind: 'command', command, args, sessionID }], configPath);
}

function runStartupEvent(
  homeDir: string,
  sessionID: string,
  parentID?: string | null,
  configPath?: string,
) {
  return runPluginInvocations(
    homeDir,
    [
      {
        kind: 'event',
        event: {
          type: 'session.created',
          properties: { info: { id: sessionID, parentID: parentID ?? null } },
        },
      },
    ],
    configPath,
  );
}

function writeTempCavemanConfig(homeDir: string, mode: 'lite' | 'full' | 'ultra') {
  const configPath = path.join(homeDir, 'caveman.json');
  const next = JSON.stringify({
    defaultMode: mode,
    targets: ['opencode', 'claude-code', 'codex'],
    naturalLanguageActivation: false,
  }, null, 2) + '\n';

  writeFileSync(configPath, next);
  return configPath;
}

describe('OpenCode caveman plugin runtime', () => {
  test('activates explicit mode, persists state, and injects reinforcement prompt', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'opencode-caveman-plugin-'));
    mkdirSync(path.join(homeDir, '.config', 'opencode'), { recursive: true });
    const prompts: Array<{ path: { id: string }; body: { noReply: boolean; parts: PromptPart[] } }> = [];

    await installPlugin(homeDir);
    const { prompts: runtimePrompts, output } = runInstalledPlugin(homeDir, 'caveman', 'lite', 'session-1');
    prompts.push(...runtimePrompts);

    const statePath = path.join(homeDir, '.config', 'opencode', '.caveman-active');
    expect(readFileSync(statePath, 'utf8')).toBe('lite');
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toEqual({
      path: { id: 'session-1' },
      body: {
        noReply: true,
        parts: [{ type: 'text', text: `${REMINDER_PREFIX}lite. Compressed reply style active. Use normal clarity for safety, destructive actions, multi-step ambiguity, or explicit clarification requests.` }],
      },
    });
    expect(output.parts).toEqual([{ type: 'text', text: `${REMINDER_PREFIX}lite. Compressed reply style active. Use normal clarity for safety, destructive actions, multi-step ambiguity, or explicit clarification requests.` }]);
  });

  test('uses full for bare activation when default mode is off', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'opencode-caveman-plugin-bare-'));
    mkdirSync(path.join(homeDir, '.config', 'opencode'), { recursive: true });

    await installPlugin(homeDir);
    runInstalledPlugin(homeDir, 'caveman', '', 'session-2');

    const statePath = path.join(homeDir, '.config', 'opencode', '.caveman-active');
    expect(readFileSync(statePath, 'utf8')).toBe('full');
  });

  test('uses configured non-off default mode for bare activation', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'opencode-caveman-plugin-configured-'));
    mkdirSync(path.join(homeDir, '.config', 'opencode'), { recursive: true });
    const configPath = writeTempCavemanConfig(homeDir, 'lite');

    await installPlugin(homeDir);
    const { prompts, output } = runInstalledPlugin(homeDir, 'caveman', '', 'session-4', configPath);

    const statePath = path.join(homeDir, '.config', 'opencode', '.caveman-active');
    expect(readFileSync(statePath, 'utf8')).toBe('lite');
    expect(prompts).toHaveLength(1);
    expect(output.parts).toEqual([{ type: 'text', text: `${REMINDER_PREFIX}lite. Compressed reply style active. Use normal clarity for safety, destructive actions, multi-step ambiguity, or explicit clarification requests.` }]);
  });

  test('turns mode off without prompt injection for off or stop', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'opencode-caveman-plugin-off-'));
    mkdirSync(path.join(homeDir, '.config', 'opencode'), { recursive: true });
    const prompts: unknown[] = [];

    await installPlugin(homeDir);
    prompts.push(...runInstalledPlugin(homeDir, 'caveman', 'ultra', 'session-3').prompts);
    prompts.push(...runInstalledPlugin(homeDir, 'caveman', 'stop', 'session-3').prompts);

    const statePath = path.join(homeDir, '.config', 'opencode', '.caveman-active');
    expect(readFileSync(statePath, 'utf8')).toBe('off');
    expect(prompts).toHaveLength(1);
  });

  test('startup session.created restores persisted active mode and injects reminder', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'opencode-caveman-plugin-startup-active-'));
    mkdirSync(path.join(homeDir, '.config', 'opencode'), { recursive: true });

    await installPlugin(homeDir);
    runInstalledPlugin(homeDir, 'caveman', 'ultra', 'prev-session');

    const { prompts } = runStartupEvent(homeDir, 'fresh-session');

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toEqual({
      path: { id: 'fresh-session' },
      body: {
        noReply: true,
        parts: [{ type: 'text', text: `${REMINDER_PREFIX}ultra. Compressed reply style active. Use normal clarity for safety, destructive actions, multi-step ambiguity, or explicit clarification requests.` }],
      },
    });
  });

  test('startup session.created uses configured default mode when no persisted state', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'opencode-caveman-plugin-startup-default-'));
    mkdirSync(path.join(homeDir, '.config', 'opencode'), { recursive: true });
    const configPath = writeTempCavemanConfig(homeDir, 'lite');

    await installPlugin(homeDir);
    const { prompts } = runStartupEvent(homeDir, 'fresh-session', null, configPath);

    expect(prompts).toHaveLength(1);
    expect(prompts[0].body.parts[0].text).toBe(`${REMINDER_PREFIX}lite. Compressed reply style active. Use normal clarity for safety, destructive actions, multi-step ambiguity, or explicit clarification requests.`);
  });

  test('startup session.created stays silent when state is off and default is off', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'opencode-caveman-plugin-startup-off-'));
    mkdirSync(path.join(homeDir, '.config', 'opencode'), { recursive: true });

    await installPlugin(homeDir);
    const { prompts } = runStartupEvent(homeDir, 'fresh-session');

    expect(prompts).toHaveLength(0);
  });

  test('startup session.created ignores child sessions (parentID set)', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'opencode-caveman-plugin-startup-child-'));
    mkdirSync(path.join(homeDir, '.config', 'opencode'), { recursive: true });

    await installPlugin(homeDir);
    runInstalledPlugin(homeDir, 'caveman', 'full', 'prev-session');

    const { prompts } = runStartupEvent(homeDir, 'child-session', 'parent-session');

    expect(prompts).toHaveLength(0);
  });
});
