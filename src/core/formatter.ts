import pc from 'picocolors';
import type { DiffResult, MCPWarning, Operation, TargetName } from '../types';

export interface PushTargetResult {
  target: TargetName;
  operations: Operation[];
  success: boolean;
  error?: string;
}

export interface CheckResult {
  output: string;
  hasDrift: boolean;
}

/** Map internal TargetName to user-facing display name */
function displayTarget(target: TargetName): string {
  return target === 'claude-code' ? 'claude' : target;
}

export function formatDiffJson(results: DiffResult[]): string {
  const targets: Record<
    string,
    { create: number; update: number; skip: number; operations: Operation[]; mcpWarning?: MCPWarning }
  > = {};

  let totalCreate = 0;
  let totalUpdate = 0;
  let totalSkip = 0;

  for (const result of results) {
    const entry: (typeof targets)[string] = {
      create: result.summary.create,
      update: result.summary.update,
      skip: result.summary.skip,
      operations: result.operations,
    };
    if (result.mcpWarning) entry.mcpWarning = result.mcpWarning;
    targets[displayTarget(result.target)] = entry;
    totalCreate += result.summary.create;
    totalUpdate += result.summary.update;
    totalSkip += result.summary.skip;
  }

  return (
    JSON.stringify(
      {
        targets,
        summary: { totalCreate, totalUpdate, totalSkip },
      },
      null,
      2,
    ) + '\n'
  );
}

export function formatDiffPretty(results: DiffResult[]): string {
  const lines: string[] = ['', 'acsync check', ''];

  let totalCreate = 0;
  let totalUpdate = 0;
  let totalSkip = 0;

  for (const result of results) {
    lines.push(`  ${pc.bold(displayTarget(result.target))}`);

    const creates = result.operations.filter((op) => op.type === 'create');
    const updates = result.operations.filter((op) => op.type === 'update');
    const skips = result.operations.filter((op) => op.type === 'skip');

    for (const op of creates) {
      const label = `[${op.itemType}]`.padEnd(14);
      lines.push(`    ${pc.green('+')} ${label} ${op.name.padEnd(30)} ${pc.dim('(new)')}`);
    }
    for (const op of updates) {
      const label = `[${op.itemType}]`.padEnd(14);
      lines.push(
        `    ${pc.yellow('~')} ${label} ${op.name.padEnd(30)} ${pc.dim('(modified)')}`,
      );
    }
    for (const op of skips) {
      const label = `[${op.itemType}]`.padEnd(14);
      lines.push(
        `    ${pc.dim('✓')} ${label} ${pc.dim(op.name.padEnd(30))} ${pc.dim('(up to date)')}`,
      );
    }

    if (result.operations.length === 0) {
      lines.push(`    ${pc.dim('(no items)')}`);
    }

    if (result.mcpWarning) {
      const w = result.mcpWarning;
      const names = w.serverNames.join(', ');
      if (w.action === 'remove') {
        lines.push(
          `    ${pc.yellow('⚠')} ${pc.yellow(`${w.serverNames.length} non-canonical server(s) will be removed on push: ${names}`)}`,
        );
      } else {
        lines.push(
          `    ${pc.yellow('⚠')} ${pc.yellow(`${w.serverNames.length} non-canonical server(s) will remain as orphans: ${names}`)}`,
        );
      }
    }

    lines.push('');

    totalCreate += result.summary.create;
    totalUpdate += result.summary.update;
    totalSkip += result.summary.skip;
  }

  const summaryParts: string[] = [];
  if (totalCreate > 0)
    summaryParts.push(pc.green(`${totalCreate} to create`));
  if (totalUpdate > 0)
    summaryParts.push(pc.yellow(`${totalUpdate} to update`));
  if (totalSkip > 0) summaryParts.push(pc.dim(`${totalSkip} up to date`));

  lines.push(`  Summary: ${summaryParts.join(', ')}`);
  lines.push('');

  return lines.join('\n');
}

