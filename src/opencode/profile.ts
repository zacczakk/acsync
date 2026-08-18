import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readlink, rm, stat, symlink, unlink } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { atomicWrite } from '../infra/atomic-write';
import { stringifyFrontmatter } from '../formats/markdown';
import { readJsonc } from '../formats/jsonc';
import { isCanonicalAgentForTarget, readCanonicalAgents, readCanonicalMCPServers } from '../cli/canonical';
import {
  applyOpenCodeAgentVariants,
  configureOpenCodeV2Plugins,
  mergeOpenCodeSettings,
  renderOpenCodeAgent,
  renderOpenCodeMcp,
  renderOpenCodeSettings,
  type OpenCodeModelVariant,
  type OpenCodeVersion,
} from './version-renderer';

const MANAGED_GLOBAL_PLUGINS = [
  'instructions-loader.ts',
  'memory-vault-advisor.ts',
  'muxy-notify.js',
  'read-guard.ts',
  'validate-commit.ts',
];

const V2_MUXY_PLUGIN_NAME = 'metronome-muxy-notify.js';

interface ManifestHistory {
  timestamp: string;
  from: OpenCodeVersion | 'unknown';
  to: OpenCodeVersion;
  backup: string;
  files: Record<string, string>;
  plugins: Record<string, 'active' | 'inactive' | 'unsupported'>;
  sdk?: string;
  cursorTarget?: string;
}

interface MigrationManifest {
  version: 1;
  active: OpenCodeVersion;
  history: ManifestHistory[];
}

export interface SwitchOpenCodeOptions {
  version: OpenCodeVersion;
  projectDir: string;
  homeDir: string;
  now?: Date;
  dryRun?: boolean;
  prepare?: () => Promise<void>;
  rollback?: () => Promise<void>;
  verifyPlugins?: () => Promise<string[]>;
  progress?: (message: string) => void;
}

export interface SwitchOpenCodeResult {
  version: OpenCodeVersion;
  backupPath: string;
  manifestPath: string;
  written: string[];
}

function hash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function formatDuration(milliseconds: number): string {
  return milliseconds < 1_000 ? `${milliseconds}ms` : `${(milliseconds / 1_000).toFixed(1)}s`;
}

