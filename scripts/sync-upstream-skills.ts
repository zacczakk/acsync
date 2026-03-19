#!/usr/bin/env tsx

/**
 * Sync remote agent skills from upstream repos.
 * Reads configs/skills/registry.json for upstream sources.
 * Auto-sync skills get overwritten; manual-sync skills get diff reports only.
 * Writes summary to Memory vault.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REGISTRY_PATH = join(ROOT, "configs/skills/registry.json");
const TMP_BASE = "/tmp/skill-sync";
const HOME = process.env.HOME ?? require("os").homedir();

interface SkillEntry {
  localName?: string;
  sync: "auto" | "manual";
}

interface Upstream {
  repo: string;
  basePath: string;
  skills: Record<string, SkillEntry>;
}

interface Registry {
  skillsDir: string;
  summaryDir: string;
  upstreams: Record<string, Upstream>;
}

function timestamp(): string {
  return new Date().toISOString();
}

function log(msg: string): void {
  console.log(`[${timestamp()}] ${msg}`);
}

function expandPath(p: string): string {
  return p.replace(/^~/, HOME);
}

/** Shallow clone a repo to a temp dir. Returns the clone path. */
function cloneRepo(name: string, url: string): string {
  const dest = join(TMP_BASE, name);
  if (existsSync(dest)) {
    execSync(`trash "${dest}" 2>/dev/null || true`, { stdio: "pipe" });
  }
  mkdirSync(dest, { recursive: true });
  execSync(`git clone --depth 1 --quiet "${url}" "${dest}"`, {
    stdio: "pipe",
    timeout: 60_000,
  });
  return dest;
}

/** Get recursive file list relative to a directory. */
function getFiles(dir: string, prefix = ""): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".DS_Store") continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...getFiles(join(dir, entry.name), rel));
    } else {
      files.push(rel);
    }
  }
  return files.sort();
}

/** Diff two directories. Returns a list of changed/added/removed files. */
function diffDirs(localDir: string, upstreamDir: string): { added: string[]; removed: string[]; changed: string[] } {
  const localFiles = new Set(getFiles(localDir));
  const upstreamFiles = new Set(getFiles(upstreamDir));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const f of upstreamFiles) {
    if (!localFiles.has(f)) {
      added.push(f);
    } else {
      const localContent = readFileSync(join(localDir, f));
      const upstreamContent = readFileSync(join(upstreamDir, f));
      if (!localContent.equals(upstreamContent)) {
        changed.push(f);
      }
    }
  }

  for (const f of localFiles) {
    if (!upstreamFiles.has(f)) {
      removed.push(f);
    }
  }

  return { added, removed, changed };
}

