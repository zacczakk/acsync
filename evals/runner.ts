#!/usr/bin/env bun
import { parseArgs } from "util";
import { resolve, basename } from "path";
import { readFileSync, existsSync, writeFileSync } from "fs";
import type { Adapter, EvalQuery, EvalResult, EvalSummary } from "./types";
import { createOpenCodeAdapter } from "./adapters/opencode";
import { createClaudeAdapter } from "./adapters/claude";
import { generateReport } from "./report";
import { improveDescription, applyDescription } from "./improve";

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    skill: { type: "string" },
    adapter: { type: "string", default: "opencode" },
    model: { type: "string" },
    workers: { type: "string", default: "3" },
    "eval-set": { type: "string" },
    report: { type: "string", default: "auto" },
    verbose: { type: "boolean", default: false },
    improve: { type: "boolean", default: false },
    iterations: { type: "string", default: "3" },
  },
  strict: true,
});

if (!values.skill) {
  console.error("Usage: bun evals/runner.ts --skill <name> [--adapter opencode|claude] [--improve]");
  process.exit(1);
}

const SKILLS_DIR = resolve(import.meta.dir, "../configs/skills");
const SETS_DIR = resolve(import.meta.dir, "sets");
const skillName = values.skill;
const skillDir = resolve(SKILLS_DIR, skillName);
const skillMd = resolve(skillDir, "SKILL.md");

if (!existsSync(skillMd)) {
  console.error(`Skill not found: ${skillMd}`);
  process.exit(1);
}

const evalSetPath = values["eval-set"]
  ? resolve(values["eval-set"])
  : resolve(SETS_DIR, `${skillName}.json`);

if (!existsSync(evalSetPath)) {
  console.error(`Eval set not found: ${evalSetPath}`);
  process.exit(1);
}

const evalSet: EvalQuery[] = JSON.parse(readFileSync(evalSetPath, "utf-8"));
const numWorkers = parseInt(values.workers, 10);

function parseSkillDescription(path: string): string {
  const content = readFileSync(path, "utf-8");
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return "";
  const fm = match[1];

  // YAML folded (>) or literal (|) scalar: collect indented continuation lines
  const blockMatch = fm.match(/description:\s*[>|]-?\s*\n((?:[ \t]+.*\n?)*)/);
  if (blockMatch) {
    return blockMatch[1]
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join(" ");
  }

  // Inline quoted or unquoted
  const inlineMatch = fm.match(/description:\s*["']?(.*?)["']?\s*$/m);
  return inlineMatch ? inlineMatch[1].trim() : "";
}

function createAdapter(name: string, model?: string): Adapter {
  switch (name) {
    case "opencode":
      return createOpenCodeAdapter(model);
    case "claude":
      return createClaudeAdapter(model);
    default:
      console.error(`Unknown adapter: ${name}. Use: opencode, claude`);
      process.exit(1);
  }
}

async function runEval(
  adapter: Adapter,
  queries: EvalQuery[],
  concurrency: number,
): Promise<EvalResult[]> {
  const results: EvalResult[] = [];
  const queue = [...queries];
  const active: Promise<void>[] = [];

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()!;
      const label = item.should_trigger ? "+" : "-";
      if (values.verbose) {
        process.stderr.write(`  [${label}] ${item.query.slice(0, 60)}...`);
      }
      try {
        const triggered = await adapter.runQuery(item.query, skillName);
        const pass = item.should_trigger ? triggered : !triggered;
        results.push({
          query: item.query,
          should_trigger: item.should_trigger,
          triggered,
          pass,
        });
        if (values.verbose) {
          const status = pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
          process.stderr.write(` ${status}\n`);
        }
      } catch (err) {
        results.push({
          query: item.query,
          should_trigger: item.should_trigger,
          triggered: false,
          pass: !item.should_trigger,
        });
        if (values.verbose) {
          process.stderr.write(` \x1b[33mERROR\x1b[0m\n`);
        }
      }
    }
  }

  for (let i = 0; i < concurrency; i++) {
    active.push(processNext());
  }
  await Promise.all(active);
  return results;
}

const adapter = createAdapter(values.adapter, values.model);
const description = parseSkillDescription(skillMd);

console.error(`\nSkill:   ${skillName}`);
console.error(`Adapter: ${adapter.name}`);
console.error(`Queries: ${evalSet.length}`);
console.error(`Workers: ${numWorkers}\n`);

const results = await runEval(adapter, evalSet, numWorkers);

const summary: EvalSummary = {
  skill: skillName,
  description,
  total: results.length,
  passed: results.filter((r) => r.pass).length,
  failed: results.filter((r) => !r.pass).length,
  results,
};

console.error(
  `\nResult: ${summary.passed}/${summary.total} passed (${summary.failed} failed)\n`,
);

for (const r of results) {
  const status = r.pass ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  const expect = r.should_trigger ? "trigger" : "ignore";
  const actual = r.triggered ? "triggered" : "ignored";
  console.error(`  [${status}] expect=${expect} actual=${actual}: ${r.query.slice(0, 70)}`);
}

// Write JSON results
const jsonOut = JSON.stringify(summary, null, 2);
console.log(jsonOut);

// Write HTML report
if (values.report !== "none") {
  const reportPath =
    values.report === "auto"
      ? `/tmp/skill-eval-${skillName}-${Date.now()}.html`
      : values.report;
  writeFileSync(reportPath, generateReport(summary));
  console.error(`\nReport: ${reportPath}`);
}

if (values.improve) {
  const maxIter = parseInt(values.iterations, 10);
  console.error(`\n--- Improving description (${maxIter} iterations) ---\n`);

  const history: { iteration: number; description: string; passed: number; total: number; failures: string[] }[] = [];
  let bestDesc = description;
  let bestScore = summary.passed;
  let currentSummary = summary;

  for (let i = 1; i <= maxIter; i++) {
    if (currentSummary.failed === 0) {
      console.error(`All passed — stopping early at iteration ${i}.`);
      break;
    }

    console.error(`Iteration ${i}/${maxIter}: improving...`);
    const newDesc = await improveDescription({
      adapter,
      skillName,
      skillPath: skillMd,
      evalResults: currentSummary,
      history,
    });

    console.error(`  Proposed (${newDesc.length} chars): ${newDesc.slice(0, 80)}...`);

    history.push({
      iteration: i,
      description: currentSummary.description,
      passed: currentSummary.passed,
      total: currentSummary.total,
      failures: currentSummary.results.filter((r) => !r.pass).map((r) => r.query),
    });

    // Apply and re-eval
    applyDescription(skillMd, newDesc);
    console.error(`  Re-evaluating...`);
    const newResults = await runEval(adapter, evalSet, numWorkers);
    const newPassed = newResults.filter((r) => r.pass).length;

    currentSummary = {
      skill: skillName,
      description: newDesc,
      total: newResults.length,
      passed: newPassed,
      failed: newResults.length - newPassed,
      results: newResults,
    };

    console.error(`  Score: ${newPassed}/${newResults.length}`);

    if (newPassed > bestScore) {
      bestDesc = newDesc;
      bestScore = newPassed;
    }
  }

  if (bestDesc !== description) {
    applyDescription(skillMd, bestDesc);
    console.error(`\nBest description applied (${bestScore}/${summary.total}):`);
    console.error(`  ${bestDesc.slice(0, 120)}...`);
  } else {
    console.error(`\nOriginal description was best — no changes applied.`);
  }
}
