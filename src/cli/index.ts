#!/usr/bin/env bun
import { Command } from 'commander';
import { checkCommand } from './check';
import { pushCommand } from './push';
import { pullCommand } from './pull';
import { renderCommand } from './render';
import { diffCommand } from './diff';

const program = new Command()
  .name('acsync')
  .description('Agent Config Sync — render, diff, and push canonical configs to CLI targets')
  .version('1.0.0');

program.addCommand(checkCommand);
program.addCommand(pushCommand);
program.addCommand(pullCommand);
program.addCommand(renderCommand);
program.addCommand(diffCommand);

// Allow proper exit codes from subcommands (don't let Commander swallow process.exit)
program.exitOverride();

export { program };

// Entry point: only parse args when run directly
if (import.meta.main) {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // exitOverride throws on --help/--version; that's fine
    if (err && typeof err === 'object' && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'commander.helpDisplayed' || code === 'commander.version') {
        process.exit(0);
      }
    }
    process.exit(1);
  }
}
