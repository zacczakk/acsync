import { cp, lstat, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { parseFrontmatter } from '../formats/markdown';
import { isIgnoredSupportPath, readSupportFiles } from '../infra/support-files';
import type { CanonicalItem } from '../types';
import type { TargetName } from '../types';
import type { Manifest } from '../types';

export const PUBLIC_SKILL_MARKER = '.metronome-public-v1';
export const PRIVATE_SKILL_MARKER = '.metronome-private-v1';

export interface PrivateSkill {
  name: string;
  item: CanonicalItem;
  sourceDir: string;
}

export interface SkillProjectionRoot {
  target: TargetName;
  root: string;
}

export interface SkillProjectionOperation {
  kind: 'public' | 'private' | 'stale-delete' | 'private-delete' | 'legacy-delete';
  name: string;
  sourceDir?: string;
  filesystemPath: string;
  targetPath: string;
  marker?: string;
  target?: TargetName;
  historicalAdoption?: boolean;
}

export interface SkillProjectionPlan {
  operations: SkillProjectionOperation[];
  privateSkills: PrivateSkill[];
}

interface PrivateSkillDiscovery {
  privateSkills: PrivateSkill[];
  sharedRootAvailable: boolean;
}

export interface SkillProjectionPlanOptions {
  projectDir: string;
  homeDir: string;
  targets: readonly TargetName[];
  publicSkillNames: readonly string[];
  deleteStale: boolean;
  historicallyOwnedPublicSkillNames?: ReadonlySet<string>;
  historicalManifest?: Manifest;
}

function historicalSkillHash(content: string): string {
  return createHash('sha256').update(content.trimEnd(), 'utf8').digest('hex');
}

/**
 * Proves marker-free shared skills were previously rendered for the shared clients.
 * The caller supplies the loaded manifest; this function has no global state.
 */
export async function historicallyOwnedSharedSkillNames(
  manifest: Manifest,
  publicSkillNames: readonly string[],
  sharedRoot: string,
): Promise<Set<string>> {
  const proven = new Set<string>();
  for (const name of publicSkillNames) {
    const skillDir = join(sharedRoot, name);
    if (await hasSkillMarker(skillDir)) continue;
    let content: string;
    try {
      content = await readFile(join(skillDir, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    const targets = manifest.items[`skill/${name}`]?.targets;
    if (targets?.codex?.hash === historicalSkillHash(content) || targets?.opencode?.hash === historicalSkillHash(content) || targets?.opencode2?.hash === historicalSkillHash(content)) {
      proven.add(name);
    }
  }
  return proven;
}

async function directoryNames(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

async function isSameRealPath(left: string, right: string): Promise<boolean> {
  try {
    return await realpath(left) === await realpath(right);
  } catch {
    return false;
  }
}

async function isSymbolicLink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch {
    return false;
  }
}

export async function planSkillProjection(options: SkillProjectionPlanOptions): Promise<SkillProjectionPlan> {
  const publicRoot = join(options.projectDir, 'configs', 'skills');
  const sharedRoot = join(options.homeDir, '.agents', 'skills');
  const roots = selectedSkillProjectionRoots(options.targets, options.homeDir);
  const historicalNames = options.historicallyOwnedPublicSkillNames ?? new Set<string>();
  const { privateSkills, sharedRootAvailable } = await discoverPrivateSkills(publicRoot, sharedRoot, historicalNames);
  const operations: SkillProjectionOperation[] = [];

  for (const { target, root } of roots) {
    for (const name of options.publicSkillNames) {
      const destination = join(root, name);
      operations.push({
        kind: 'public', name, sourceDir: join(publicRoot, name), filesystemPath: destination, targetPath: destination,
        marker: PUBLIC_SKILL_MARKER, target,
        historicalAdoption: options.historicalManifest
          ? await hasHistoricalPublicProjectionProof(options.historicalManifest, name, target, join(publicRoot, name), destination, options.homeDir)
          : root === sharedRoot && historicalNames.has(name) && await safeHistoricalSharedTree(destination, options.homeDir, name),
      });
    }
  }
  for (const privateSkill of privateSkills) {
    for (const target of ['claude-code', 'antigravity'] as const) {
      if (!options.targets.includes(target)) continue;
      const root = target === 'claude-code' ? join(options.homeDir, '.claude', 'skills') : join(options.homeDir, '.gemini', 'antigravity-cli', 'skills');
      const destination = join(root, privateSkill.name);
      operations.push({
        kind: 'private', name: privateSkill.name, sourceDir: privateSkill.sourceDir, filesystemPath: destination, targetPath: destination,
        marker: PRIVATE_SKILL_MARKER, target,
        historicalAdoption: options.historicalManifest
          ? await hasHistoricalPrivateProjectionProof(options.historicalManifest, privateSkill.name, target, destination, options.homeDir)
          : false,
      });
    }
  }
  if (options.deleteStale) {
    for (const { target, root } of roots) {
      for (const name of await directoryNames(root)) {
        const path = join(root, name);
        if (options.publicSkillNames.includes(name) || name.startsWith('.') || name.startsWith('oe-')) continue;
        const isPrivateSource = privateSkills.some((skill) => skill.name === name);
        const stalePrivate = sharedRootAvailable && (target === 'claude-code' || target === 'antigravity') && await hasPrivateSkillMarker(path) && !isPrivateSource;
        if (await hasPublicSkillMarker(path)) operations.push({ kind: 'stale-delete', name, filesystemPath: path, targetPath: path, target });
        else if (stalePrivate) operations.push({ kind: 'private-delete', name, filesystemPath: path, targetPath: path, target });
      }
    }
    const allTargetsSelected = ['claude-code', 'opencode', 'antigravity', 'codex'].every((target) => options.targets.includes(target));
    const legacyRoots: Array<{ root: string; target: TargetName; requiresAllTargets?: boolean }> = [
      { root: join(options.homeDir, '.config', 'opencode', 'skill'), target: 'opencode' },
      { root: join(options.homeDir, '.codex', 'skills'), target: 'codex' },
      { root: join(options.homeDir, '.cursor', 'skills'), target: 'codex', requiresAllTargets: true },
      { root: join(options.homeDir, '.gemini', 'skills'), target: 'antigravity', requiresAllTargets: true },
    ];
    for (const { root: legacyRoot, target, requiresAllTargets } of legacyRoots) {
      if (!options.targets.includes(target) || (requiresAllTargets && !allTargetsSelected)) continue;
      if (await isSameRealPath(legacyRoot, sharedRoot)) continue;
      for (const name of await directoryNames(legacyRoot)) {
        if (!options.publicSkillNames.includes(name) || name.startsWith('.') || name.startsWith('oe-')) continue;
        const path = join(legacyRoot, name);
        const source = join(publicRoot, name);
        try {
          const stat = await lstat(path);
          if (stat.isSymbolicLink()) continue;
          const replacement = join(sharedRoot, name);
          if (await sameSkillTree(source, path) && await sameSkillTree(replacement, path)) {
            operations.push({ kind: 'legacy-delete', name, filesystemPath: path, targetPath: path, target });
          }
        } catch { /* unavailable legacy tree stays untouched */ }
      }
    }
  }
  return { operations, privateSkills };
}

export function selectedSkillProjectionRoots(
  targets: readonly TargetName[],
  homeDir: string,
): SkillProjectionRoot[] {
  const roots: SkillProjectionRoot[] = [];
  const seen = new Set<string>();
  for (const target of targets) {
    const root = target === 'opencode' || target === 'opencode2' || target === 'codex'
      ? join(homeDir, '.agents', 'skills')
      : target === 'claude-code'
        ? join(homeDir, '.claude', 'skills')
        : join(homeDir, '.gemini', 'antigravity-cli', 'skills');
    const canonicalRoot = root;
    if (seen.has(canonicalRoot)) continue;
    seen.add(canonicalRoot);
    roots.push({ target, root });
  }
  return roots;
}

export async function skillFiles(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  async function visit(dir: string, prefix = ''): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === PUBLIC_SKILL_MARKER || entry.name === PRIVATE_SKILL_MARKER) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (isIgnoredSupportPath(relative)) continue;
      const path = join(dir, entry.name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error('Skill trees cannot contain symlinks');
      if (entry.isDirectory()) await visit(path, relative);
      else if (entry.isFile()) files.set(relative, await readFile(path, 'utf8'));
    }
  }
  await visit(root);
  return files;
}

export async function sameSkillTree(left: string, right: string): Promise<boolean> {
  const [leftFiles, rightFiles] = await Promise.all([skillFiles(left), skillFiles(right)]);
  return leftFiles.size === rightFiles.size
    && [...leftFiles].every(([name, content]) => rightFiles.get(name) === content);
}

/** Read private skills before public projection mutates the shared root. */
export async function discoverPrivateSkills(
  publicRoot: string,
  sharedRoot: string,
  historicallyOwnedPublicSkillNames: ReadonlySet<string> = new Set<string>(),
): Promise<PrivateSkillDiscovery> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(sharedRoot);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { privateSkills: [], sharedRootAvailable: false };
    throw new Error('Unable to read ~/.agents/skills');
  }

  const privateSkills: PrivateSkill[] = [];
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const localDir = join(sharedRoot, name);
    let raw: string;
    try {
      raw = await readFile(join(localDir, 'SKILL.md'), 'utf8');
    } catch {
      continue;
    }
    try {
      await readFile(join(localDir, PUBLIC_SKILL_MARKER), 'utf8');
      continue;
    } catch { /* unmarked */ }

    const publicDir = join(publicRoot, name);
    try {
      await readFile(join(publicDir, 'SKILL.md'), 'utf8');
      if (historicallyOwnedPublicSkillNames.has(name)) continue;
      if (!await sameSkillTree(publicDir, localDir)) {
        throw new Error(`Unowned local skill conflicts with public skill: ${name}`);
      }
      // Identical old projection; leave it for public ownership adoption.
      continue;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Unowned')) throw error;
    }
    const { data, content } = parseFrontmatter(raw);
    privateSkills.push({
      name,
      item: { name, content, metadata: data, supportFiles: await readSupportFiles(localDir, 'SKILL.md') },
      sourceDir: localDir,
    });
  }
  return { privateSkills, sharedRootAvailable: true };
}

