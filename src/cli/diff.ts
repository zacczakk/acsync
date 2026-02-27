#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import {
  ALL_TARGETS,
  PROJECT_ROOT,
  createAdapter,
  readCanonicalCommands,
  readCanonicalAgents,
  readCanonicalMCPServers,
  readCanonicalInstructions,
  readCanonicalSkills,
  readCanonicalSettings,
} from './canonical';
import { runCheck } from './check';
import { mapTargets, mapTypes, collect, validateTargets, validateTypes } from './cli-helpers';
import { createExclusionFilter } from '../infra/exclusion';
import type { TargetName, ItemType, CanonicalItem } from '../types';

export const diffCommand = new Command('diff')
  .description(
    `Show unified text diff between rendered canonical and on-disk target configs.

Runs check first, then for each drifted item shows a git-style unified diff
(--- a/path, +++ b/path, @@ hunks) comparing the current on-disk content
against what canonical would render. Only items with create/update drift are shown.

Examples:
  acsync diff                           Diff all targets, all types
  acsync diff -t claude                 Diff Claude Code only
  acsync diff --type mcps               Diff MCP configs only
  acsync diff -t opencode --type commands  Diff OpenCode commands only

Exit codes: 0 = no drift, 2 = drift found, 1 = error`)
  .option('-t, --target <name>', 'Scope to specific target (repeatable): claude, gemini, codex, opencode', collect, [] as string[])
  .option('--type <name>', 'Scope to config type (repeatable): commands, agents, mcps, instructions, skills, settings', collect, [] as string[])
  .action(async (options: { target: string[]; type: string[] }) => {
    try {
      validateTargets(options.target);
      validateTypes(options.type);

      const projectDir = PROJECT_ROOT;
      const targets = mapTargets(options.target);
      const types = mapTypes(options.type);

      const checkResult = await runCheck({
        targets,
        types,
        projectDir,
      });

      if (!checkResult.hasDrift) {
        process.exit(0);
      }

      const isExcluded = createExclusionFilter();

      // Cache canonical items (loaded once)
      const [commands, agents, mcpServers, skills] = await Promise.all([
        readCanonicalCommands(projectDir, isExcluded),
        readCanonicalAgents(projectDir, isExcluded),
        readCanonicalMCPServers(projectDir),
        readCanonicalSkills(projectDir, isExcluded),
      ]);

      let hasOutput = false;

      for (const diff of checkResult.diffs) {
        const target = diff.target;
        const adapter = createAdapter(target);
        const caps = adapter.getCapabilities();
        const driftOps = diff.operations.filter(
          (op) => op.type === 'create' || op.type === 'update',
        );

        if (driftOps.length === 0) continue;

        // Deduplicate by targetPath (MCP/instructions share a path)
        const seen = new Set<string>();

        for (const op of driftOps) {
          if (!op.targetPath) continue;
          const key = `${target}:${op.targetPath}`;
          if (seen.has(key)) continue;
          seen.add(key);

          // Render canonical content
          let rendered: string;
          if (op.itemType === 'command') {
            const item = commands.find((c) => c.name === op.name);
            if (!item) continue;
            rendered = adapter.renderCommand(item).content;
          } else if (op.itemType === 'agent') {
            const item = agents.find((a) => a.name === op.name);
            if (!item) continue;
            rendered = adapter.renderAgent(item).content;
          } else if (op.itemType === 'mcp') {
            let existingContent: string | undefined;
            try {
              existingContent = await readFile(op.targetPath, 'utf-8');
            } catch {
              // No existing file
            }
            rendered = adapter.renderMCPServers(mcpServers, existingContent);
          } else if (op.itemType === 'instruction') {
            const instructionContent = await readCanonicalInstructions(projectDir);
            if (!instructionContent) continue;
            rendered = adapter.renderInstructions(instructionContent);
          } else if (op.itemType === 'skill') {
            if (!caps.skills) continue;
            const item = skills.find((s) => s.name === op.name);
            if (!item) continue;
            rendered = adapter.renderSkill(item).content;
          } else if (op.itemType === 'settings') {
            if (!caps.settings) continue;
            const settings = await readCanonicalSettings(projectDir, target);
            if (!settings) continue;
            let existingContent: string | undefined;
            try {
              existingContent = await readFile(op.targetPath, 'utf-8');
            } catch {
              // No existing file
            }
            rendered = adapter.renderSettings(settings, existingContent);
          } else {
            continue;
          }

          // Read existing on-disk content
          let existing = '';
          if (op.type === 'update') {
            try {
              existing = await readFile(op.targetPath, 'utf-8');
            } catch {
              // Treat as empty
            }
          }

          const diffOutput = unifiedDiff(existing, rendered, op.targetPath);
          if (diffOutput) {
            process.stdout.write(diffOutput + '\n');
            hasOutput = true;
          }
        }
      }

      process.exit(hasOutput ? 2 : 0);
    } catch (err) {
      process.stderr.write(
        `Error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    }
  });

/**
 * Produce a minimal unified diff between two strings.
 * Shows --- / +++ headers and changed lines with - / + prefixes.
 * For create operations (empty `a`), all lines are shown as additions.
 */
export function unifiedDiff(a: string, b: string, path: string): string | null {
  const aLines = a ? a.split('\n') : [];
  const bLines = b ? b.split('\n') : [];

  // If identical, no diff
  if (a === b) return null;

  const lines: string[] = [];
  lines.push(`--- a/${path}`);
  lines.push(`+++ b/${path}`);

  if (aLines.length === 0) {
    // All additions (create)
    lines.push(`@@ -0,0 +1,${bLines.length} @@`);
    for (const line of bLines) {
      lines.push(`+${line}`);
    }
    return lines.join('\n');
  }

  // Simple line-by-line diff: find changed, added, removed lines
  // Uses longest common subsequence for minimal diff
  const lcs = computeLCS(aLines, bLines);
  let ai = 0;
  let bi = 0;

  // Collect hunks
  const hunks: Array<{ aStart: number; aCount: number; bStart: number; bCount: number; lines: string[] }> = [];
  let currentHunk: typeof hunks[number] | null = null;
  let contextAfter = 0;
  const CONTEXT = 3;

  for (const [la, lb] of lcs) {
    // Emit removals (lines in a before this match)
    while (ai < la) {
      if (!currentHunk) {
        const aStart = Math.max(0, ai - CONTEXT);
        const bStart = Math.max(0, bi - CONTEXT);
        currentHunk = { aStart, aCount: 0, bStart, bCount: 0, lines: [] };
        // Add leading context
        for (let c = aStart; c < ai; c++) {
          currentHunk.lines.push(` ${aLines[c]}`);
          currentHunk.aCount++;
          currentHunk.bCount++;
        }
      }
      currentHunk.lines.push(`-${aLines[ai]}`);
      currentHunk.aCount++;
      ai++;
      contextAfter = 0;
    }

    // Emit additions (lines in b before this match)
    while (bi < lb) {
      if (!currentHunk) {
        const aStart = Math.max(0, ai - CONTEXT);
        const bStart = Math.max(0, bi - CONTEXT);
        currentHunk = { aStart, aCount: 0, bStart, bCount: 0, lines: [] };
        for (let c = aStart; c < ai; c++) {
          currentHunk.lines.push(` ${aLines[c]}`);
          currentHunk.aCount++;
          currentHunk.bCount++;
        }
      }
      currentHunk.lines.push(`+${bLines[bi]}`);
      currentHunk.bCount++;
      bi++;
      contextAfter = 0;
    }

    // This line is common
    if (currentHunk) {
      currentHunk.lines.push(` ${aLines[ai]}`);
      currentHunk.aCount++;
      currentHunk.bCount++;
      contextAfter++;
      if (contextAfter >= CONTEXT) {
        hunks.push(currentHunk);
        currentHunk = null;
        contextAfter = 0;
      }
    }

    ai++;
    bi++;
  }

  // Remaining removals
  while (ai < aLines.length) {
    if (!currentHunk) {
      const aStart = Math.max(0, ai - CONTEXT);
      const bStart = Math.max(0, bi - CONTEXT);
      currentHunk = { aStart, aCount: 0, bStart, bCount: 0, lines: [] };
      for (let c = aStart; c < ai; c++) {
        currentHunk.lines.push(` ${aLines[c]}`);
        currentHunk.aCount++;
        currentHunk.bCount++;
      }
    }
    currentHunk.lines.push(`-${aLines[ai]}`);
    currentHunk.aCount++;
    ai++;
  }

  // Remaining additions
  while (bi < bLines.length) {
    if (!currentHunk) {
      const aStart = Math.max(0, ai - CONTEXT);
      const bStart = Math.max(0, bi - CONTEXT);
      currentHunk = { aStart, aCount: 0, bStart, bCount: 0, lines: [] };
      for (let c = aStart; c < ai; c++) {
        currentHunk.lines.push(` ${aLines[c]}`);
        currentHunk.aCount++;
        currentHunk.bCount++;
      }
    }
    currentHunk.lines.push(`+${bLines[bi]}`);
    currentHunk.bCount++;
    bi++;
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  if (hunks.length === 0) return null;

  for (const hunk of hunks) {
    lines.push(`@@ -${hunk.aStart + 1},${hunk.aCount} +${hunk.bStart + 1},${hunk.bCount} @@`);
    lines.push(...hunk.lines);
  }

  return lines.join('\n');
}

/**
 * Compute longest common subsequence indices.
 * Returns array of [indexInA, indexInB] pairs for matching lines.
 */
function computeLCS(a: string[], b: string[]): Array<[number, number]> {
  const m = a.length;
  const n = b.length;

  // For large files, use a simpler greedy approach
  if (m * n > 1_000_000) {
    return greedyLCS(a, b);
  }

  // Standard DP approach
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matching pairs
  const result: Array<[number, number]> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

/**
 * Greedy LCS for large files — matches lines in order using a hash map.
 */
function greedyLCS(a: string[], b: string[]): Array<[number, number]> {
  // Build index of b lines
  const bIndex = new Map<string, number[]>();
  for (let j = 0; j < b.length; j++) {
    const line = b[j];
    if (!bIndex.has(line)) bIndex.set(line, []);
    bIndex.get(line)!.push(j);
  }

  const result: Array<[number, number]> = [];
  let lastJ = -1;

  for (let i = 0; i < a.length; i++) {
    const positions = bIndex.get(a[i]);
    if (!positions) continue;
    // Find smallest j > lastJ
    for (const j of positions) {
      if (j > lastJ) {
        result.push([i, j]);
        lastJ = j;
        break;
      }
    }
  }

  return result;
}