async function timedStage<T>(
  progress: ((message: string) => void) | undefined,
  label: string,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  progress?.(`${label}...`);
  const heartbeat = progress
    ? setInterval(() => progress(`${label} still running (${formatDuration(Date.now() - startedAt)})`), 5_000)
    : undefined;
  try {
    const result = await operation();
    progress?.(`${label} done (${formatDuration(Date.now() - startedAt)})`);
    return result;
  } catch (error) {
    progress?.(`${label} failed (${formatDuration(Date.now() - startedAt)})`);
    throw error;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function readOpenCodeConfig(path: string): Promise<Record<string, unknown>> {
  try {
    return readJsonc<Record<string, unknown>>(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw new Error(`Unable to parse OpenCode config ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readManifest(path: string): Promise<MigrationManifest | undefined> {
  const parsed = await readJson(path);
  if (parsed.version !== 1 || (parsed.active !== 'v1' && parsed.active !== 'v2') || !Array.isArray(parsed.history)) return undefined;
  return parsed as unknown as MigrationManifest;
}

async function backupPath(source: string, root: string, homeDir: string): Promise<void> {
  try {
    const info = await stat(source);
    const destination = join(root, relative(homeDir, source));
    await mkdir(dirname(destination), { recursive: true });
    if (info.isDirectory()) await cp(source, destination, { recursive: true, dereference: false });
    else await cp(source, destination, { dereference: false });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}

function protectedPaths(homeDir: string): string[] {
  const global = join(homeDir, '.config', 'opencode');
  return [
    join(global, 'opencode.json'),
    join(global, 'migration-manifest.json'),
    join(global, 'agents'),
    join(global, 'plugins'),
    join(global, 'chatgpt-websearch'),
    join(global, 'package.json'),
    join(global, 'package-lock.json'),
    join(global, 'bun.lock'),
    join(global, 'cli.json'),
    join(global, 'tui.json'),
    join(homeDir, '.opencode', 'plugins'),
    join(homeDir, '.opencode', 'package.json'),
    join(homeDir, '.opencode', 'package-lock.json'),
  ];
}

async function createCompleteBackup(homeDir: string, backupRoot: string): Promise<void> {
  for (const path of protectedPaths(homeDir)) await backupPath(path, backupRoot, homeDir);
}

async function restoreCompleteBackup(homeDir: string, backupRoot: string): Promise<void> {
  for (const target of protectedPaths(homeDir)) {
    const source = join(backupRoot, relative(homeDir, target));
    let backedUp = false;
    try {
      await lstat(source);
      backedUp = true;
    } catch {}
    await rm(target, { recursive: true, force: true });
    if (!backedUp) continue;
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target, { recursive: true, dereference: false });
  }
}

async function renderAgents(projectDir: string, version: OpenCodeVersion): Promise<{ files: Map<string, string>; variants: OpenCodeModelVariant[] }> {
  const target = version === 'v2' ? 'opencode2' : 'opencode';
  const agents = (await readCanonicalAgents(projectDir, () => false))
    .filter((agent) => isCanonicalAgentForTarget(agent, target));
  const files = new Map<string, string>();
  const variants: OpenCodeModelVariant[] = [];
  for (const agent of agents) {
    const metadata = renderOpenCodeAgent({ ...agent.metadata, _agentName: agent.name }, version);
    const descriptor = metadata._modelVariant;
    delete metadata._modelVariant;
    if (descriptor && typeof descriptor === 'object') variants.push(descriptor as OpenCodeModelVariant);
    files.set(`${agent.name}.md`, stringifyFrontmatter(agent.content, metadata));
  }
  return { files, variants };
}

async function deployPlugins(options: SwitchOpenCodeOptions, written: string[]): Promise<void> {
  const globalDir = join(options.homeDir, '.config', 'opencode', 'plugins');
  await mkdir(globalDir, { recursive: true });
  const sourceDir = options.version === 'v1'
    ? join(options.projectDir, 'configs', 'plugins')
    : join(options.projectDir, 'configs', 'opencode', 'v2', 'plugins');
  const nativeMuxy = await readFile(join(options.projectDir, 'configs', 'opencode', 'v2', 'plugins', 'muxy-notify.js'), 'utf8');
  const active = options.version === 'v1'
    ? ['memory-vault-advisor.ts', 'read-guard.ts', 'validate-commit.ts']
    : MANAGED_GLOBAL_PLUGINS;
  for (const name of MANAGED_GLOBAL_PLUGINS) {
    const targetName = options.version === 'v2' && name === 'muxy-notify.js' ? V2_MUXY_PLUGIN_NAME : name;
    const target = join(globalDir, targetName);
    if (!active.includes(name)) {
      if (options.version === 'v1' && name === 'muxy-notify.js') {
        try { await unlink(join(globalDir, V2_MUXY_PLUGIN_NAME)); } catch {}
        try {
          if (await readFile(target, 'utf8') === nativeMuxy) await unlink(target);
        } catch {}
      } else {
        try { await unlink(target); } catch {}
      }
      continue;
    }
    const content = await readFile(join(sourceDir, name), 'utf8');
    await atomicWrite(target, content);
    written.push(target);
    if (options.version === 'v2' && name === 'muxy-notify.js') {
      const legacyTarget = join(globalDir, name);
      try {
        if (await readFile(legacyTarget, 'utf8') === content) await unlink(legacyTarget);
      } catch {}
    }
  }

}

async function switchCursorPlugin(homeDir: string, version: OpenCodeVersion, previous?: MigrationManifest): Promise<string | undefined> {
  const link = join(homeDir, '.config', 'opencode', 'plugins', 'cursor-oauth.js');
  let target: string | undefined;
  try {
    if ((await lstat(link)).isSymbolicLink()) target = await readlink(link);
  } catch {}
  target ??= [...(previous?.history ?? [])].reverse().find((entry) => entry.cursorTarget)?.cursorTarget;
  if (version === 'v2') {
    try { await unlink(link); } catch {}
  } else if (target) {
    try { await lstat(link); } catch { await symlink(target, link); }
  }
  return target;
}

async function installedSdkVersion(configDir: string): Promise<string | undefined> {
  const pkg = await readJson(join(configDir, 'node_modules', '@opencode-ai', 'plugin', 'package.json'));
  return typeof pkg.version === 'string' ? pkg.version : undefined;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

async function observeV1Plugins(homeDir: string, settings: Record<string, unknown>): Promise<Record<string, 'active' | 'inactive'>> {
  const globalPlugins = join(homeDir, '.config', 'opencode', 'plugins');
  const configured = Array.isArray(settings.plugin) ? settings.plugin : [];
  return {
    'memory-vault-advisor': await pathExists(join(globalPlugins, 'memory-vault-advisor.ts')) ? 'active' : 'inactive',
    'read-guard': await pathExists(join(globalPlugins, 'read-guard.ts')) ? 'active' : 'inactive',
    'validate-commit': await pathExists(join(globalPlugins, 'validate-commit.ts')) ? 'active' : 'inactive',
    'muxy-notify': await pathExists(join(homeDir, '.opencode', 'plugins', 'muxy-notify.js')) ? 'active' : 'inactive',
    'cursor-oauth': await pathExists(join(globalPlugins, 'cursor-oauth.js')) ? 'active' : 'inactive',
    'context-mode': configured.includes('context-mode') ? 'active' : 'inactive',
  };
}

export async function switchOpenCodeVersion(options: SwitchOpenCodeOptions): Promise<SwitchOpenCodeResult> {
  const configDir = join(options.homeDir, '.config', 'opencode');
  const configPath = join(configDir, 'opencode.json');
  const manifestPath = join(configDir, 'migration-manifest.json');
  const timestamp = (options.now ?? new Date()).toISOString().replace(/[:.]/g, '-');
  const previousManifest = await readManifest(manifestPath);
  const from = previousManifest?.active ?? 'unknown';
  const backupRoot = join(options.homeDir, '.config', 'opencode-backups', 'metronome', `${timestamp}-${from}-to-${options.version}`);
  if (options.dryRun) return { version: options.version, backupPath: backupRoot, manifestPath, written: [] };

  await timedStage(options.progress, `Back up current OpenCode state to ${backupRoot}`, () => createCompleteBackup(options.homeDir, backupRoot));
  const written: string[] = [];
  try {
    if (options.prepare) {
      await timedStage(options.progress, `Prepare OpenCode ${options.version.toUpperCase()} dependencies`, options.prepare);
    }
    const renderedState = await timedStage(options.progress, `Render and write OpenCode ${options.version.toUpperCase()} profile`, async () => {
      const canonical = await readJson(join(options.projectDir, 'configs', 'settings', 'opencode.json'));
      const existing = await readOpenCodeConfig(configPath);
      const mcp = await readCanonicalMCPServers(options.projectDir);
      const renderedAgents = await renderAgents(options.projectDir, options.version);
      let rendered = renderOpenCodeSettings(canonical, options.version);
      rendered.mcp = renderOpenCodeMcp(mcp, options.version);
      if (options.version === 'v2') {
        rendered = applyOpenCodeAgentVariants(rendered, renderedAgents.variants);
        configureOpenCodeV2Plugins(rendered, existing);
      }
      const merged = mergeOpenCodeSettings(existing, rendered, options.version);
      await mkdir(join(configDir, 'agents'), { recursive: true });
      await atomicWrite(configPath, `${JSON.stringify(merged, null, 2)}\n`);
      written.push(configPath);
      for (const [name, content] of renderedAgents.files) {
        const path = join(configDir, 'agents', name);
        await atomicWrite(path, content);
        written.push(path);
      }
      await deployPlugins(options, written);
      const cursorTarget = await switchCursorPlugin(options.homeDir, options.version, previousManifest);
      return { merged, cursorTarget };
    });
    const observedPlugins = options.verifyPlugins
      ? await timedStage(options.progress, 'Verify OpenCode plugin catalog', options.verifyPlugins)
      : undefined;
    const files: Record<string, string> = {};
    for (const path of written) files[relative(options.homeDir, path)] = hash(await readFile(path, 'utf8'));
    const sdk = await installedSdkVersion(configDir);
    const history: ManifestHistory = {
      timestamp: (options.now ?? new Date()).toISOString(),
      from,
      to: options.version,
      backup: backupRoot,
      files,
      plugins: options.version === 'v1' ? await observeV1Plugins(options.homeDir, renderedState.merged) : {
        'metronome.instructions-loader': observedPlugins?.includes('metronome.instructions-loader') ? 'active' : 'inactive',
        'memory-vault-advisor': observedPlugins?.includes('memory-vault-advisor') ? 'active' : 'inactive',
        'metronome.read-guard': observedPlugins?.includes('metronome.read-guard') ? 'active' : 'inactive',
        'metronome.validate-commit': observedPlugins?.includes('metronome.validate-commit') ? 'active' : 'inactive',
        'metronome.muxy-notify': observedPlugins?.includes('metronome.muxy-notify') ? 'active' : 'inactive',
        'opencode.chatgpt-websearch': observedPlugins?.includes('opencode.chatgpt-websearch') ? 'active' : 'inactive',
        'cursor-oauth': 'unsupported',
        'context-mode': 'unsupported',
      },
      ...(sdk ? { sdk } : {}),
      ...(renderedState.cursorTarget ? { cursorTarget: renderedState.cursorTarget } : {}),
    };
    const manifest: MigrationManifest = { version: 1, active: options.version, history: [...(previousManifest?.history ?? []), history] };
    await timedStage(options.progress, 'Record migration manifest', async () => {
      await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      written.push(manifestPath);
    });
    return { version: options.version, backupPath: backupRoot, manifestPath, written };
  } catch (error) {
    await timedStage(options.progress, 'Restore previous OpenCode state', async () => {
      await restoreCompleteBackup(options.homeDir, backupRoot);
      await options.rollback?.();
    });
    throw error;
  }
}

export async function getOpenCodeVersionStatus(homeDir: string): Promise<MigrationManifest | undefined> {
  return readManifest(join(homeDir, '.config', 'opencode', 'migration-manifest.json'));
}
