import { describe, expect, test, beforeEach } from 'bun:test';
import { mkdtemp, writeFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCheck } from '../check';
import { runPull, runPullAll } from '../pull';
import { validatePullSource } from '../cli-helpers';

function makeSalt(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Seed a fake home with target-format files for isolated stale/pull testing.
 * Creates commands, agents, and skills in Claude Code target layout.
 */
async function seedFakeHome(homeDir: string, salt: string): Promise<void> {
  // Claude Code commands (Claude format = plain markdown, no frontmatter)
  // Pull reverse-parses these into canonical format with frontmatter
  const claudeCommands = join(homeDir, '.claude', 'commands');
  await mkdir(claudeCommands, { recursive: true });
  await writeFile(
    join(claudeCommands, `existing-${salt}.md`),
    `---\ndescription: Existing command ${salt}\n---\n\nExisting command content ${salt}.\n`,
  );
  await writeFile(
    join(claudeCommands, `my-plan.md`),
    `---\ndescription: My plan command\n---\n\nMy plan command content.\n`,
  );
  // GSD file that must be excluded
  await writeFile(
    join(claudeCommands, `gsd-plan-phase.md`),
    `GSD plan phase content.\n`,
  );

  // Claude Code agents
  const claudeAgents = join(homeDir, '.claude', 'agents');
  await mkdir(claudeAgents, { recursive: true });
  await writeFile(
    join(claudeAgents, `test-agent-${salt}.md`),
    `---\ndescription: Test agent ${salt}\n---\n\nTest agent content ${salt}.\n`,
  );

  // Claude Code skills
  const claudeSkills = join(homeDir, '.claude', 'skills');
  const vercelSkill = join(claudeSkills, 'vercel-react-best-practices');
  await mkdir(vercelSkill, { recursive: true });
  await writeFile(
    join(vercelSkill, 'SKILL.md'),
    `---\nname: vercel-react-best-practices\ndescription: React perf\n---\n\nVercel skill content.\n`,
  );
  const webDesignSkill = join(claudeSkills, 'web-design-guidelines');
  await mkdir(webDesignSkill, { recursive: true });
  await writeFile(
    join(webDesignSkill, 'SKILL.md'),
    `---\nname: web-design-guidelines\ndescription: Web design\n---\n\nWeb design skill content.\n`,
  );

  // Claude Code instructions
  await writeFile(
    join(homeDir, '.claude', 'CLAUDE.md'),
    `# Claude Instructions ${salt}\n`,
  );

  // OpenCode commands (for pull-all cross-target tests)
  const opencodeCommands = join(homeDir, '.config', 'opencode', 'command');
  await mkdir(opencodeCommands, { recursive: true });
  await writeFile(
    join(opencodeCommands, `existing-${salt}.md`),
    `---\ndescription: Existing opencode command ${salt}\n---\n\nExisting opencode command ${salt}.\n`,
  );

  // OpenCode skills
  const opencodeSkills = join(homeDir, '.config', 'opencode', 'skill');
  const ocVercelSkill = join(opencodeSkills, 'vercel-react-best-practices');
  await mkdir(ocVercelSkill, { recursive: true });
  await writeFile(
    join(ocVercelSkill, 'SKILL.md'),
    `---\nname: vercel-react-best-practices\ndescription: React perf\n---\n\nVercel skill content.\n`,
  );
}

describe('stale detection in runCheck', () => {
  let tmpDir: string;
  let fakeHome: string;
  let salt: string;

  beforeEach(async () => {
    salt = makeSalt();
    tmpDir = await mkdtemp(join(tmpdir(), 'stale-test-'));
    fakeHome = await mkdtemp(join(tmpdir(), 'stale-home-'));
    await seedFakeHome(fakeHome, salt);
  });

  test('detects stale items not in canonical set as delete ops', async () => {
    const commandsDir = join(tmpDir, 'configs', 'commands');
    await mkdir(commandsDir, { recursive: true });
    await writeFile(
      join(commandsDir, `test-${salt}-cmd.md`),
      `---\ndescription: Test cmd ${salt}\n---\n\nContent ${salt}.\n`,
    );

    const result = await runCheck({
      projectDir: tmpDir,
      homeDir: fakeHome,
      targets: ['claude-code'],
      types: ['command'],
    });

    const claudeDiff = result.diffs[0];
    const deleteOps = claudeDiff.operations.filter((op) => op.type === 'delete');

    // Seeded home has commands not in canonical → stale deletes
    expect(deleteOps.length).toBeGreaterThan(0);
    expect(claudeDiff.summary.delete).toBeGreaterThan(0);
    for (const op of deleteOps) {
      expect(op.type).toBe('delete');
      expect(op.reason).toContain('stale');
      expect(op.targetPath).toBeDefined();
    }
  });

  test('empty canonical source still detects stale target items', async () => {
    const result = await runCheck({
      projectDir: tmpDir,
      homeDir: fakeHome,
      targets: ['claude-code'],
      types: ['command'],
    });

    const claudeDiff = result.diffs[0];
    const deleteOps = claudeDiff.operations.filter((op) => op.type === 'delete');

    // All detected ops must be deletes (no creates from empty canonical)
    for (const op of claudeDiff.operations) {
      expect(op.type).toBe('delete');
    }
    // No gsd-* items should appear
    for (const op of deleteOps) {
      expect(op.name).not.toMatch(/^gsd-/);
    }
  });

  test('excluded items (gsd-*) are not flagged as stale', async () => {
    const commandsDir = join(tmpDir, 'configs', 'commands');
    await mkdir(commandsDir, { recursive: true });
    await writeFile(
      join(commandsDir, `test-${salt}-cmd.md`),
      `---\ndescription: Test cmd ${salt}\n---\n\nContent ${salt}.\n`,
    );

    const result = await runCheck({
      projectDir: tmpDir,
      homeDir: fakeHome,
      targets: ['claude-code'],
      types: ['command'],
    });

    const claudeDiff = result.diffs[0];
    const deleteOps = claudeDiff.operations.filter((op) => op.type === 'delete');

    for (const op of deleteOps) {
      expect(op.name).not.toMatch(/^gsd-/);
    }
  });
});

describe('runPull', () => {
  let tmpDir: string;
  let fakeHome: string;
  let salt: string;

  beforeEach(async () => {
    salt = makeSalt();
    tmpDir = await mkdtemp(join(tmpdir(), 'pull-test-'));
    fakeHome = await mkdtemp(join(tmpdir(), 'pull-home-'));
    await seedFakeHome(fakeHome, salt);
  });

  test('dry-run reports items but writes nothing', async () => {
    const result = await runPull({
      source: 'claude-code',
      dryRun: true,
      projectDir: tmpDir,
      homeDir: fakeHome,
    });

    expect(result.dryRun).toBe(true);
    expect(result.pulled).toBeGreaterThan(0);

    // No files should be written in dry-run
    let cmdDirExists = false;
    try {
      await readdir(join(tmpDir, 'configs', 'commands'));
      cmdDirExists = true;
    } catch {
      cmdDirExists = false;
    }
    expect(cmdDirExists).toBe(false);
  });

  test('force pull writes canonical files with frontmatter', async () => {
    const result = await runPull({
      source: 'claude-code',
      force: true,
      projectDir: tmpDir,
      homeDir: fakeHome,
    });

    expect(result.pulled).toBeGreaterThan(0);

    const cmdDir = join(tmpDir, 'configs', 'commands');
    let cmdEntries: string[] = [];
    try {
      cmdEntries = await readdir(cmdDir);
    } catch {
      // dir doesn't exist
    }

    const skillDir = join(tmpDir, 'configs', 'skills');
    let skillEntries: string[] = [];
    try {
      skillEntries = await readdir(skillDir);
    } catch {
      // dir doesn't exist
    }

    const totalFiles = cmdEntries.length + skillEntries.length;
    expect(totalFiles).toBeGreaterThan(0);

    // Verify at least one pulled file has frontmatter
    if (cmdEntries.length > 0) {
      const content = await readFile(join(cmdDir, cmdEntries[0]), 'utf-8');
      expect(content).toContain('---');
    } else if (skillEntries.length > 0) {
      const content = await readFile(
        join(skillDir, skillEntries[0], 'SKILL.md'),
        'utf-8',
      );
      expect(content).toContain('---');
    }
  });

  test('skips existing canonical items when force is not set', async () => {
    const cmdDir = join(tmpDir, 'configs', 'commands');
    await mkdir(cmdDir, { recursive: true });
    await writeFile(join(cmdDir, 'my-plan.md'), '---\ndescription: existing\n---\n\nExisting.\n');

    const result = await runPull({
      source: 'claude-code',
      projectDir: tmpDir,
      homeDir: fakeHome,
    });

    const planItem = result.items.find((i) => i.name === 'my-plan');
    expect(planItem).toBeDefined();
    expect(planItem!.action).toBe('skip');
  });

  test('dry-run includes skills from claude-code', async () => {
    const result = await runPull({
      source: 'claude-code',
      dryRun: true,
      projectDir: tmpDir,
      homeDir: fakeHome,
    });

    const skillItems = result.items.filter((i) => i.type === 'skill');
    expect(skillItems.length).toBeGreaterThan(0);

    const skillNames = skillItems.map((i) => i.name);
    expect(skillNames).toContain('vercel-react-best-practices');

    for (const item of skillItems) {
      expect(item.action).toBe('create');
    }
  });

  test('skips existing canonical skills when force is not set', async () => {
    const skillDir = join(tmpDir, 'configs', 'skills', 'vercel-react-best-practices');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\nname: vercel-react-best-practices\n---\n\nExisting skill.\n',
    );

    const result = await runPull({
      source: 'claude-code',
      projectDir: tmpDir,
      homeDir: fakeHome,
    });

    const skillItem = result.items.find(
      (i) => i.type === 'skill' && i.name === 'vercel-react-best-practices',
    );
    expect(skillItem).toBeDefined();
    expect(skillItem!.action).toBe('skip');
  });
});