export async function assertProjectionWritable(source: string, destination: string, marker: string, allowHistoricalAdoption = false): Promise<void> {
  try {
    const stat = await lstat(destination);
    if (stat.isSymbolicLink()) throw new Error('Skill projection destination cannot be a symlink');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    if (error instanceof Error && error.message.includes('symlink')) throw error;
  }
  const owned = marker === PRIVATE_SKILL_MARKER
    ? await hasPrivateSkillMarker(destination)
    : await hasSkillMarker(destination);
  if (allowHistoricalAdoption || owned || await sameSkillTree(source, destination)) return;
  throw new Error('Unowned skill projection conflicts with managed skill');
}

async function hasHistoricalPrivateProjectionProof(
  manifest: Manifest,
  name: string,
  target: 'claude-code' | 'antigravity',
  destination: string,
  homeDir: string,
): Promise<boolean> {
  let content: string;
  try {
    content = await readFile(join(destination, 'SKILL.md'), 'utf8');
  } catch {
    return false;
  }
  if (manifest.items[`skill/${name}`]?.targets[target]?.hash !== historicalSkillHash(content)) return false;

  let files: Map<string, string>;
  try {
    files = await skillFiles(destination);
  } catch {
    return false;
  }
  if (files.size === 1 && files.has('SKILL.md')) return true;

  const peerRoot = target === 'claude-code'
    ? join(homeDir, '.gemini', 'antigravity-cli', 'skills')
    : join(homeDir, '.claude', 'skills');
  const peer = join(peerRoot, name);
  try {
    return await sameSkillTree(destination, peer);
  } catch {
    return false;
  }
}

