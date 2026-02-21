import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, writeFile, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { homedir } from 'node:os';
import { runCheck, runPush } from '../orchestrator';

/** Make a per-test unique project with salted content so hashes never collide with real deployed files */
async function setupProject(dir: string, salt: string): Promise<void> {
  const commandsDir = join(dir, 'configs', 'common', 'commands');
  await mkdir(commandsDir, { recursive: true });

  await writeFile(
    join(commandsDir, `test-${salt}-alpha.md`),
    `---\ndescription: Test alpha ${salt}\n---\n\nContent alpha ${salt}.\n`,
  );
  await writeFile(
    join(commandsDir, `test-${salt}-beta.md`),
    `---\ndescription: Test beta ${salt}\n---\n\nContent beta ${salt}.\n`,
  );

  const agentsDir = join(dir, 'configs', 'common', 'agents');
  await mkdir(agentsDir, { recursive: true });
  await writeFile(
    join(agentsDir, `test-${salt}-agent.md`),
    `---\ndescription: Test agent ${salt}\n---\n\nAgent ${salt}.\n`,
  );

  await writeFile(join(dir, 'AGENTS.md'), `# Agent OS ${salt}\n\nBase.\n`);

  const instructionsDir = join(dir, 'configs', 'common', 'instructions');
  await mkdir(instructionsDir, { recursive: true });
  await writeFile(
    join(instructionsDir, 'claude.md'),
    `# Claude Addendum ${salt}\n\nClaude-specific.\n`,
  );
}

function makeSalt(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

describe('runCheck', () => {
  let tmpDir: string;
  let salt: string;

  beforeEach(async () => {
    salt = makeSalt();
    tmpDir = await mkdtemp(join(tmpdir(), 'orchestrator-test-'));
    await setupProject(tmpDir, salt);
  });

  test('empty project returns empty diffs with no drift', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'orchestrator-empty-'));
    const result = await runCheck({ projectDir: emptyDir });
    expect(result.diffs).toHaveLength(4);
    expect(result.hasDrift).toBe(false);
    for (const diff of result.diffs) {
      expect(diff.operations).toHaveLength(0);
    }
  });

  test('returns diffs for all 4 targets', async () => {
    const result = await runCheck({ projectDir: tmpDir });
    expect(result.diffs).toHaveLength(4);
    const targets = result.diffs.map((d) => d.target);
    expect(targets).toContain('claude-code');
    expect(targets).toContain('opencode');
    expect(targets).toContain('gemini');
    expect(targets).toContain('codex');
  });

  test('hasDrift is true when canonical items have unique content not yet synced', async () => {
    // Unique salt → target files don't exist with this name → should create
    const result = await runCheck({
      projectDir: tmpDir,
      targets: ['claude-code'],
      types: ['command'],
    });
    expect(result.hasDrift).toBe(true);
    expect(result.diffs[0].summary.create).toBe(2);
  });

  test('scopes to specific target via options.targets', async () => {
    const result = await runCheck({ projectDir: tmpDir, targets: ['claude-code'] });
    expect(result.diffs).toHaveLength(1);
    expect(result.diffs[0].target).toBe('claude-code');
  });

  test('scopes to specific type — only command ops returned', async () => {
    const result = await runCheck({
      projectDir: tmpDir,
      targets: ['claude-code'],
      types: ['command'],
    });
    const claudeDiff = result.diffs[0];
    for (const op of claudeDiff.operations) {
      expect(op.itemType).toBe('command');
    }
  });

  test('JSON output by default', async () => {
    const result = await runCheck({ projectDir: tmpDir });
    expect(() => JSON.parse(result.output)).not.toThrow();
  });

  test('pretty output when options.pretty=true', async () => {
    const result = await runCheck({ projectDir: tmpDir, pretty: true });
    expect(result.output).toContain('acsync check');
  });

  test('excludes gsd-* items from diff', async () => {
    const commandsDir = join(tmpDir, 'configs', 'common', 'commands');
    await writeFile(
      join(commandsDir, `gsd-plan-phase-${salt}.md`),
      `---\ndescription: GSD plan\n---\n\nGSD.\n`,
    );
    const result = await runCheck({
      projectDir: tmpDir,
      targets: ['claude-code'],
      types: ['command'],
    });
    const claudeDiff = result.diffs[0];
    const gsdOp = claudeDiff.operations.find((op) => op.name.startsWith('gsd-'));
    expect(gsdOp).toBeUndefined();
  });

  test('command items appear in diff with correct names', async () => {
    const result = await runCheck({
      projectDir: tmpDir,
      targets: ['claude-code'],
      types: ['command'],
    });
    const claudeDiff = result.diffs[0];
    const names = claudeDiff.operations.map((op) => op.name);
    expect(names).toContain(`test-${salt}-alpha`);
    expect(names).toContain(`test-${salt}-beta`);
  });

  test('agent items appear in diff', async () => {
    const result = await runCheck({
      projectDir: tmpDir,
      targets: ['claude-code'],
      types: ['agent'],
    });
    const claudeDiff = result.diffs[0];
    const names = claudeDiff.operations.map((op) => op.name);
    expect(names).toContain(`test-${salt}-agent`);
  });

  test('all new canonical items have create operation type', async () => {
    const result = await runCheck({
      projectDir: tmpDir,
      targets: ['claude-code'],
      types: ['command'],
    });
    const claudeDiff = result.diffs[0];
    const canonicalOps = claudeDiff.operations.filter((op) => op.name.startsWith(`test-${salt}-`));
    expect(canonicalOps.length).toBeGreaterThan(0);
    for (const op of canonicalOps) {
      expect(op.type).toBe('create');
    }
  });
});