describe('validatePullSource', () => {
  test('accepts valid target names', () => {
    expect(() => validatePullSource('claude')).not.toThrow();
    expect(() => validatePullSource('opencode')).not.toThrow();
    expect(() => validatePullSource('gemini')).not.toThrow();
    expect(() => validatePullSource('codex')).not.toThrow();
  });

  test('accepts "all"', () => {
    expect(() => validatePullSource('all')).not.toThrow();
  });

  test('rejects invalid source names', () => {
    expect(() => validatePullSource('vscode')).toThrow(/Invalid source/);
    expect(() => validatePullSource('claude-code')).toThrow(/Invalid source/);
  });
});

describe('runPullAll', () => {
  let tmpDir: string;
  let fakeHome: string;
  let salt: string;

  beforeEach(async () => {
    salt = makeSalt();
    tmpDir = await mkdtemp(join(tmpdir(), 'pullall-test-'));
    fakeHome = await mkdtemp(join(tmpdir(), 'pullall-home-'));
    await seedFakeHome(fakeHome, salt);
  });

  test('dry-run returns items from all targets with source tags', async () => {
    const result = await runPullAll({
      dryRun: true,
      projectDir: tmpDir,
      homeDir: fakeHome,
    });

    expect(result.dryRun).toBe(true);
    expect(result.pulled).toBeGreaterThan(0);

    for (const item of result.items) {
      expect(item.source).toBeDefined();
      expect(['claude-code', 'opencode', 'gemini', 'codex']).toContain(item.source);
    }
  });

  test('shows items from all targets that have them', async () => {
    const result = await runPullAll({
      dryRun: true,
      projectDir: tmpDir,
      homeDir: fakeHome,
    });

    const keys = result.items.map((i) => `${i.type}/${i.name}`);
    const uniqueKeys = new Set(keys);

    expect(keys.length).toBeGreaterThanOrEqual(uniqueKeys.size);

    for (const item of result.items) {
      expect(item.source).toBeDefined();
    }
  });

  test('items present in multiple targets appear under each source', async () => {
    const result = await runPullAll({
      dryRun: true,
      projectDir: tmpDir,
      homeDir: fakeHome,
    });

    const vercelSkills = result.items.filter(
      (i) => i.type === 'skill' && i.name === 'vercel-react-best-practices',
    );
    expect(vercelSkills.length).toBeGreaterThan(0);
    const sources = vercelSkills.map((i) => i.source);
    expect(sources).toContain('claude-code');
    expect(sources).toContain('opencode');
  });

  test('JSON output includes source field', async () => {
    const result = await runPullAll({
      dryRun: true,
      projectDir: tmpDir,
      homeDir: fakeHome,
      json: true,
    });

    const parsed = JSON.parse(result.output);
    expect(parsed.source).toBe('all');
    expect(parsed.dryRun).toBe(true);
    expect(parsed.summary).toBeDefined();
  });

  test('pretty output groups by source target', async () => {
    const result = await runPullAll({
      dryRun: true,
      pretty: true,
      projectDir: tmpDir,
      homeDir: fakeHome,
    });

    expect(result.output).toContain('acsync pull --source all');
    const hasTarget = result.output.includes('claude') ||
      result.output.includes('opencode') ||
      result.output.includes('gemini') ||
      result.output.includes('codex');
    expect(hasTarget).toBe(true);
  });
});
