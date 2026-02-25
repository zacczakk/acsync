import { describe, expect, test, beforeEach } from 'bun:test';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCheck } from '../check';

/** Make a per-test unique project with salted content so hashes never collide with real deployed files */
async function setupProject(dir: string, salt: string): Promise<void> {
  const commandsDir = join(dir, 'configs', 'commands');
  await mkdir(commandsDir, { recursive: true });

  await writeFile(
    join(commandsDir, `test-${salt}-alpha.md`),
    `---\ndescription: Test alpha ${salt}\n---\n\nContent alpha ${salt}.\n`,
  );
  await writeFile(
    join(commandsDir, `test-${salt}-beta.md`),
    `---\ndescription: Test beta ${salt}\n---\n\nContent beta ${salt}.\n`,
  );

  const agentsDir = join(dir, 'configs', 'agents');
  await mkdir(agentsDir, { recursive: true });
  await writeFile(
    join(agentsDir, `test-${salt}-agent.md`),
    `---\ndescription: Test agent ${salt}\n---\n\nAgent ${salt}.\n`,
  );

  const instructionsDir = join(dir, 'configs', 'instructions');
  await mkdir(instructionsDir, { recursive: true });
  await writeFile(
    join(instructionsDir, 'AGENTS.md'),
    `# Agent OS ${salt}\n\nBase.\n\n## CLI-Specific Notes\n\n### Claude Code\n\nClaude-specific ${salt}.\n`,
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

  test('empty project detects stale target items as drift', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'orchestrator-empty-'));
    const result = await runCheck({ projectDir: emptyDir });
    expect(result.diffs).toHaveLength(4);
    // Empty canonical against real target dirs: all target items are stale (delete ops)
    for (const diff of result.diffs) {
      for (const op of diff.operations) {
        expect(op.type).toBe('delete');
      }
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

  test('pretty output by default', async () => {
    const result = await runCheck({ projectDir: tmpDir });
    expect(result.output).toContain('acsync check');
  });

  test('JSON output when options.json=true', async () => {
    const result = await runCheck({ projectDir: tmpDir, json: true });
    expect(() => JSON.parse(result.output)).not.toThrow();
  });

  test('excludes gsd-* items from diff', async () => {
    const commandsDir = join(tmpDir, 'configs', 'commands');
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