export async function projectionNeedsUpdate(source: string, destination: string, marker: string): Promise<boolean> {
  try {
    const markerPath = join(destination, marker);
    if (await readFile(markerPath, 'utf8') !== `${marker}\n`) return true;
    return !await sameSkillTree(source, destination);
  } catch {
    return true;
  }
}

export async function hashSkillTree(root: string): Promise<string> {
  const files = await skillFiles(root);
  return createHash('sha256').update(
    [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => `${path}\0${content}\0`).join(''),
    'utf8',
  ).digest('hex');
}

export function hashRenderedSkillTree(content: string, supportFiles: readonly { relativePath: string; content: string }[] = []): string {
  const files = new Map<string, string>([['SKILL.md', content]]);
  for (const file of supportFiles) files.set(file.relativePath, file.content);
  return createHash('sha256').update(
    [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, body]) => `${path}\0${body}\0`).join(''),
    'utf8',
  ).digest('hex');
}

/** Build beside destination then atomically exchange directories. */
export async function replaceSkillTree(source: string, destination: string, marker: string, allowHistoricalAdoption = false): Promise<void> {
  await assertProjectionWritable(source, destination, marker, allowHistoricalAdoption);
  const parent = dirname(destination);
  const stage = join(parent, `.${basename(destination)}.metronome-stage-${crypto.randomUUID()}`);
  const previous = join(parent, `.${basename(destination)}.metronome-previous-${crypto.randomUUID()}`);
  await mkdir(parent, { recursive: true });
  await cp(source, stage, {
    recursive: true,
    filter: (path) => {
      const relativePath = relative(source, path).split(sep).join('/');
      return !path.endsWith(PUBLIC_SKILL_MARKER)
        && !path.endsWith(PRIVATE_SKILL_MARKER)
        && !isIgnoredSupportPath(relativePath);
    },
  });
  await writeFile(join(stage, marker), `${marker}\n`);
  try {
    await rename(destination, previous);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    await rename(stage, destination);
  } catch (error) {
    await rename(previous, destination).catch(() => undefined);
    throw error;
  }
  await rm(previous, { recursive: true, force: true });
}

