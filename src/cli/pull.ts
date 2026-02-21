#!/usr/bin/env bun
import { createInterface } from 'node:readline';
import { Command } from 'commander';
import { runPull, runPullAll } from './sync-pull';
import { validatePullSource } from './cli-helpers';
import type { TargetName } from '../types';

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

export const pullCommand = new Command('pull')
  .description('Pull commands/agents/skills from a target CLI back to canonical format')
  .requiredOption('-s, --source <target>', 'Source target: all, claude, gemini, codex, opencode')
  .option('--pretty', 'Human-readable colored output (default: JSON)')
  .option('--force', 'Overwrite existing canonical items')
  .option('--dry-run', 'Show what would be pulled without writing')
  .action(
    async (options: {
      source: string;
      pretty?: boolean;
      force?: boolean;
      dryRun?: boolean;
    }) => {
      try {
        validatePullSource(options.source);

        const isAll = options.source === 'all';
        const baseOpts = { force: options.force, pretty: options.pretty };

        const doPull = (dryRun?: boolean) => {
          if (isAll) {
            return runPullAll({ ...baseOpts, dryRun });
          }
          const source: TargetName = options.source === 'claude' ? 'claude-code' : options.source as TargetName;
          return runPull({ ...baseOpts, source, dryRun });
        };

        // Dry-run: show plan without writing
        if (options.dryRun) {
          const result = await doPull(true);
          process.stdout.write(result.output + '\n');
          process.exit(0);
        }

        // No force: preview first, then confirm
        if (!options.force) {
          const preview = await doPull(true);
          process.stdout.write(preview.output + '\n');

          if (preview.pulled === 0) {
            process.exit(0);
          }

          const confirmed = await confirm(`Pull ${preview.pulled} item(s)?`);
          if (!confirmed) {
            process.stderr.write('Pull cancelled.\n');
            process.exit(0);
          }
        }

        // Execute pull
        const result = await doPull();
        process.stdout.write(result.output + '\n');
        process.exit(0);
      } catch (err) {
        process.stderr.write(
          `Error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(1);
      }
    },
  );
