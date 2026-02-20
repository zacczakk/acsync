import pc from 'picocolors';
import type { DiffResult, Operation, TargetName } from '../types';

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

export function formatDiffJson(results: DiffResult[]): string {
  const targets: Record<
    string,
    { create: number; update: number; skip: number; operations: Operation[] }
  > = {};

  let totalCreate = 0;
  let totalUpdate = 0;
  let totalSkip = 0;

  for (const result of results) {
    targets[result.target] = {
      create: result.summary.create,
      update: result.summary.update,
      skip: result.summary.skip,
      operations: result.operations,
    };
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
    lines.push(`  ${pc.bold(result.target)}`);

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
      targets[r.target] = entry;
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
    lines.push(`  ${status} ${pc.bold(r.target)}`);
    if (!r.success && r.error) {
      lines.push(`    ${pc.red(r.error)}`);
    }
    const written = r.operations.filter((op) => op.type !== 'skip').length;
    lines.push(`    ${pc.dim(`${written} file(s) written`)}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function formatCheckResult(results: DiffResult[], pretty: boolean): CheckResult {
  const hasDrift = results.some(
    (r) => r.summary.create > 0 || r.summary.update > 0,
  );
  const output = pretty ? formatDiffPretty(results) : formatDiffJson(results);
  return { output, hasDrift };
}
