import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Command } from 'commander';
import { atomicWrite } from '../infra/atomic-write';
import { PROJECT_ROOT } from './canonical';
import { runPush } from './push';

const PROVIDERS = ['enterprise', 'tux'] as const;
type CodexProvider = (typeof PROVIDERS)[number];

interface ProviderConfig {
  model?: unknown;
  model_provider?: unknown;
}

interface CodexSettings extends ProviderConfig {
  profile_files?: Record<string, ProviderConfig>;
  [key: string]: unknown;
}

export interface CodexProviderResult {
  provider: CodexProvider;
  model: string;
  changed: boolean;
  output: string;
}

function settingsPath(projectDir: string): string {
  return join(projectDir, 'configs', 'settings', 'codex.json');
}

async function readSettings(projectDir: string): Promise<{ path: string; raw: string; settings: CodexSettings }> {
  const path = settingsPath(projectDir);
  const raw = await readFile(path, 'utf8');
  return { path, raw, settings: JSON.parse(raw) as CodexSettings };
}

function currentProvider(settings: CodexSettings): CodexProvider {
  const match = PROVIDERS.find((name) => settings.model_provider === settings.profile_files?.[name]?.model_provider);
  if (!match) throw new Error(`Unsupported active Codex provider '${String(settings.model_provider)}'.`);
  return match;
}

function profile(settings: CodexSettings, provider: CodexProvider): { model: string; modelProvider: string } {
  const config = settings.profile_files?.[provider];
  if (typeof config?.model !== 'string' || typeof config.model_provider !== 'string') {
    throw new Error(`Codex profile '${provider}' is missing model or model_provider.`);
  }
  return { model: config.model, modelProvider: config.model_provider };
}

function formatResult(provider: CodexProvider, model: string, changed: boolean, json: boolean): string {
  if (json) return JSON.stringify({ provider, model, changed }, null, 2) + '\n';
  const state = changed ? 'switched' : 'active';
  return [
    `Codex desktop provider ${state}: ${provider} (${model})`,
    'Restart the ChatGPT/Codex app or start a new desktop session.',
    'Desktop history is filtered by provider; switching does not delete chats.',
    '',
  ].join('\n');
}

export async function runCodexProvider(
  requested?: string,
  options: { projectDir?: string; homeDir?: string; json?: boolean } = {},
): Promise<CodexProviderResult> {
  const projectDir = options.projectDir ?? PROJECT_ROOT;
  const { path, raw, settings } = await readSettings(projectDir);
  const provider = requested ?? currentProvider(settings);
  if (!PROVIDERS.includes(provider as CodexProvider)) {
    throw new Error(`Unknown provider '${provider}'. Choose: ${PROVIDERS.join(', ')}.`);
  }

  const selected = provider as CodexProvider;
  const target = profile(settings, selected);
  const changed = settings.model !== target.model || settings.model_provider !== target.modelProvider;
  if (changed) {
    settings.model = target.model;
    settings.model_provider = target.modelProvider;
    await atomicWrite(path, JSON.stringify(settings, null, 2) + '\n');
    try {
      const pushed = await runPush({
        projectDir,
        homeDir: options.homeDir,
        targets: ['codex'],
        types: ['settings'],
        force: true,
      });
      if (pushed.failed > 0 || pushed.rolledBack) throw new Error('Codex settings push failed.');
    } catch (error) {
      await atomicWrite(path, raw);
      throw error;
    }
  }

  return {
    provider: selected,
    model: target.model,
    changed,
    output: formatResult(selected, target.model, changed, options.json ?? false),
  };
}

export const codexProviderCommand = new Command('codex-provider')
  .description('Show or switch the provider used by the ChatGPT/Codex desktop app.')
  .argument('[provider]', 'enterprise or tux')
  .option('--json', 'Machine-readable output')
  .action(async (provider: string | undefined, options: { json?: boolean }) => {
    try {
      const result = await runCodexProvider(provider, options);
      process.stdout.write(result.output);
    } catch (error) {
      process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    }
  });
