import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runCodexProvider } from '../../src/cli/codex-provider';

const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

function seed(projectDir: string, provider: 'enterprise' | 'tux' = 'enterprise'): void {
  const profiles = {
    enterprise: { model: 'gpt-5.6-terra', model_provider: 'openai' },
    tux: { model: 'gpt-5.6-luna', model_provider: 'tux' },
  };
  const selected = profiles[provider];
  const dir = join(projectDir, 'configs', 'settings');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'codex.json'), JSON.stringify({
    ...selected,
    model_providers: {
      tux: { name: 'Tux', base_url: 'http://127.0.0.1:18080/v1', wire_api: 'responses' },
    },
    profile_files: profiles,
    features: { hooks: true },
  }, null, 2) + '\n');
}

describe('codex-provider', () => {
  test('switches canonical and rendered desktop settings to Tux', async () => {
    const projectDir = createTestProject('codex-provider-tux', FIXTURE_ROOT);
    const homeDir = createTestHome('codex-provider-tux');
    seed(projectDir);

    const result = await runCodexProvider('tux', { projectDir, homeDir });
    const canonical = JSON.parse(readFileSync(join(projectDir, 'configs/settings/codex.json'), 'utf8'));
    const rendered = readFileSync(join(homeDir, '.codex/config.toml'), 'utf8');

    expect(result.changed).toBe(true);
    expect(canonical.model_provider).toBe('tux');
    expect(canonical.profile_files.enterprise.model_provider).toBe('openai');
    expect(rendered).toContain('model = "gpt-5.6-luna"');
    expect(rendered).toContain('model_provider = "tux"');
  });

  test('shows current provider without writing', async () => {
    const projectDir = createTestProject('codex-provider-status', FIXTURE_ROOT);
    const homeDir = createTestHome('codex-provider-status');
    seed(projectDir, 'tux');

    const result = await runCodexProvider(undefined, { projectDir, homeDir, json: true });

    expect(result.changed).toBe(false);
    expect(result.provider).toBe('tux');
    expect(result.output).toContain('"provider": "tux"');
  });

  test('rejects unknown providers', async () => {
    const projectDir = createTestProject('codex-provider-invalid', FIXTURE_ROOT);
    seed(projectDir);
    expect(runCodexProvider('api', { projectDir })).rejects.toThrow("Choose: enterprise, tux");
  });
});
