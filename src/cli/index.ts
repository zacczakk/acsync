#!/usr/bin/env bun
import { Command } from 'commander';
import { checkCommand } from './check';
import { pushCommand } from './push';
import { pullCommand } from './pull';
import { renderCommand } from './render';
import { diffCommand } from './diff';

const DESCRIPTION = `Agent Config Sync — single source of truth for AI coding assistant configs.

Manages canonical configs in configs/ and syncs them to 4 CLI targets:
  claude-code  (~/.claude/)
  opencode     (~/.config/opencode/)
  gemini       (~/.gemini/)
  codex        (~/.codex/)

Synced item types:
  commands      Slash commands (markdown with frontmatter)
  agents        Agent/subagent definitions (markdown with frontmatter)
  mcp           MCP server configs (JSON per server)
  instructions  Per-CLI instruction files (CLAUDE.md, OPENCODE.md, etc.)
  skills        Skill bundles (directory with SKILL.md + support files)

Typical workflow:
  acsync check              Show drift between canonical and targets
  acsync diff               Show unified text diff of drifted items
  acsync push --force       Write all canonical configs to targets
  acsync push --delete      Also remove stale items not in canonical
  acsync pull -s claude     Pull configs from Claude Code back to canonical

Exit codes:
  0  Success / no drift
  1  Error
  2  Drift detected (check/diff commands)`;

const program = new Command()
  .name('acsync')
  .description(DESCRIPTION)
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
