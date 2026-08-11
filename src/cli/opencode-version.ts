import { homedir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { PROJECT_ROOT } from './canonical';
import { getOpenCodeVersionStatus, switchOpenCodeVersion } from '../opencode/profile';
import { alignOpenCodePluginSdk, restartAndVerifyOpenCodeV2, runCommand, updateOpenCodeV2Safely, verifyOpenCodeV2Plugins } from '../opencode/sdk';
import type { OpenCodeVersion } from '../opencode/version-renderer';

function version(value: string): OpenCodeVersion {
  if (value !== 'v1' && value !== 'v2') throw new Error('Version must be v1 or v2');
  return value;
}

export const opencodeVersionCommand = new Command('opencode')
  .description('Switch and maintain OpenCode V1/V2 compatibility profiles');

opencodeVersionCommand.command('use')
  .argument('<version>', 'v1 or v2')
  .option('--dry-run', 'Show paths without writing')
  .option('--no-align-sdk', 'Do not align the local V2 plugin SDK')
  .description('Atomically activate a rendered OpenCode compatibility profile')
  .action(async (rawVersion: string, options: { dryRun?: boolean; alignSdk?: boolean }) => {
    try {
      const selected = version(rawVersion);
      const homeDir = homedir();
      const result = await switchOpenCodeVersion({
        version: selected,
        projectDir: PROJECT_ROOT,
        homeDir,
        dryRun: options.dryRun,
        prepare: selected === 'v2' && options.alignSdk !== false && !options.dryRun
          ? async () => { process.stdout.write(`Aligned @opencode-ai/plugin to ${await alignOpenCodePluginSdk(join(homeDir, '.config', 'opencode'))}\n`); }
          : undefined,
        rollback: selected === 'v2' && options.alignSdk !== false && !options.dryRun
          ? () => runCommand('bun', ['install', '--frozen-lockfile'], join(homeDir, '.config', 'opencode')).then(() => undefined)
          : undefined,
        verifyPlugins: selected === 'v2' && !options.dryRun ? () => verifyOpenCodeV2Plugins() : undefined,
      });
      process.stdout.write(`${options.dryRun ? 'Would activate' : 'Activated'} OpenCode ${selected.toUpperCase()}\n`);
      process.stdout.write(`Backup: ${result.backupPath}\nManifest: ${result.manifestPath}\n`);
    } catch (error) {
      process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });

opencodeVersionCommand.command('status')
  .description('Show the active Metronome OpenCode profile and latest switch')
  .action(async () => {
    const status = await getOpenCodeVersionStatus(homedir());
    if (!status) {
      process.stdout.write('OpenCode profile: unmanaged\n');
      return;
    }
    const latest = status.history.at(-1);
    process.stdout.write(`OpenCode profile: ${status.active.toUpperCase()}\n`);
    if (latest) process.stdout.write(`Last switch: ${latest.timestamp}\nBackup: ${latest.backup}\n`);
  });

opencodeVersionCommand.command('update-v2')
  .description('Update the Bun-installed V2 CLI, align the local SDK, restart, and verify plugins')
  .action(async () => {
    try {
      const homeDir = homedir();
      const configDir = join(homeDir, '.config', 'opencode');
      const resolved = await updateOpenCodeV2Safely(configDir, async () => {
        await switchOpenCodeVersion({
          version: 'v2',
          projectDir: PROJECT_ROOT,
          homeDir,
          prepare: () => alignOpenCodePluginSdk(configDir).then(() => undefined),
          rollback: () => runCommand('bun', ['install', '--frozen-lockfile'], configDir).then(() => undefined),
          verifyPlugins: () => restartAndVerifyOpenCodeV2(),
        });
      });
      process.stdout.write(`OpenCode V2 and @opencode-ai/plugin aligned at ${resolved}\n`);
    } catch (error) {
      process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });
