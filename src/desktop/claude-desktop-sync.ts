import os from 'node:os';
import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { atomicWrite } from '../infra/atomic-write';
import { readJson, writeJson } from '../formats/json';
import { parseFrontmatter } from '../formats/markdown';

export type Variant = 'claude' | 'claude-3p';

const VARIANT_DIR_NAME: Record<Variant, string> = {
  claude: 'Claude',
  'claude-3p': 'Claude-3p',
};

/** UUIDv4-ish (8-4-4-4-12 hex) */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccountOrg {
  account: string;
  org: string;
}

export interface SyncResult {
  variants: Variant[];
  details: Record<Variant, { instructions: boolean; skills: number } | null>;
}

export interface SyncOpts {
  configsDir: string;
  memoryVaultDir: string;
  variants?: Variant[];
  homeDir?: string;
}

// ── Path helpers ────────────────────────────────────────────────────────────

function variantBaseDir(homeDir: string, variant: Variant): string {
  return join(homeDir, 'Library/Application Support', VARIANT_DIR_NAME[variant]);
}

function instructionsPath(base: string, account: string, org: string): string {
  return join(base, 'local-agent-mode-sessions', account, org, 'memory', 'CLAUDE.md');
}

function skillsPluginRoot(base: string, account: string, org: string): string {
  return join(base, 'local-agent-mode-sessions', 'skills-plugin', org, account);
}

// ── Discovery ───────────────────────────────────────────────────────────────

export async function discoverVariants(homeDir: string): Promise<Variant[]> {
  const found: Variant[] = [];
  // 3p first — primary target
  for (const v of ['claude-3p', 'claude'] as Variant[]) {
    if (existsSync(variantBaseDir(homeDir, v))) found.push(v);
  }
  return found;
}

export async function discoverAccountAndOrg(variantBase: string): Promise<AccountOrg | null> {
  const sessionsDir = join(variantBase, 'local-agent-mode-sessions');
  let entries: string[];
  try {
    entries = await readdir(sessionsDir);
  } catch {
    return null;
  }
  for (const account of entries) {
    if (!UUID_RE.test(account)) continue; // skip skills-plugin and other non-UUID dirs
    const accountDir = join(sessionsDir, account);
    let orgEntries: string[];
    try {
      orgEntries = await readdir(accountDir);
    } catch {
      continue;
    }
    for (const org of orgEntries) {
      if (!UUID_RE.test(org)) continue;
      return { account, org };
    }
  }
  return null;
}

// ── Instructions ────────────────────────────────────────────────────────────

const INSTRUCTIONS_HEADER = '# Composed by metronome — do not edit by hand. Source: configs/instructions/AGENTS.md + Memory vault.\n';

export async function composeInstructions(configsDir: string, memoryVaultDir: string): Promise<string> {
  const agentsPath = join(configsDir, 'instructions', 'AGENTS.md');
  const agents = await readFile(agentsPath, 'utf-8'); // throws if missing — required

  const optional: Array<{ label: string; path: string }> = [
    { label: 'IDENTITY', path: join(memoryVaultDir, 'IDENTITY.md') },
    { label: 'SOUL', path: join(memoryVaultDir, 'SOUL.md') },
    { label: 'USER', path: join(memoryVaultDir, 'USER.md') },
  ];

  const parts: string[] = [INSTRUCTIONS_HEADER, '\n', agents.trimEnd(), '\n'];
  for (const o of optional) {
    try {
      const body = await readFile(o.path, 'utf-8');
      parts.push(`\n\n---\n\n<!-- from ${o.label} -->\n`, body.trimEnd(), '\n');
    } catch {
      // missing optional file — skip silently
    }
  }
  return parts.join('');
}

export async function syncInstructions(base: string, account: string, org: string, content: string): Promise<void> {
  await atomicWrite(instructionsPath(base, account, org), content);
}

// ── Skills ──────────────────────────────────────────────────────────────────

interface ManifestEntry {
  skillId: string;
  name: string;
  description: string;
  creatorType: 'anthropic' | 'user';
  updatedAt: number | null;
  enabled: boolean;
}

interface SkillManifest {
  lastUpdated: number;
  skills: ManifestEntry[];
}

const PLUGIN_JSON_DEFAULT = {
  name: 'anthropic-skills',
  version: '1.0.0',
  description: 'Anthropic-managed skills for Claude Desktop',
};