/** Copy entire upstream skill dir to local, preserving structure. */
function pullSkill(localDir: string, upstreamDir: string): void {
  const upstreamFiles = getFiles(upstreamDir);
  for (const f of upstreamFiles) {
    const src = join(upstreamDir, f);
    const dest = join(localDir, f);
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest, { force: true });
  }

  // Remove local files not in upstream (cleanup)
  const localFiles = getFiles(localDir);
  for (const f of localFiles) {
    if (!upstreamFiles.includes(f)) {
      const fullPath = join(localDir, f);
      execSync(`trash "${fullPath}" 2>/dev/null || true`, { stdio: "pipe" });
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────

const registry: Registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
const skillsDir = join(ROOT, registry.skillsDir);
const summaryDir = expandPath(registry.summaryDir);

const autoUpdated: string[] = [];
const manualDiffs: string[] = [];
const errors: string[] = [];
let checkedCount = 0;

log("Starting skill sync");

for (const [upstreamName, upstream] of Object.entries(registry.upstreams)) {
  log(`Cloning ${upstreamName}: ${upstream.repo}`);

  let clonePath: string;
  try {
    clonePath = cloneRepo(upstreamName, upstream.repo);
  } catch (e) {
    const msg = `Failed to clone ${upstreamName}: ${e instanceof Error ? e.message : String(e)}`;
    log(msg);
    errors.push(msg);
    continue;
  }

  for (const [upstreamSkillName, entry] of Object.entries(upstream.skills)) {
    const localName = entry.localName ?? upstreamSkillName;
    const localDir = join(skillsDir, localName);
    const upstreamDir = join(clonePath, upstream.basePath, upstreamSkillName);

    if (!existsSync(upstreamDir)) {
      const msg = `${upstreamName}/${upstreamSkillName}: upstream dir not found at ${upstreamDir}`;
      log(msg);
      errors.push(msg);
      continue;
    }

    if (!existsSync(localDir)) {
      const msg = `${localName}: local dir not found at ${localDir} (new skill?)`;
      log(msg);
      errors.push(msg);
      continue;
    }

    checkedCount++;
    const diff = diffDirs(localDir, upstreamDir);
    const hasChanges = diff.added.length > 0 || diff.changed.length > 0 || diff.removed.length > 0;

    if (!hasChanges) {
      log(`${localName}: up to date`);
      continue;
    }

    const diffSummary = [
      diff.added.length > 0 ? `added: ${diff.added.join(", ")}` : "",
      diff.changed.length > 0 ? `changed: ${diff.changed.join(", ")}` : "",
      diff.removed.length > 0 ? `removed locally: ${diff.removed.join(", ")}` : "",
    ].filter(Boolean).join("; ");

    if (entry.sync === "auto") {
      log(`${localName}: pulling changes (${diffSummary})`);
      try {
        pullSkill(localDir, upstreamDir);
        autoUpdated.push(`${localName} (${upstreamName}): ${diffSummary}`);
      } catch (e) {
        const msg = `${localName}: pull failed: ${e instanceof Error ? e.message : String(e)}`;
        log(msg);
        errors.push(msg);
      }
    } else {
      log(`${localName}: upstream changes detected (manual sync) — ${diffSummary}`);
      manualDiffs.push(`${localName} (${upstreamName}): ${diffSummary}`);
    }
  }
}

// ── Summary ─────────────────────────────────────────────────────────

const noChanges = autoUpdated.length === 0 && manualDiffs.length === 0 && errors.length === 0;
const date = new Date().toISOString().slice(0, 10);

log(`Done. Checked ${checkedCount} skills.`);
if (autoUpdated.length > 0) log(`Auto-updated: ${autoUpdated.length}`);
if (manualDiffs.length > 0) log(`Manual review needed: ${manualDiffs.length}`);
if (errors.length > 0) log(`Errors: ${errors.length}`);
if (noChanges) log("All skills up to date — no changes.");

// Write summary to Memory vault (only if something happened)
if (!noChanges) {
  mkdirSync(summaryDir, { recursive: true });
  const summaryPath = join(summaryDir, `skill-sync-${date}.md`);

  const lines = [
    "---",
    `type: sync-report`,
    `summary: "Skill sync ${date}: ${autoUpdated.length} auto-updated, ${manualDiffs.length} need manual review, ${errors.length} errors"`,
    `tags: [system, skill-sync]`,
    `created: ${date}`,
    "---",
    "",
    "# Skill Sync Report",
    "",
    `**Date:** ${timestamp()}`,
    `**Skills checked:** ${checkedCount}`,
    "",
  ];

  if (autoUpdated.length > 0) {
    lines.push("## Auto-Updated", "");
    for (const u of autoUpdated) lines.push(`- ${u}`);
    lines.push("");
  }

  if (manualDiffs.length > 0) {
    lines.push("## Manual Review Needed", "");
    for (const d of manualDiffs) lines.push(`- ${d}`);
    lines.push("");
  }

  if (errors.length > 0) {
    lines.push("## Errors", "");
    for (const e of errors) lines.push(`- ${e}`);
    lines.push("");
  }

  writeFileSync(summaryPath, lines.join("\n"));
  log(`Summary written to ${summaryPath}`);
}

// Cleanup
for (const name of Object.keys(registry.upstreams)) {
  const p = join(TMP_BASE, name);
  if (existsSync(p)) {
    execSync(`trash "${p}" 2>/dev/null || true`, { stdio: "pipe" });
  }
}

process.exit(errors.length > 0 ? 1 : 0);
