import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import { atomicWrite } from '../infra/atomic-write';
import { hashContent, PROJECT_ROOT } from './canonical';
import { confirm } from './cli-helpers';

const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');

interface HelperFile {
  name: string;
  sourcePath: string;
  content: string;
}

interface HelperOp {
  name: string;
  action: 'create' | 'update' | 'skip';
  sourcePath: string;
  targetPath: string;
}

export interface HelpersResult {
  written: number;
  skipped: number;
  output: string;
}

async function readHelpers(): Promise<HelperFile[]> {
  const entries = await readdir(SCRIPTS_DIR);
  const helpers: HelperFile[] = [];
  for (const entry of entries) {
    const sourcePath = join(SCRIPTS_DIR, entry);
    const info = await stat(sourcePath);
    if (!info.isFile()) continue;
    const content = await readFile(sourcePath, 'utf-8');
    helpers.push({ name: entry, sourcePath, content });
  }
  return helpers;
}

async function planOps(helpers: HelperFile[], targetDir: string): Promise<HelperOp[]> {
  const ops: HelperOp[] = [];
  for (const helper of helpers) {
    const targetPath = join(targetDir, helper.name);
    let action: HelperOp['action'] = 'create';
    try {
      const existing = await readFile(targetPath, 'utf-8');
      if (hashContent(existing) === hashContent(helper.content)) {
        action = 'skip';
      } else {
        action = 'update';
      }
    } catch {
      // file doesn't exist
    }
    ops.push({ name: helper.name, action, sourcePath: helper.sourcePath, targetPath });
  }
  return ops;
}

function formatPlan(ops: HelperOp[], targetDir: string, pretty: boolean): string {
  if (!pretty) {
    return JSON.stringify({
      target: targetDir,
      actions: ops.map((op) => ({ name: op.name, action: op.action, path: op.targetPath })),
    }, null, 2) + '\n';
  }

  const lines: string[] = ['', `acsync helpers -> ${targetDir}`, ''];
  for (const op of ops) {
    if (op.action === 'create') {
      lines.push(`  ${pc.green('+')} ${op.name.padEnd(30)} ${pc.dim('(new)')}`);
    } else if (op.action === 'update') {
      lines.push(`  ${pc.yellow('~')} ${op.name.padEnd(30)} ${pc.dim('(modified)')}`);
    } else {
      lines.push(`  ${pc.dim('✓')} ${pc.dim(op.name.padEnd(30))} ${pc.dim('(up to date)')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function formatResult(ops: HelperOp[], pretty: boolean): string {
  const written = ops.filter((op) => op.action !== 'skip');
  if (!pretty) {
    return JSON.stringify({ written: written.length, skipped: ops.length - written.length }, null, 2) + '\n';
  }
  if (written.length === 0) {
    return `  ${pc.dim('All helpers up to date.')}\n`;
  }
  return `  ${pc.green(`${written.length} helper(s) written.`)}\n`;
}

export async function runHelpers(targetRoot: string, options: { dryRun?: boolean; force?: boolean; json?: boolean }): Promise<HelpersResult> {
  const targetDir = join(resolve(targetRoot), 'scripts');
  const pretty = !options.json;
  const helpers = await readHelpers();
  const ops = await planOps(helpers, targetDir);

  const writeOps = ops.filter((op) => op.action !== 'skip');

  if (writeOps.length === 0) {
    const output = formatPlan(ops, targetDir, pretty);
    return { written: 0, skipped: ops.length, output };
  }

  if (options.dryRun) {
    return { written: 0, skipped: ops.length, output: formatPlan(ops, targetDir, pretty) };
  }

  if (!options.force) {
    process.stdout.write(formatPlan(ops, targetDir, pretty));
    const ok = await confirm('Write helpers?');
    if (!ok) {
      process.stderr.write('Cancelled.\n');
      return { written: 0, skipped: ops.length, output: '' };
    }
  }

  for (const op of writeOps) {
    const helper = helpers.find((h) => h.name === op.name)!;
    await atomicWrite(op.targetPath, helper.content);
  }

  const output = formatResult(ops, pretty);
  return { written: writeOps.length, skipped: ops.length - writeOps.length, output };
}

export const helpersCommand = new Command('helpers')
  .description(
    `Copy canonical helper scripts to a target repo's scripts/ directory.

Reads all files from the acsync scripts/ directory and writes them to
<target>/scripts/, using atomic writes. Skips files already up to date
(SHA-256 match). Prompts before writing unless --force is set.

Examples:
  acsync helpers -p ~/Repos/my-project
  acsync helpers --path . --force
  acsync helpers -p ~/Repos/my-project --dry-run`)
  .requiredOption('-p, --path <path>', 'Repo root path to write helpers into')
  .option('--dry-run', 'Show plan without writing')
  .option('--force', 'Skip confirmation prompt')
  .option('--json', 'Machine-readable JSON output')
  .action(async (options: { path: string; dryRun?: boolean; force?: boolean; json?: boolean }) => {
    try {
      const result = await runHelpers(options.path, options);
      if (result.output) process.stdout.write(result.output);
      process.exit(0);
    } catch (err) {
      process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  });