async function readSourceSkills(sourceSkillsDir: string): Promise<Array<{ name: string; description: string; dir: string }>> {
  let entries: string[];
  try {
    entries = await readdir(sourceSkillsDir);
  } catch {
    return [];
  }
  const skills: Array<{ name: string; description: string; dir: string }> = [];
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const dir = join(sourceSkillsDir, entry);
    let st;
    try {
      st = await stat(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const skillMdPath = join(dir, 'SKILL.md');
    let raw: string;
    try {
      raw = await readFile(skillMdPath, 'utf-8');
    } catch {
      continue; // not a valid skill dir
    }
    const { data } = parseFrontmatter(raw);
    const description = typeof data.description === 'string' ? data.description.replace(/\s+/g, ' ').trim() : '';
    skills.push({ name: entry, description, dir });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const sp = join(src, entry.name);
    const dp = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(sp, dp);
    } else if (entry.isFile()) {
      const buf = await readFile(sp);
      await atomicWrite(dp, buf);
    }
  }
}

export async function syncSkills(
  base: string,
  account: string,
  org: string,
  sourceSkillsDir: string,
): Promise<number> {
  const root = skillsPluginRoot(base, account, org);
  const skillsRoot = join(root, 'skills');
  const pluginJsonPath = join(root, '.claude-plugin', 'plugin.json');
  const manifestPath = join(root, 'manifest.json');

  // Ensure plugin.json exists (create default if missing — preserve if present)
  if (!existsSync(pluginJsonPath)) {
    await atomicWrite(pluginJsonPath, writeJson(PLUGIN_JSON_DEFAULT));
  }

  // Read existing manifest (preserve Anthropic entries)
  let existingManifest: SkillManifest = { lastUpdated: 0, skills: [] };
  try {
    existingManifest = readJson<SkillManifest>(await readFile(manifestPath, 'utf-8'));
  } catch {
    // missing — start fresh
  }
  const anthropicEntries = existingManifest.skills.filter((s) => s.creatorType === 'anthropic');
  const anthropicNames = new Set(anthropicEntries.map((s) => s.name));

  // Read source skills
  const sourceSkills = await readSourceSkills(sourceSkillsDir);
  const sourceNames = new Set(sourceSkills.map((s) => s.name));

  // Remove stale user skill dirs (not in source, and not Anthropic-managed)
  if (existsSync(skillsRoot)) {
    const present = await readdir(skillsRoot);
    for (const name of present) {
      if (anthropicNames.has(name)) continue;
      if (sourceNames.has(name)) continue;
      await rm(join(skillsRoot, name), { recursive: true, force: true });
    }
  }

  // Copy each source skill dir
  for (const s of sourceSkills) {
    if (anthropicNames.has(s.name)) continue; // never overwrite Anthropic skills
    const destDir = join(skillsRoot, s.name);
    if (existsSync(destDir)) await rm(destDir, { recursive: true, force: true });
    await copyDirRecursive(s.dir, destDir);
  }

  // Build user manifest entries
  const userEntries: ManifestEntry[] = sourceSkills
    .filter((s) => !anthropicNames.has(s.name))
    .map((s) => ({
      skillId: s.name,
      name: s.name,
      description: s.description,
      creatorType: 'user' as const,
      updatedAt: null,
      enabled: true,
    }));

  // Compose manifest: Anthropic first (preserve order), then user (alphabetical)
  const newSkills = [...anthropicEntries, ...userEntries];

  // Compute deterministic lastUpdated: hash of skill list (idempotency)
  const hashInput = JSON.stringify(newSkills);
  const lastUpdated = parseInt(createHash('sha256').update(hashInput).digest('hex').slice(0, 12), 16);

  const newManifest: SkillManifest = { lastUpdated, skills: newSkills };
  await atomicWrite(manifestPath, writeJson(newManifest));

  return userEntries.length;
}

// ── Top-level orchestrator ──────────────────────────────────────────────────

export async function syncClaudeDesktop(opts: SyncOpts): Promise<SyncResult> {
  const homeDir = opts.homeDir ?? os.homedir();
  const candidate = opts.variants ?? (await discoverVariants(homeDir));

  const instructionsContent = candidate.length > 0 ? await composeInstructions(opts.configsDir, opts.memoryVaultDir) : '';

  const result: SyncResult = {
    variants: [],
    details: { claude: null, 'claude-3p': null },
  };

  for (const variant of candidate) {
    const base = variantBaseDir(homeDir, variant);
    if (!existsSync(base)) continue;

    const accountOrg = await discoverAccountAndOrg(base);
    if (!accountOrg) continue; // skip variant without account/org

    const { account, org } = accountOrg;

    await syncInstructions(base, account, org, instructionsContent);
    const skillsCount = await syncSkills(base, account, org, join(opts.configsDir, 'skills'));

    result.variants.push(variant);
    result.details[variant] = { instructions: true, skills: skillsCount };
  }

  return result;
}