export function formatPushResult(
  results: PushTargetResult[],
  pretty: boolean,
): string {
  if (!pretty) {
    const targets: Record<
      string,
      { success: boolean; error?: string; written: number }
    > = {};

    for (const r of results) {
      const entry: { success: boolean; error?: string; written: number } = {
        success: r.success,
        written: r.operations.filter((op) => op.type !== 'skip').length,
      };
      if (r.error !== undefined) {
        entry.error = r.error;
      }
      targets[displayTarget(r.target)] = entry;
    }

    return (
      JSON.stringify(
        {
          targets,
          summary: {
            succeeded: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
          },
        },
        null,
        2,
      ) + '\n'
    );
  }

  const lines: string[] = ['', 'acsync push', ''];

  for (const r of results) {
    const status = r.success ? pc.green('✓') : pc.red('✗');
    lines.push(`  ${status} ${pc.bold(displayTarget(r.target))}`);
    if (!r.success && r.error) {
      lines.push(`    ${pc.red(r.error)}`);
    }
    const written = r.operations.filter((op) => op.type !== 'skip').length;
    lines.push(`    ${pc.dim(`${written} file(s) written`)}`);
    lines.push('');
  }

  return lines.join('\n');
}

/** Shorten home dir paths for display */
function tildify(p: string): string {
  const home = process.env.HOME ?? '';
  if (home && p.startsWith(home)) return '~' + p.slice(home.length);
  return p;
}

export function formatDryRunJson(results: DiffResult[]): string {
  const actions: Array<{
    action: 'create' | 'update';
    target: string;
    type: string;
    name: string;
    path: string;
  }> = [];

  const warnings: Array<{ target: string; mcpWarning: MCPWarning }> = [];

  for (const result of results) {
    for (const op of result.operations) {
      if (op.type === 'skip') continue;
      actions.push({
        action: op.type as 'create' | 'update',
        target: displayTarget(result.target),
        type: op.itemType,
        name: op.name,
        path: op.targetPath ?? '',
      });
    }
    if (result.mcpWarning) {
      warnings.push({ target: displayTarget(result.target), mcpWarning: result.mcpWarning });
    }
  }

  const output: Record<string, unknown> = {
    dryRun: true,
    actions,
    summary: {
      create: actions.filter((a) => a.action === 'create').length,
      update: actions.filter((a) => a.action === 'update').length,
    },
  };
  if (warnings.length > 0) output.warnings = warnings;

  return JSON.stringify(output, null, 2) + '\n';
}

export function formatDryRunPretty(results: DiffResult[]): string {
  const lines: string[] = ['', 'acsync push --dry-run', ''];

  let totalCreate = 0;
  let totalUpdate = 0;

  for (const result of results) {
    const actionOps = result.operations.filter((op) => op.type !== 'skip');
    if (actionOps.length === 0) continue;

    lines.push(`  ${pc.bold(displayTarget(result.target))}`);

    for (const op of actionOps) {
      const symbol = op.type === 'create' ? pc.green('+') : pc.yellow('~');
      const verb = op.type === 'create' ? pc.dim('create') : pc.dim('update');
      const label = `[${op.itemType}]`.padEnd(14);
      const path = op.targetPath ? pc.dim(tildify(op.targetPath)) : '';
      lines.push(`    ${symbol} ${label} ${op.name.padEnd(24)} ${verb}  → ${path}`);

      if (op.type === 'create') totalCreate++;
      else totalUpdate++;
    }

    if (result.mcpWarning) {
      const w = result.mcpWarning;
      const names = w.serverNames.join(', ');
      if (w.action === 'remove') {
        lines.push(
          `    ${pc.yellow('⚠')} ${pc.yellow(`${w.serverNames.length} non-canonical server(s) will be removed: ${names}`)}`,
        );
      } else {
        lines.push(
          `    ${pc.yellow('⚠')} ${pc.yellow(`${w.serverNames.length} non-canonical server(s) will remain as orphans: ${names}`)}`,
        );
      }
    }

    lines.push('');
  }

  if (totalCreate === 0 && totalUpdate === 0) {
    lines.push(`  ${pc.dim('Nothing to push — all targets up to date.')}`);
    lines.push('');
  } else {
    const parts: string[] = [];
    if (totalCreate > 0) parts.push(pc.green(`${totalCreate} to create`));
    if (totalUpdate > 0) parts.push(pc.yellow(`${totalUpdate} to update`));
    lines.push(`  Would write: ${parts.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatDryRunResult(results: DiffResult[], pretty: boolean): CheckResult {
  const hasDrift = results.some(
    (r) => r.summary.create > 0 || r.summary.update > 0,
  );
  const output = pretty ? formatDryRunPretty(results) : formatDryRunJson(results);
  return { output, hasDrift };
}

export function formatCheckResult(results: DiffResult[], pretty: boolean): CheckResult {
  const hasDrift = results.some(
    (r) => r.summary.create > 0 || r.summary.update > 0,
  );
  const output = pretty ? formatDiffPretty(results) : formatDiffJson(results);
  return { output, hasDrift };
}
