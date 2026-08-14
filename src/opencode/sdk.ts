import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string, args: string[], cwd?: string) => Promise<CommandResult>;

export const runCommand: CommandRunner = (command, args, cwd) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += String(chunk); });
  child.stderr.on('data', (chunk) => { stderr += String(chunk); });
  child.on('error', reject);
  child.on('close', (code) => {
    if (code === 0) resolve({ stdout, stderr });
    else reject(new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr.trim()}`));
  });
});

function runVerificationCommand(command: string, args: string[], cwd?: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${command} ${args.join(' ')} timed out`));
    }, 2_000);
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(' ')} failed (${code}): ${stderr.trim()}`));
    });
  });
}

export function parseGlobalOpenCodeVersion(output: string): string | undefined {
  return output.match(/@opencode-ai\/cli@(0\.0\.0-(?:next|beta)-[^\s]+)/)?.[1];
}

export async function installedGlobalOpenCodeVersion(runner: CommandRunner = runCommand): Promise<string> {
  const result = await runner('bun', ['pm', 'ls', '-g']);
  const version = parseGlobalOpenCodeVersion(`${result.stdout}\n${result.stderr}`);
  if (!version) throw new Error('Unable to find global @opencode-ai/cli next/beta installation');
  return version;
}

export async function alignOpenCodePluginSdk(configDir: string, runner: CommandRunner = runCommand): Promise<string> {
  const version = await installedGlobalOpenCodeVersion(runner);
  const [declared, installed] = await Promise.all([
    readPackageDependencyVersion(join(configDir, 'package.json')),
    readPackageVersion(join(configDir, 'node_modules', '@opencode-ai', 'plugin', 'package.json')),
  ]);
  if (declared === version && installed === version) return version;
  await runner('bun', ['add', '--exact', '--minimum-release-age=0', `@opencode-ai/plugin@${version}`], configDir);
  return version;
}

async function readPackageVersion(path: string): Promise<string | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : undefined;
  } catch {
    return undefined;
  }
}

async function readPackageDependencyVersion(path: string): Promise<string | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as { dependencies?: Record<string, unknown> };
    const version = parsed.dependencies?.['@opencode-ai/plugin'];
    return typeof version === 'string' ? version : undefined;
  } catch {
    return undefined;
  }
}

export async function updateOpenCodeV2(_configDir: string, runner: CommandRunner = runCommand): Promise<string> {
  await runner('bun', ['install', '-g', '--force', '--trust', '--minimum-release-age=0', '@opencode-ai/cli@next']);
  return installedGlobalOpenCodeVersion(runner);
}

export async function updateOpenCodeV2Safely(
  configDir: string,
  activate: (version: string) => Promise<void>,
  runner: CommandRunner = runCommand,
): Promise<string> {
  const previous = await installedGlobalOpenCodeVersion(runner);
  let resolved: string;
  try {
    resolved = await updateOpenCodeV2(configDir, runner);
    await activate(resolved);
  } catch (error) {
    try {
      await runner('bun', ['install', '-g', '--force', '--trust', '--minimum-release-age=0', `@opencode-ai/cli@${previous}`]);
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], `OpenCode V2 activation failed and global CLI ${previous} could not be restored`);
    }
    throw error;
  }
  return resolved;
}

export const REQUIRED_V2_PLUGIN_IDS = [
  'metronome.instructions-loader',
  'memory-vault-advisor',
  'metronome.read-guard',
  'metronome.validate-commit',
  'metronome.muxy-notify',
  'opencode.chatgpt-websearch',
];

export interface PluginVerificationProgress {
  attempt: number;
  attempts: number;
  status: 'retrying' | 'ready';
  missing: string[];
  attemptMs: number;
  elapsedMs: number;
  failure?: 'request-failed' | 'invalid-response';
}

export type PluginVerificationReporter = (progress: PluginVerificationProgress) => void;

export function parsePluginIDs(output: string): string[] {
  const parsed = JSON.parse(output) as unknown;
  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'data' in parsed && Array.isArray(parsed.data) ? parsed.data : [];
  return entries.flatMap((entry) => entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string' ? [entry.id] : []);
}

export async function restartAndVerifyOpenCodeV2(
  runner: CommandRunner = runVerificationCommand,
  attempts = 60,
  intervalMs = 500,
  onProgress?: PluginVerificationReporter,
): Promise<string[]> {
  try {
    await runner('opencode2', ['service', 'restart']);
  } catch {
    // Restart closes its own client connection; readiness is proven by the API loop below.
  }
  return verifyOpenCodeV2Plugins(runner, attempts, intervalMs, onProgress);
}

export async function verifyOpenCodeV2Plugins(
  runner: CommandRunner = runVerificationCommand,
  attempts = 60,
  intervalMs = 500,
  onProgress?: PluginVerificationReporter,
): Promise<string[]> {
  let missing = [...REQUIRED_V2_PLUGIN_IDS];
  const startedAt = Date.now();
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const attemptStartedAt = Date.now();
    let ids: string[] = [];
    let failure: PluginVerificationProgress['failure'];
    try {
      const result = await runner('opencode2', ['api', 'get', '/api/plugin']);
      try {
        ids = parsePluginIDs(result.stdout);
      } catch {
        failure = 'invalid-response';
      }
    } catch {
      failure = 'request-failed';
    }
    missing = REQUIRED_V2_PLUGIN_IDS.filter((id) => !ids.includes(id));
    const ready = missing.length === 0;
    onProgress?.({
      attempt: attempt + 1,
      attempts,
      status: ready ? 'ready' : 'retrying',
      missing,
      attemptMs: Date.now() - attemptStartedAt,
      elapsedMs: Date.now() - startedAt,
      ...(failure ? { failure } : {}),
    });
    if (ready) return ids;
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`OpenCode V2 did not activate required plugins after ${attempts} attempt(s) in ${Date.now() - startedAt}ms: ${missing.join(', ')}. Check \`opencode2 api get /api/plugin\` and the OpenCode service logs.`);
}
