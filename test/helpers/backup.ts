import { mkdtempSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create an isolated fake home directory for E2E tests.
 *
 * Returns a temp dir that mimics ~ — tests pass it as `homeDir` to
 * runPush/runPull/runCheck so adapters resolve paths inside the temp dir
 * instead of touching real ~/.claude, ~/.config/opencode, etc.
 *
 * No backup/restore, no locking, no race conditions. Each test gets
 * its own filesystem — parallel execution is safe by construction.
 */
export function createTestHome(label: string): string {
  return mkdtempSync(join(tmpdir(), `acsync-home-${label}-`));
}

/**
 * Create an isolated project directory with canonical fixtures copied in.
 */
export function createTestProject(label: string, fixtureRoot: string): string {
  const dir = mkdtempSync(join(tmpdir(), `acsync-proj-${label}-`));
  cpSync(join(fixtureRoot, 'canonical'), join(dir, 'configs'), { recursive: true });
  return dir;
}

/**
 * Create an empty project directory (no canonical configs).
 */
export function createEmptyProject(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `acsync-proj-${label}-`));
  mkdirSync(join(dir, 'configs'), { recursive: true });
  return dir;
}

/**
 * Seed a fake home with target-format fixture files for pull tests.
 *
 * Copies push golden fixtures into the correct target paths inside fakeHome.
 */
export function seedTargetFixtures(
  fakeHome: string,
  fixtureRoot: string,
  target: string,
  configType: string,
): void {
  const src = join(fixtureRoot, target, configType);
  const targetDirMap: Record<string, Record<string, string>> = {
    commands: {
      claude: join(fakeHome, '.claude', 'commands'),
      opencode: join(fakeHome, '.config', 'opencode', 'command'),
      gemini: join(fakeHome, '.gemini', 'commands'),
      codex: join(fakeHome, '.codex', 'prompts'),
    },
    agents: {
      claude: join(fakeHome, '.claude', 'agents'),
      opencode: join(fakeHome, '.config', 'opencode', 'agents'),
      gemini: join(fakeHome, '.gemini', 'agents'),
      codex: join(fakeHome, '.codex', 'prompts'),
    },
    skills: {
      claude: join(fakeHome, '.claude', 'skills'),
      opencode: join(fakeHome, '.config', 'opencode', 'skill'),
      gemini: join(fakeHome, '.gemini', 'skills'),
      codex: join(fakeHome, '.codex', 'skills'),
    },
    instructions: {
      claude: join(fakeHome, '.claude'),
      opencode: join(fakeHome, '.config', 'opencode'),
      gemini: join(fakeHome, '.gemini'),
      codex: join(fakeHome, '.codex'),
    },
  };

  const dest = targetDirMap[configType]?.[target === 'claude-code' ? 'claude' : target];
  if (!dest) return;

  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}


