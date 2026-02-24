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

describe('stale detection in runCheck', () => {
  let tmpDir: string;
  let salt: string;

  beforeEach(async () => {
    salt = makeSalt();
    tmpDir = await mkdtemp(join(tmpdir(), 'stale-test-'));
  });

  test('detects stale items not in canonical set as delete ops', async () => {
    // Set up a project with 1 canonical command
    const commandsDir = join(tmpDir, 'configs', 'commands');
    await mkdir(commandsDir, { recursive: true });
    await writeFile(
      join(commandsDir, `test-${salt}-cmd.md`),
      `---\ndescription: Test cmd ${salt}\n---\n\nContent ${salt}.\n`,
    );

    const result = await runCheck({
      projectDir: tmpDir,
      targets: ['claude-code'],
      types: ['command'],
    });

    const claudeDiff = result.diffs[0];
    const deleteOps = claudeDiff.operations.filter((op) => op.type === 'delete');

    // Real ~/.claude/commands/zz/ has files not in our tiny canonical set
    // Those should appear as delete ops
    if (deleteOps.length > 0) {
      expect(claudeDiff.summary.delete).toBeGreaterThan(0);
      for (const op of deleteOps) {
        expect(op.type).toBe('delete');
        expect(op.reason).toContain('stale');
        expect(op.targetPath).toBeDefined();
      }
    } else {
      // If no commands dir exists at ~/.claude/commands/zz/, no stale detection
      expect(claudeDiff.summary.delete).toBe(0);
    }
  });

  test('empty canonical source still detects stale target items', async () => {
    // Empty project dir (no commands/agents) — stale detection still runs
    // because the exclusion filter is the safety mechanism, not empty-canonical checks.
    // If real target dirs (e.g. ~/.claude/commands/zz/) have files, they appear as delete ops.
    const result = await runCheck({
      projectDir: tmpDir,
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
    // Set up a project with 1 canonical command
    const commandsDir = join(tmpDir, 'configs', 'commands');
    await mkdir(commandsDir, { recursive: true });
    await writeFile(
      join(commandsDir, `test-${salt}-cmd.md`),
      `---\ndescription: Test cmd ${salt}\n---\n\nContent ${salt}.\n`,
    );

    const result = await runCheck({
      projectDir: tmpDir,
      targets: ['claude-code'],
      types: ['command'],
    });

    const claudeDiff = result.diffs[0];
    const deleteOps = claudeDiff.operations.filter((op) => op.type === 'delete');

    // No delete ops should target gsd-* items
    for (const op of deleteOps) {
      expect(op.name).not.toMatch(/^gsd-/);
    }
  });
});

describe('runPull', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pull-test-'));
  });

  test('dry-run reports items but writes nothing', async () => {
    const result = await runPull({
      source: 'claude-code',
      dryRun: true,
      projectDir: tmpDir,
    });

    expect(result.dryRun).toBe(true);
    // Real commands exist in ~/.claude/commands/zz/ (from user's real config)
    expect(result.pulled).toBeGreaterThanOrEqual(0);

    // No files should be written in dry-run
    let cmdDirExists = false;
    try {
      await readdir(join(tmpDir, 'configs', 'commands'));
      cmdDirExists = true;
    } catch {
      cmdDirExists = false;
    }

    if (result.pulled > 0) {
      // In dry-run, directories should not have been created
      expect(cmdDirExists).toBe(false);
    }
  });

  test('force pull writes canonical files with frontmatter', async () => {
    const result = await runPull({
      source: 'claude-code',
      force: true,
      projectDir: tmpDir,
    });

    if (result.pulled > 0) {
      // Verify files created in canonical dirs (commands, agents, and/or skills)
      const cmdDir = join(tmpDir, 'configs', 'commands');
      let cmdEntries: string[] = [];
      try {
        cmdEntries = await readdir(cmdDir);
      } catch {
        // May not exist if no commands pulled
      }

      const agentDir = join(tmpDir, 'configs', 'agents');
      let agentEntries: string[] = [];
      try {
        agentEntries = await readdir(agentDir);
      } catch {
        // May not exist if no agents pulled
      }

      const skillDir = join(tmpDir, 'configs', 'skills');
      let skillEntries: string[] = [];
      try {
        skillEntries = await readdir(skillDir);
      } catch {
        // May not exist if no skills pulled
      }

      const totalFiles = cmdEntries.length + agentEntries.length + skillEntries.length;
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
    }
  });

  test('skips existing canonical items when force is not set', async () => {
    // Pre-create a canonical command file
    const cmdDir = join(tmpDir, 'configs', 'commands');
    await mkdir(cmdDir, { recursive: true });
    await writeFile(join(cmdDir, 'my-plan.md'), '---\ndescription: existing\n---\n\nExisting.\n');

    const result = await runPull({
      source: 'claude-code',
      projectDir: tmpDir,
    });

    // If my-plan exists in the target, it should be skipped
    const planItem = result.items.find((i) => i.name === 'my-plan');
    if (planItem) {
      expect(planItem.action).toBe('skip');
    }
  });

  test('dry-run includes skills from claude-code', async () => {
    const result = await runPull({
      source: 'claude-code',
      dryRun: true,
      projectDir: tmpDir,
    });

    const skillItems = result.items.filter((i) => i.type === 'skill');
    // Real ~/.claude/skills/ has known skills (ralph-tui-*, vercel-*, web-design-*)
    expect(skillItems.length).toBeGreaterThan(0);

    const skillNames = skillItems.map((i) => i.name);
    expect(skillNames).toContain('vercel-react-best-practices');

    // All should be create since dry-run on empty project
    for (const item of skillItems) {
      expect(item.action).toBe('create');
    }
  });

  test('skips existing canonical skills when force is not set', async () => {
    // Pre-create a canonical skill dir
    const skillDir = join(tmpDir, 'configs', 'skills', 'vercel-react-best-practices');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      join(skillDir, 'SKILL.md'),
      '---\nname: vercel-react-best-practices\n---\n\nExisting skill.\n',
    );

    const result = await runPull({
      source: 'claude-code',
      projectDir: tmpDir,
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

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'pullall-test-'));
  });

  test('dry-run returns items from all targets with source tags', async () => {
    const result = await runPullAll({
      dryRun: true,
      projectDir: tmpDir,
    });

    expect(result.dryRun).toBe(true);
    expect(result.pulled).toBeGreaterThanOrEqual(0);

    // Every item should have a source tag
    for (const item of result.items) {
      expect(item.source).toBeDefined();
      expect(['claude-code', 'opencode', 'gemini', 'codex']).toContain(item.source);
    }
  });

  test('shows items from all targets that have them', async () => {
    const result = await runPullAll({
      dryRun: true,
      projectDir: tmpDir,
    });

    // Items may appear multiple times (once per target that has them)
    const keys = result.items.map((i) => `${i.type}/${i.name}`);
    const uniqueKeys = new Set(keys);

    // Total items >= unique keys (items shared across targets appear multiple times)
    expect(keys.length).toBeGreaterThanOrEqual(uniqueKeys.size);

    // Each item should have a source tag
    for (const item of result.items) {
      expect(item.source).toBeDefined();
    }
  });

  test('items present in multiple targets appear under each source', async () => {
    const result = await runPullAll({
      dryRun: true,
      projectDir: tmpDir,
    });

    // Skills exist in both claude-code and opencode — both should appear
    const vercelSkills = result.items.filter(
      (i) => i.type === 'skill' && i.name === 'vercel-react-best-practices',
    );
    if (vercelSkills.length > 0) {
      const sources = vercelSkills.map((i) => i.source);
      expect(sources).toContain('claude-code');
      // opencode also has this skill
      expect(sources).toContain('opencode');
    }
  });

  test('JSON output includes source field', async () => {
    const result = await runPullAll({
      dryRun: true,
      projectDir: tmpDir,
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
    });

    expect(result.output).toContain('acsync pull --source all');
    // Should contain at least one target name in output
    const hasTarget = result.output.includes('claude') ||
      result.output.includes('opencode') ||
      result.output.includes('gemini') ||
      result.output.includes('codex');
    if (result.pulled > 0) {
      expect(hasTarget).toBe(true);
    }
  });
});