async function safeHistoricalSharedTree(sharedSkillDir: string, homeDir: string, name: string): Promise<boolean> {
  let files: Map<string, string>;
  try {
    files = await skillFiles(sharedSkillDir);
  } catch {
    return false;
  }
  if (files.size === 1 && files.has('SKILL.md')) return true;
  const peers = [
    join(homeDir, '.claude', 'skills', name),
    join(homeDir, '.config', 'opencode', 'skill', name),
    join(homeDir, '.codex', 'skills', name),
  ];
  for (const peer of peers) {
    if (await hasSkillMarker(peer)) continue;
    try {
      if (await sameSkillTree(sharedSkillDir, peer)) return true;
    } catch { /* unavailable peer cannot prove support-file safety */ }
  }
  return false;
}

async function hasHistoricalPublicProjectionProof(
  manifest: Manifest,
  name: string,
  target: TargetName,
  source: string,
  destination: string,
  homeDir: string,
): Promise<boolean> {
  let content: string;
  try {
    content = await readFile(join(destination, 'SKILL.md'), 'utf8');
  } catch {
    return false;
  }
  const targets = manifest.items[`skill/${name}`]?.targets;
  const hash = historicalSkillHash(content);
  const targetMatches = target === 'opencode' || target === 'codex'
    ? targets?.opencode?.hash === hash || targets?.codex?.hash === hash
    : targets?.[target]?.hash === hash;
  const matchesHistoricalTarget = Object.values(targets ?? {}).some((entry) => entry.hash === hash);

  let files: Map<string, string>;
  try {
    files = await skillFiles(destination);
  } catch {
    return false;
  }
  if (targetMatches && files.size === 1 && files.has('SKILL.md')) return true;
  if (!matchesHistoricalTarget) return false;

  const peers = [
    join(homeDir, '.agents', 'skills', name),
    join(homeDir, '.claude', 'skills', name),
    join(homeDir, '.gemini', 'antigravity-cli', 'skills', name),
    join(homeDir, '.config', 'opencode', 'skill', name),
    join(homeDir, '.codex', 'skills', name),
    join(homeDir, '.gemini', 'skills', name),
  ];
  for (const peer of peers) {
    if (await isSameRealPath(destination, peer) || await isSymbolicLink(peer) || await hasSkillMarker(peer)) continue;
    try {
      const peerPrimary = historicalSkillHash(await readFile(join(peer, 'SKILL.md'), 'utf8'));
      if (peerPrimary === hash && await sameSkillTree(destination, peer)) return true;
    } catch { /* unavailable peer cannot prove support-file safety */ }
  }
  return await safeHistoricalHybridTree(source, destination, peers, new Set(Object.values(targets ?? {}).map((entry) => entry.hash)));
}

async function safeHistoricalHybridTree(
  source: string,
  destination: string,
  peers: readonly string[],
  historicalHashes: ReadonlySet<string>,
): Promise<boolean> {
  let sourceFiles: Map<string, string>;
  let destinationFiles: Map<string, string>;
  try {
    [sourceFiles, destinationFiles] = await Promise.all([skillFiles(source), skillFiles(destination)]);
  } catch {
    return false;
  }
  if (sourceFiles.size !== destinationFiles.size || [...sourceFiles.keys()].some((path) => !destinationFiles.has(path))) return false;

  const provenPeerFiles: Map<string, string>[] = [];
  for (const peer of peers) {
    if (await isSameRealPath(destination, peer) || await isSymbolicLink(peer) || await hasSkillMarker(peer)) continue;
    try {
      const files = await skillFiles(peer);
      const primary = files.get('SKILL.md');
      if (primary !== undefined && historicalHashes.has(historicalSkillHash(primary))) provenPeerFiles.push(files);
    } catch { /* unavailable peer cannot prove support-file safety */ }
  }
  return [...destinationFiles].every(([path, content]) => sourceFiles.get(path) === content
    || provenPeerFiles.some((files) => files.get(path) === content));
}

export async function hasSkillMarker(dir: string): Promise<boolean> {
  return await hasPublicSkillMarker(dir) || await hasPrivateSkillMarker(dir);
}

export async function hasPublicSkillMarker(dir: string): Promise<boolean> {
  try {
    const marker = await readFile(join(dir, PUBLIC_SKILL_MARKER), 'utf8');
    return marker === `${PUBLIC_SKILL_MARKER}\n`;
  } catch {
    return false;
  }
}

export async function hasPrivateSkillMarker(dir: string): Promise<boolean> {
  try {
    const marker = await readFile(join(dir, PRIVATE_SKILL_MARKER), 'utf8');
    return marker === `${PRIVATE_SKILL_MARKER}\n`;
  } catch {
    return false;
  }
}