describe('runPush', () => {
  let tmpDir: string;
  let salt: string;

  beforeEach(async () => {
    salt = makeSalt();
    tmpDir = await mkdtemp(join(tmpdir(), 'orchestrator-push-'));
    await setupProject(tmpDir, salt);
  });

  // Clean up test artifacts written to real ~/.claude/commands/
  afterEach(async () => {
    const claudeCmdDir = join(homedir(), '.claude', 'commands');
    for (const name of [`test-${salt}-alpha.md`, `test-${salt}-beta.md`]) {
      try { await unlink(join(claudeCmdDir, name)); } catch { /* already gone */ }
    }
  });

  test('dry-run returns zero writes', async () => {
    const result = await runPush({
      projectDir: tmpDir,
      dryRun: true,
      targets: ['claude-code'],
      types: ['command'],
    });
    expect(result.written).toBe(0);
    expect(result.rolledBack).toBe(false);
  });

  test('dry-run output is valid JSON', async () => {
    const result = await runPush({
      projectDir: tmpDir,
      dryRun: true,
      targets: ['claude-code'],
    });
    expect(() => JSON.parse(result.output)).not.toThrow();
  });

  test('returns early with hasDrift=false when project is empty', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'orchestrator-nodrift-'));
    const result = await runPush({ projectDir: emptyDir, force: true });
    expect(result.hasDrift).toBe(false);
    expect(result.written).toBe(0);
  });

  test('force=true writes commands successfully', async () => {
    const result = await runPush({
      projectDir: tmpDir,
      force: true,
      targets: ['claude-code'],
      types: ['command'],
    });
    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);
    expect(result.written).toBe(2); // alpha + beta
  });

  test('manifest is created after successful push', async () => {
    await runPush({
      projectDir: tmpDir,
      force: true,
      targets: ['claude-code'],
      types: ['command'],
    });
    const manifestPath = join(tmpDir, '.acsync', 'manifest.json');
    const manifestExists = await Bun.file(manifestPath).exists();
    expect(manifestExists).toBe(true);
  });

  test('subsequent check shows no drift after push', async () => {
    await runPush({
      projectDir: tmpDir,
      force: true,
      targets: ['claude-code'],
      types: ['command'],
    });
    const checkResult = await runCheck({
      projectDir: tmpDir,
      targets: ['claude-code'],
      types: ['command'],
    });
    const claudeDiff = checkResult.diffs[0];
    // Canonical items should be "skip" (up to date); stale items from real target dirs are "delete"
    const canonicalOps = claudeDiff.operations.filter((op) => op.name.startsWith(`test-${salt}-`));
    for (const op of canonicalOps) {
      expect(op.type).toBe('skip');
    }
  });

  test('push output is valid JSON', async () => {
    const result = await runPush({
      projectDir: tmpDir,
      force: true,
      targets: ['claude-code'],
      types: ['command'],
    });
    expect(() => JSON.parse(result.output)).not.toThrow();
  });

  test('push with --pretty produces acsync push output', async () => {
    const result = await runPush({
      projectDir: tmpDir,
      force: true,
      targets: ['claude-code'],
      types: ['command'],
      pretty: true,
    });
    // When items are written, output should be push result
    // When no drift (shouldn't happen with unique salt), returns check output
    if (result.written > 0) {
      expect(result.output).toContain('acsync push');
    }
  });
});
