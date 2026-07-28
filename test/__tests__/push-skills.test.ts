import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTestHome, createTestProject } from '../helpers/backup';
import { runPush } from '../../src/cli/push';
import { runCheck } from '../../src/cli/check';
import { hasSkillMarker } from '../../src/core/skill-projection';

const E2E_TIMEOUT = 60_000;
const FIXTURE_ROOT = join(import.meta.dir, '../fixtures');

/** Target output paths inside a fakeHome. */
function targetPaths(fakeHome: string) {
  return {
    claude: join(fakeHome, '.claude', 'skills'),
    opencode: join(fakeHome, '.agents', 'skills'),
    antigravity: join(fakeHome, '.gemini', 'antigravity-cli', 'skills'),
    codex: join(fakeHome, '.agents', 'skills'),
  };
}

describe('push-skills E2E', () => {
  for (const [target, rootName, manifestTarget] of [
    ['claude-code', 'claude', 'claude-code'],
    ['antigravity', 'antigravity', 'antigravity'],
  ] as const) {
    test(`adopts an unmarked ${target} public projection proven by its historical manifest target`, async () => {
      const fakeHome = createTestHome(`push-skill-${target}-manifest-adoption`);
      const projectDir = createTestProject(`push-skill-${target}-manifest-adoption`, FIXTURE_ROOT);
      const name = 'obsidian';
      const destination = join(targetPaths(fakeHome)[rootName], name);
      const historical = `${readFileSync(join(FIXTURE_ROOT, rootName, 'skills', name, 'SKILL.md'), 'utf-8').trimEnd()}\n\nHistorical projection.\n`;
      mkdirSync(destination, { recursive: true });
      writeFileSync(join(destination, 'SKILL.md'), historical);
      const hash = (await import('../../src/cli/canonical')).hashContent(historical);
      mkdirSync(join(projectDir, '.metronome'), { recursive: true });
      writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
        version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
          'skill/obsidian': { type: 'skill', name, sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { [manifestTarget]: { hash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
        },
      }));

      const check = await runCheck({ projectDir, targets: [target], types: ['skill'], homeDir: fakeHome });
      expect(check.hasDrift).toBe(true);
      const dryRun = await runPush({ projectDir, dryRun: true, targets: [target], types: ['skill'], homeDir: fakeHome });
      expect(dryRun.failed).toBe(0);
      expect(dryRun.hasDrift).toBe(true);
      const result = await runPush({ projectDir, force: true, targets: [target], types: ['skill'], homeDir: fakeHome });

      expect(result.failed).toBe(0);
      expect(existsSync(join(destination, '.metronome-public-v1'))).toBe(true);
      expect(readFileSync(join(destination, 'SKILL.md'), 'utf-8')).not.toContain('Historical projection.');
    }, E2E_TIMEOUT);
  }

  for (const [target, rootName, manifestTarget] of [
    ['claude-code', 'claude', 'claude-code'],
    ['antigravity', 'antigravity', 'antigravity'],
  ] as const) {
    test(`blocks an unmarked ${target} projection when its historical hash does not match`, async () => {
      const fakeHome = createTestHome(`push-skill-${target}-manifest-mismatch`);
      const projectDir = createTestProject(`push-skill-${target}-manifest-mismatch`, FIXTURE_ROOT);
      const destination = join(targetPaths(fakeHome)[rootName], 'obsidian');
      mkdirSync(destination, { recursive: true });
      writeFileSync(join(destination, 'SKILL.md'), 'Different historical projection.\n');
      mkdirSync(join(projectDir, '.metronome'), { recursive: true });
      writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
        version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
          'skill/obsidian': { type: 'skill', name: 'obsidian', sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { [manifestTarget]: { hash: 'not-the-local-hash', lastSynced: '2026-01-01T00:00:00.000Z' } } },
        },
      }));

      await expect(runPush({ projectDir, force: true, targets: [target], types: ['skill'], homeDir: fakeHome }))
        .rejects.toThrow(/conflicts with (public|managed) skill/);
      expect(existsSync(join(destination, '.metronome-public-v1'))).toBe(false);
    }, E2E_TIMEOUT);
  }

  test('adopts an unmarked Claude public projection with a cross-target historical hash and matching complete peer tree', async () => {
    const fakeHome = createTestHome('push-skill-claude-cross-target-peer');
    const projectDir = createTestProject('push-skill-claude-cross-target-peer', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const name = 'obsidian';
    const historical = '---\nname: obsidian\n---\n\nHistorical projection.\n';
    for (const directory of [join(paths.claude, name), join(paths.antigravity, name)]) {
      mkdirSync(join(directory, 'references'), { recursive: true });
      writeFileSync(join(directory, 'SKILL.md'), historical);
      writeFileSync(join(directory, 'references', 'guide.md'), 'Historical support.\n');
    }
    const hash = (await import('../../src/cli/canonical')).hashContent(historical);
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        'skill/obsidian': { type: 'skill', name, sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { antigravity: { hash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
      },
    }));

    const result = await runPush({ projectDir, force: true, targets: ['claude-code'], types: ['skill'], homeDir: fakeHome });

    expect(result.failed).toBe(0);
    expect(existsSync(join(paths.claude, name, '.metronome-public-v1'))).toBe(true);
  }, E2E_TIMEOUT);

  test('blocks a cross-target historical hash when the peer complete tree differs', async () => {
    const fakeHome = createTestHome('push-skill-claude-cross-target-peer-tree-differs');
    const projectDir = createTestProject('push-skill-claude-cross-target-peer-tree-differs', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const name = 'obsidian';
    const historical = '---\nname: obsidian\n---\n\nHistorical projection.\n';
    for (const [directory, support] of [[join(paths.claude, name), 'Destination support.\n'], [join(paths.antigravity, name), 'Peer support.\n']] as const) {
      mkdirSync(join(directory, 'references'), { recursive: true });
      writeFileSync(join(directory, 'SKILL.md'), historical);
      writeFileSync(join(directory, 'references', 'guide.md'), support);
    }
    const hash = (await import('../../src/cli/canonical')).hashContent(historical);
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        'skill/obsidian': { type: 'skill', name, sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { antigravity: { hash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
      },
    }));

    await expect(runPush({ projectDir, force: true, targets: ['claude-code'], types: ['skill'], homeDir: fakeHome }))
      .rejects.toThrow(/conflicts with (public|managed) skill/);
    expect(existsSync(join(paths.claude, name, '.metronome-public-v1'))).toBe(false);
  }, E2E_TIMEOUT);

  test('blocks a cross-target historical hash without a distinct peer tree', async () => {
    const fakeHome = createTestHome('push-skill-claude-cross-target-no-peer');
    const projectDir = createTestProject('push-skill-claude-cross-target-no-peer', FIXTURE_ROOT);
    const destination = join(targetPaths(fakeHome).claude, 'obsidian');
    const historical = '---\nname: obsidian\n---\n\nHistorical projection.\n';
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, 'SKILL.md'), historical);
    const hash = (await import('../../src/cli/canonical')).hashContent(historical);
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        'skill/obsidian': { type: 'skill', name: 'obsidian', sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { antigravity: { hash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
      },
    }));

    await expect(runPush({ projectDir, force: true, targets: ['claude-code'], types: ['skill'], homeDir: fakeHome }))
      .rejects.toThrow(/conflicts with (public|managed) skill/);
    expect(existsSync(join(destination, '.metronome-public-v1'))).toBe(false);
  }, E2E_TIMEOUT);

  test('adopts a manifest-proven shared collision when a legacy peer matches its complete tree', async () => {
    const fakeHome = createTestHome('push-skill-manifest-adoption');
    const projectDir = createTestProject('push-skill-manifest-adoption', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const name = 'obsidian';
    const shared = join(paths.codex, name);
    const legacy = join(fakeHome, '.codex', 'skills', name);
    const oldSkill = '---\nname: obsidian\n---\n\nHistorical projection.\n';
    for (const directory of [shared, legacy]) {
      mkdirSync(join(directory, 'references'), { recursive: true });
      writeFileSync(join(directory, 'SKILL.md'), oldSkill);
      writeFileSync(join(directory, 'references', 'guide.md'), 'Historical support.\n');
    }
    const codexHash = (await import('../../src/cli/canonical')).hashContent(oldSkill);
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        'skill/obsidian': { type: 'skill', name, sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { codex: { hash: codexHash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
      },
    }));

    const check = await runCheck({ projectDir, targets: ['codex'], types: ['skill'], homeDir: fakeHome });
    expect(check.hasDrift).toBe(true);
    const result = await runPush({ projectDir, force: true, targets: ['codex'], types: ['skill'], homeDir: fakeHome });

    expect(result.failed).toBe(0);
    expect(existsSync(join(shared, '.metronome-public-v1'))).toBe(true);
    expect(readFileSync(join(shared, 'SKILL.md'), 'utf-8')).not.toBe(oldSkill);
  }, E2E_TIMEOUT);

  test('blocks a manifest collision whose primary hash does not match', async () => {
    const fakeHome = createTestHome('push-skill-manifest-hash-mismatch');
    const projectDir = createTestProject('push-skill-manifest-hash-mismatch', FIXTURE_ROOT);
    const shared = join(targetPaths(fakeHome).codex, 'obsidian');
    mkdirSync(shared, { recursive: true });
    writeFileSync(join(shared, 'SKILL.md'), 'Different historical projection.\n');
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        'skill/obsidian': { type: 'skill', name: 'obsidian', sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { codex: { hash: 'not-the-local-hash', lastSynced: '2026-01-01T00:00:00.000Z' } } },
      },
    }));

    await expect(runPush({ projectDir, force: true, targets: ['codex'], types: ['skill'], homeDir: fakeHome }))
      .rejects.toThrow(/conflicts with (public|managed) skill/);
    expect(existsSync(join(shared, '.metronome-public-v1'))).toBe(false);
  }, E2E_TIMEOUT);

  test('blocks a manifest-proven primary collision with unique support files and no peer', async () => {
    const fakeHome = createTestHome('push-skill-manifest-unique-support');
    const projectDir = createTestProject('push-skill-manifest-unique-support', FIXTURE_ROOT);
    const shared = join(targetPaths(fakeHome).codex, 'obsidian');
    const oldSkill = '---\nname: obsidian\n---\n\nHistorical projection.\n';
    mkdirSync(join(shared, 'references'), { recursive: true });
    writeFileSync(join(shared, 'SKILL.md'), oldSkill);
    writeFileSync(join(shared, 'references', 'private.md'), 'Must not overwrite.\n');
    const codexHash = (await import('../../src/cli/canonical')).hashContent(oldSkill);
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        'skill/obsidian': { type: 'skill', name: 'obsidian', sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { codex: { hash: codexHash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
      },
    }));

    await expect(runPush({ projectDir, force: true, targets: ['codex'], types: ['skill'], homeDir: fakeHome }))
      .rejects.toThrow(/conflicts with (public|managed) skill/);
    expect(readFileSync(join(shared, 'references', 'private.md'), 'utf-8')).toBe('Must not overwrite.\n');
  }, E2E_TIMEOUT);

  test('restores a manifest-adopted shared tree when a later projection fails', async () => {
    const fakeHome = createTestHome('push-skill-manifest-rollback');
    const projectDir = createTestProject('push-skill-manifest-rollback', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const oldSkill = '---\nname: obsidian\n---\n\nHistorical projection.\n';
    const shared = join(paths.codex, 'obsidian');
    const legacy = join(fakeHome, '.codex', 'skills', 'obsidian');
    for (const directory of [shared, legacy]) {
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, 'SKILL.md'), oldSkill);
    }
    const claude = join(paths.claude, 'obsidian');
    mkdirSync(claude, { recursive: true });
    writeFileSync(join(claude, 'SKILL.md'), 'Old marked Claude tree.\n');
    writeFileSync(join(claude, '.metronome-public-v1'), '.metronome-public-v1\n');
    const codexHash = (await import('../../src/cli/canonical')).hashContent(oldSkill);
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        'skill/obsidian': { type: 'skill', name: 'obsidian', sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { codex: { hash: codexHash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
      },
    }));

    const result = await runPush({
      projectDir, force: true, targets: ['codex', 'claude-code'], types: ['skill'], homeDir: fakeHome,
      projectionExecutor: async (operation, write) => {
        await write();
        if (operation.target === 'claude-code') throw new Error('injected later failure');
      },
    });

    expect(result.rolledBack).toBe(true);
    expect(readFileSync(join(shared, 'SKILL.md'), 'utf-8')).toBe(oldSkill);
    expect(existsSync(join(shared, '.metronome-public-v1'))).toBe(false);
  }, E2E_TIMEOUT);

  test('restores a manifest-adopted Claude tree when a later projection fails', async () => {
    const fakeHome = createTestHome('push-skill-claude-manifest-rollback');
    const projectDir = createTestProject('push-skill-claude-manifest-rollback', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const name = 'obsidian';
    const claude = join(paths.claude, name);
    const historical = `${readFileSync(join(FIXTURE_ROOT, 'claude', 'skills', name, 'SKILL.md'), 'utf-8').trimEnd()}\n\nHistorical projection.\n`;
    mkdirSync(claude, { recursive: true });
    writeFileSync(join(claude, 'SKILL.md'), historical);
    const antigravity = join(paths.antigravity, name);
    mkdirSync(antigravity, { recursive: true });
    writeFileSync(join(antigravity, 'SKILL.md'), 'Old marked Antigravity tree.\n');
    writeFileSync(join(antigravity, '.metronome-public-v1'), '.metronome-public-v1\n');
    const hash = (await import('../../src/cli/canonical')).hashContent(historical);
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        'skill/obsidian': { type: 'skill', name, sourceHash: 'ignored', lastSynced: '2026-01-01T00:00:00.000Z', targets: { 'claude-code': { hash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
      },
    }));

    const result = await runPush({
      projectDir, force: true, targets: ['claude-code', 'antigravity'], types: ['skill'], homeDir: fakeHome,
      projectionExecutor: async (operation, write) => {
        await write();
        if (operation.target === 'antigravity') throw new Error('injected later failure');
      },
    });

    expect(result.rolledBack).toBe(true);
    expect(readFileSync(join(claude, 'SKILL.md'), 'utf-8')).toBe(historical);
    expect(existsSync(join(claude, '.metronome-public-v1'))).toBe(false);
  }, E2E_TIMEOUT);
  test('pushes skills to all 4 targets matching golden fixtures', async () => {
    const fakeHome = createTestHome('push-skill');
    const projectDir = createTestProject('push-skill', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);

    const result = await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });

    expect(result.written).toBeGreaterThan(0);
    expect(result.failed).toBe(0);
    expect(result.rolledBack).toBe(false);

    // Claude: obsidian/SKILL.md
    const claudeObsidian = readFileSync(join(paths.claude, 'obsidian', 'SKILL.md'), 'utf-8');
    const claudeObsidianGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
    expect(claudeObsidian).toBe(claudeObsidianGolden);

    // OpenCode shares the user-global skill root with Codex.
    const opencodeObsidian = readFileSync(join(paths.opencode, 'obsidian', 'SKILL.md'), 'utf-8');
    const opencodeObsidianGolden = readFileSync(join(FIXTURE_ROOT, 'opencode', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
    expect(opencodeObsidian).toBe(opencodeObsidianGolden);

    // Antigravity: obsidian/SKILL.md
    const antigravityObsidian = readFileSync(join(paths.antigravity, 'obsidian', 'SKILL.md'), 'utf-8');
    const antigravityObsidianGolden = readFileSync(join(FIXTURE_ROOT, 'antigravity', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
    expect(antigravityObsidian).toBe(antigravityObsidianGolden);

    // Codex: obsidian/SKILL.md
    const codexObsidian = readFileSync(join(paths.codex, 'obsidian', 'SKILL.md'), 'utf-8');
    const codexObsidianGolden = readFileSync(join(FIXTURE_ROOT, 'codex', 'skills', 'obsidian', 'SKILL.md'), 'utf-8');
    expect(codexObsidian).toBe(codexObsidianGolden);

    // Also verify web-design-guidelines skill
    const claudeWdg = readFileSync(join(paths.claude, 'web-design-guidelines', 'SKILL.md'), 'utf-8');
    const claudeWdgGolden = readFileSync(join(FIXTURE_ROOT, 'claude', 'skills', 'web-design-guidelines', 'SKILL.md'), 'utf-8');
    expect(claudeWdg).toBe(claudeWdgGolden);

    // Also verify new design-critique skill
    const claudeDesignCritique = readFileSync(join(paths.claude, 'design-critique', 'SKILL.md'), 'utf-8');
    const claudeDesignCritiqueGolden = readFileSync(
      join(FIXTURE_ROOT, 'claude', 'skills', 'design-critique', 'SKILL.md'),
      'utf-8',
    );
    expect(claudeDesignCritique).toBe(claudeDesignCritiqueGolden);

    const claudeMemoryRetrieval = readFileSync(
      join(paths.claude, 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    const claudeMemoryRetrievalGolden = readFileSync(
      join(FIXTURE_ROOT, 'claude', 'skills', 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    expect(claudeMemoryRetrieval).toBe(claudeMemoryRetrievalGolden);

    const opencodeMemoryRetrieval = readFileSync(
      join(paths.opencode, 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    const opencodeMemoryRetrievalGolden = readFileSync(
      join(FIXTURE_ROOT, 'opencode', 'skills', 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    expect(opencodeMemoryRetrieval).toBe(opencodeMemoryRetrievalGolden);

    const antigravityMemoryRetrieval = readFileSync(
      join(paths.antigravity, 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    const antigravityMemoryRetrievalGolden = readFileSync(
      join(FIXTURE_ROOT, 'antigravity', 'skills', 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    expect(antigravityMemoryRetrieval).toBe(antigravityMemoryRetrievalGolden);

    const codexMemoryRetrieval = readFileSync(
      join(paths.codex, 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    const codexMemoryRetrievalGolden = readFileSync(
      join(FIXTURE_ROOT, 'codex', 'skills', 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    expect(codexMemoryRetrieval).toBe(codexMemoryRetrievalGolden);
  }, E2E_TIMEOUT);

  test('second push is idempotent (no drift)', async () => {
    const fakeHome = createTestHome('push-skill-idem');
    const projectDir = createTestProject('push-skill-idem', FIXTURE_ROOT);

    await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });

    const result2 = await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });
    expect(result2.hasDrift).toBe(false);
    expect(result2.written).toBe(0);
  }, E2E_TIMEOUT);

  test('projects public skills beside private skills and preserves private source trees', async () => {
    const fakeHome = createTestHome('push-skill-private');
    const projectDir = createTestProject('push-skill-private', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const privateDir = join(paths.codex, 'client-skill');
    mkdirSync(join(privateDir, 'references'), { recursive: true });
    writeFileSync(join(privateDir, 'SKILL.md'), '---\nname: client-skill\n---\n\nPrivate body.\n');
    writeFileSync(join(privateDir, 'references', 'guide.md'), 'Private support.\n');

    await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });

    expect(readFileSync(join(privateDir, 'references', 'guide.md'), 'utf-8')).toBe('Private support.\n');
    expect(existsSync(join(privateDir, '.metronome-public-v1'))).toBe(false);
    expect(readFileSync(join(paths.claude, 'client-skill', 'SKILL.md'), 'utf-8')).toContain('Private body.');
    expect(existsSync(join(paths.claude, 'client-skill', '.metronome-private-v1'))).toBe(true);
    expect(existsSync(join(paths.codex, 'obsidian', '.metronome-public-v1'))).toBe(true);
  }, E2E_TIMEOUT);

  test('projects private-only changes when public skills are clean', async () => {
    const fakeHome = createTestHome('push-skill-private-drift');
    const projectDir = createTestProject('push-skill-private-drift', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const privateDir = join(paths.codex, 'private-drift');
    mkdirSync(privateDir, { recursive: true });
    writeFileSync(join(privateDir, 'SKILL.md'), 'Private drift.\n');

    const result = await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });

    expect(result.hasDrift).toBe(true);
    expect(existsSync(join(paths.claude, 'private-drift', '.metronome-private-v1'))).toBe(true);
    expect(result.output).not.toContain('private-drift');
  }, E2E_TIMEOUT);

  test('reports private-only drift without exposing private metadata and becomes idempotent after push', async () => {
    const fakeHome = createTestHome('push-skill-private-summary');
    const projectDir = createTestProject('push-skill-private-summary', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const privateName = 'private-canary';
    const privateBody = 'Private body must never leave the projection.';
    const privateDir = join(paths.codex, privateName);
    mkdirSync(privateDir, { recursive: true });
    writeFileSync(join(privateDir, 'SKILL.md'), privateBody);

    const check = await runCheck({ projectDir, types: ['skill'], homeDir: fakeHome, json: true });
    expect(check.hasDrift).toBe(true);
    expect(check.privateSkillDrift).toEqual({ create: 2, update: 0, delete: 0 });
    expect(check.output).not.toContain(privateName);
    expect(check.output).not.toContain(privateBody);

    const dryRun = await runPush({ projectDir, dryRun: true, types: ['skill'], homeDir: fakeHome, json: true });
    expect(dryRun.hasDrift).toBe(true);
    expect(JSON.parse(dryRun.output).privateSkills).toEqual({ create: 2, update: 0, delete: 0 });
    expect(dryRun.output).not.toContain(privateName);
    expect(dryRun.output).not.toContain(privateBody);

    await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });
    const secondPush = await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });
    expect(secondPush.written).toBe(0);
    expect(secondPush.hasDrift).toBe(false);

    const manifest = readFileSync(join(projectDir, '.metronome', 'manifest.json'), 'utf-8');
    expect(manifest).not.toContain(privateName);
    expect(manifest).not.toContain(privateBody);
  }, E2E_TIMEOUT);

  test('does not classify managed private projections as public stale deletions', async () => {
    const fakeHome = createTestHome('push-skill-private-stale-check');
    const projectDir = createTestProject('push-skill-private-stale-check', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const source = join(paths.codex, 'private-source');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'SKILL.md'), 'Private source.\n');
    await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });

    const check = await runCheck({ projectDir, types: ['skill'], homeDir: fakeHome });
    const publicDeletes = check.diffs.flatMap((diff) => diff.operations).filter((operation) => operation.type === 'delete');
    expect(publicDeletes.some((operation) => operation.name === 'private-source')).toBe(false);

    rmSync(source, { recursive: true });
    const deleteCheck = await runCheck({ projectDir, types: ['skill'], homeDir: fakeHome, deleteStale: true, json: true });
    expect(deleteCheck.privateSkillDrift).toEqual({ create: 0, update: 0, delete: 2 });
    expect(deleteCheck.output).not.toContain('private-source');
  }, E2E_TIMEOUT);

  test('serializes public, shared, and legacy skill paths relative to the provided home directory', async () => {
    const fakeHome = createTestHome('push-skill-portable-paths');
    const projectDir = createTestProject('push-skill-portable-paths', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const stale = join(paths.claude, 'stale-public');
    mkdirSync(stale, { recursive: true });
    writeFileSync(join(stale, 'SKILL.md'), 'Stale.\n');
    writeFileSync(join(stale, '.metronome-public-v1'), '.metronome-public-v1\n');
    const legacy = join(fakeHome, '.codex', 'skills', 'obsidian');
    mkdirSync(legacy, { recursive: true });
    const shared = join(paths.codex, 'obsidian');
    mkdirSync(shared, { recursive: true });
    const source = join(projectDir, 'configs', 'skills', 'obsidian');
    for (const name of readdirSync(source)) writeFileSync(join(legacy, name), readFileSync(join(source, name)));
    for (const name of readdirSync(source)) writeFileSync(join(shared, name), readFileSync(join(source, name)));

    const check = await runCheck({ projectDir, deleteStale: true, types: ['skill'], homeDir: fakeHome, json: true });
    expect(check.output).not.toContain(fakeHome);
    expect(check.output).toContain('~/.claude/skills/stale-public');
    expect(check.output).toContain('~/.agents/skills/obsidian');
    expect(check.output).toContain('~/.gemini/antigravity-cli/skills/obsidian');
    expect(check.output).toContain('~/.codex/skills/obsidian');

    const result = await runPush({ projectDir, dryRun: true, deleteStale: true, types: ['skill'], homeDir: fakeHome, json: true });
    expect(result.output).not.toContain(fakeHome);
    expect(result.output).toContain('~/.claude/skills/stale-public');
    expect(result.output).toContain('~/.agents/skills/obsidian');
    expect(result.output).toContain('~/.gemini/antigravity-cli/skills/obsidian');
    expect(result.output).toContain('~/.codex/skills/obsidian');
  }, E2E_TIMEOUT);

  test('restores earlier projections and cleans backups after a late projection write failure', async () => {
    const fakeHome = createTestHome('push-skill-late-rollback');
    const projectDir = createTestProject('push-skill-late-rollback', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const shared = join(paths.codex, 'obsidian');
    const claude = join(paths.claude, 'obsidian');
    for (const path of [shared, claude]) {
      mkdirSync(path, { recursive: true });
      writeFileSync(join(path, 'SKILL.md'), `Original ${path}.\n`);
      writeFileSync(join(path, '.metronome-public-v1'), '.metronome-public-v1\n');
    }
    const beforeBackups = new Set(readdirSync(tmpdir()).filter((entry) => entry.startsWith('metronome-rollback-')));
    let writes = 0;

    const result = await runPush({
      projectDir,
      force: true,
      targets: ['codex', 'claude-code'],
      types: ['skill'],
      homeDir: fakeHome,
      projectionExecutor: async (_operation, write) => {
        await write();
        writes++;
        if (writes === 2) throw new Error('injected late projection rename failure');
      },
    });

    expect(result.failed).toBe(1);
    expect(readFileSync(join(shared, 'SKILL.md'), 'utf-8')).toBe(`Original ${shared}.\n`);
    expect(readFileSync(join(claude, 'SKILL.md'), 'utf-8')).toBe(`Original ${claude}.\n`);
    const afterBackups = readdirSync(tmpdir()).filter((entry) => entry.startsWith('metronome-rollback-'));
    expect(afterBackups.every((entry) => beforeBackups.has(entry))).toBe(true);
  }, E2E_TIMEOUT);

  test('redacts injected private late projection failures from output and stderr', async () => {
    const fakeHome = createTestHome('push-skill-private-redaction');
    const projectDir = createTestProject('push-skill-private-redaction', FIXTURE_ROOT);
    const privateName = 'private-redaction-canary';
    const privateBody = 'private body must not leak';
    const source = join(fakeHome, '.agents', 'skills', privateName);
    const destination = join(fakeHome, '.claude', 'skills', privateName);
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'SKILL.md'), privateBody);

    const originalError = console.error;
    const stderr: string[] = [];
    console.error = (...args: unknown[]) => stderr.push(args.map(String).join(' '));
    let result;
    try {
      result = await runPush({
        projectDir, force: true, types: ['skill'], homeDir: fakeHome, json: true,
        projectionExecutor: async (operation, write) => {
          await write();
          if (operation.kind === 'private') throw new Error(`failure ${operation.sourceDir} ${privateBody}`);
        },
      });
    } finally {
      console.error = originalError;
    }

    expect(result.failed).toBe(1);
    expect(result.output).toContain('Private skill projection failed');
    const observableOutput = `${result.output}\n${stderr.join('\n')}`;
    expect(observableOutput).not.toContain(privateName);
    expect(observableOutput).not.toContain(privateBody);
    expect(observableOutput).not.toContain(source);
    expect(observableOutput).not.toContain(destination);
    expect(observableOutput).not.toContain(fakeHome);
  }, E2E_TIMEOUT);

  test('adopts historical private Claude and Antigravity projections', async () => {
    const fakeHome = createTestHome('push-skill-private-historical-adoption');
    const projectDir = createTestProject('push-skill-private-historical-adoption', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const name = 'private-historical-canary';
    const source = join(paths.codex, name);
    const historical = 'Historical private projection.\n';
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'SKILL.md'), 'Current private source.\n');
    for (const root of [paths.claude, paths.antigravity]) {
      mkdirSync(join(root, name), { recursive: true });
      writeFileSync(join(root, name, 'SKILL.md'), historical);
    }
    const hash = (await import('../../src/cli/canonical')).hashContent(historical);
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        [`skill/${name}`]: { type: 'skill', name, sourceHash: 'private-source-hash', lastSynced: '2026-01-01T00:00:00.000Z', targets: {
          'claude-code': { hash, lastSynced: '2026-01-01T00:00:00.000Z' },
          antigravity: { hash, lastSynced: '2026-01-01T00:00:00.000Z' },
        } },
      },
    }));

    const check = await runCheck({ projectDir, targets: ['claude-code', 'antigravity'], types: ['skill'], homeDir: fakeHome, json: true });
    expect(check.privateSkillDrift).toEqual({ create: 0, update: 2, delete: 0 });
    const result = await runPush({ projectDir, force: true, targets: ['claude-code', 'antigravity'], types: ['skill'], homeDir: fakeHome });

    expect(result.failed).toBe(0);
    expect(readFileSync(join(paths.claude, name, 'SKILL.md'), 'utf-8')).toBe('Current private source.\n');
    expect(existsSync(join(paths.antigravity, name, '.metronome-private-v1'))).toBe(true);
  }, E2E_TIMEOUT);

  test('blocks and redacts a private historical hash mismatch', async () => {
    const fakeHome = createTestHome('push-skill-private-historical-mismatch');
    const projectDir = createTestProject('push-skill-private-historical-mismatch', FIXTURE_ROOT);
    const name = 'private-historical-secret';
    const source = join(targetPaths(fakeHome).codex, name);
    const destination = join(targetPaths(fakeHome).claude, name);
    mkdirSync(source, { recursive: true });
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(source, 'SKILL.md'), 'Private source body.\n');
    writeFileSync(join(destination, 'SKILL.md'), 'Different private historical body.\n');
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({
      version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
        [`skill/${name}`]: { type: 'skill', name, sourceHash: 'secret', lastSynced: '2026-01-01T00:00:00.000Z', targets: { 'claude-code': { hash: 'incorrect', lastSynced: '2026-01-01T00:00:00.000Z' } } },
      },
    }));

    await expect(runPush({ projectDir, force: true, targets: ['claude-code'], types: ['skill'], homeDir: fakeHome }))
      .rejects.toThrow('Private skill projection failed (1)');
    const dryRun = await runPush({ projectDir, dryRun: true, targets: ['claude-code'], types: ['skill'], homeDir: fakeHome, json: true });
    expect(dryRun.failed).toBe(1);
    expect(dryRun.output).not.toContain(name);
    expect(existsSync(join(destination, '.metronome-private-v1'))).toBe(false);
  }, E2E_TIMEOUT);

  test('blocks historical private projections with mismatched support peers', async () => {
    const fakeHome = createTestHome('push-skill-private-historical-support-mismatch');
    const projectDir = createTestProject('push-skill-private-historical-support-mismatch', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const name = 'private-support-canary';
    const historical = 'Historical private projection.\n';
    mkdirSync(join(paths.codex, name), { recursive: true });
    writeFileSync(join(paths.codex, name, 'SKILL.md'), 'Current private source.\n');
    for (const [root, support] of [[paths.claude, 'Claude unique.\n'], [paths.antigravity, 'Antigravity unique.\n']] as const) {
      mkdirSync(join(root, name, 'references'), { recursive: true });
      writeFileSync(join(root, name, 'SKILL.md'), historical);
      writeFileSync(join(root, name, 'references', 'guide.md'), support);
    }
    const hash = (await import('../../src/cli/canonical')).hashContent(historical);
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(join(projectDir, '.metronome', 'manifest.json'), JSON.stringify({ version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
      [`skill/${name}`]: { type: 'skill', name, sourceHash: 'secret', lastSynced: '2026-01-01T00:00:00.000Z', targets: { 'claude-code': { hash, lastSynced: '2026-01-01T00:00:00.000Z' }, antigravity: { hash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
    } }));

    await expect(runPush({ projectDir, force: true, targets: ['claude-code', 'antigravity'], types: ['skill'], homeDir: fakeHome }))
      .rejects.toThrow('Private skill projection failed (1)');
    expect(readFileSync(join(paths.claude, name, 'references', 'guide.md'), 'utf-8')).toBe('Claude unique.\n');
  }, E2E_TIMEOUT);

  test('purges successful private historical manifest entries and restores them on later failure', async () => {
    const fakeHome = createTestHome('push-skill-private-historical-purge-rollback');
    const projectDir = createTestProject('push-skill-private-historical-purge-rollback', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const name = 'private-purge-canary';
    const historical = 'Historical private projection.\n';
    mkdirSync(join(paths.codex, name), { recursive: true });
    writeFileSync(join(paths.codex, name, 'SKILL.md'), 'Current private source.\n');
    for (const root of [paths.claude, paths.antigravity]) {
      mkdirSync(join(root, name), { recursive: true });
      writeFileSync(join(root, name, 'SKILL.md'), historical);
    }
    const hash = (await import('../../src/cli/canonical')).hashContent(historical);
    const manifestPath = join(projectDir, '.metronome', 'manifest.json');
    mkdirSync(join(projectDir, '.metronome'), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ version: '1.0.0', lastSynced: '2026-01-01T00:00:00.000Z', items: {
      [`skill/${name}`]: { type: 'skill', name, sourceHash: 'private-secret', lastSynced: '2026-01-01T00:00:00.000Z', targets: { 'claude-code': { hash, lastSynced: '2026-01-01T00:00:00.000Z' }, antigravity: { hash, lastSynced: '2026-01-01T00:00:00.000Z' } } },
    } }));

    const failed = await runPush({ projectDir, force: true, targets: ['claude-code', 'antigravity'], types: ['skill'], homeDir: fakeHome, projectionExecutor: async (operation, write) => {
      await write();
      if (operation.target === 'antigravity') throw new Error('later failure');
    } });
    expect(failed.rolledBack).toBe(true);
    expect(readFileSync(join(paths.claude, name, 'SKILL.md'), 'utf-8')).toBe(historical);
    expect(readFileSync(manifestPath, 'utf-8')).toContain(name);

    const successful = await runPush({ projectDir, force: true, targets: ['claude-code', 'antigravity'], types: ['skill'], homeDir: fakeHome });
    expect(successful.failed).toBe(0);
    expect(readFileSync(manifestPath, 'utf-8')).not.toContain(name);
  }, E2E_TIMEOUT);

  test('adopts an identical unmarked public projection and rejects a modified collision', async () => {
    const fakeHome = createTestHome('push-skill-adoption');
    const projectDir = createTestProject('push-skill-adoption', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const source = join(projectDir, 'configs', 'skills', 'obsidian', 'SKILL.md');
    const adopted = join(paths.codex, 'obsidian');
    mkdirSync(adopted, { recursive: true });
    writeFileSync(join(adopted, 'SKILL.md'), readFileSync(source));

    await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });
    expect(existsSync(join(adopted, '.metronome-public-v1'))).toBe(true);

    const collisionHome = createTestHome('push-skill-collision');
    const collisionPaths = targetPaths(collisionHome);
    mkdirSync(join(collisionPaths.codex, 'obsidian'), { recursive: true });
    writeFileSync(join(collisionPaths.codex, 'obsidian', 'SKILL.md'), 'modified');
    await expect(runPush({ projectDir, force: true, types: ['skill'], homeDir: collisionHome }))
      .rejects.toThrow('conflicts with public skill');
  }, E2E_TIMEOUT);

  test('aborts before writes for unowned Claude and Antigravity projection collisions', async () => {
    for (const target of ['claude', 'antigravity'] as const) {
      const fakeHome = createTestHome(`push-skill-${target}-collision`);
      const projectDir = createTestProject(`push-skill-${target}-collision`, FIXTURE_ROOT);
      const paths = targetPaths(fakeHome);
      const root = target === 'claude' ? paths.claude : paths.antigravity;
      const collision = join(root, 'obsidian');
      mkdirSync(collision, { recursive: true });
      writeFileSync(join(collision, 'SKILL.md'), 'Modified collision.\n');

      await expect(runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome }))
        .rejects.toThrow('conflicts with managed skill');
      expect(existsSync(join(paths.codex, 'web-design-guidelines', 'SKILL.md'))).toBe(false);
    }
  }, E2E_TIMEOUT);

  test('removes stale private projections only after their unmarked shared source is gone', async () => {
    const fakeHome = createTestHome('push-skill-private-stale');
    const projectDir = createTestProject('push-skill-private-stale', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const source = join(paths.codex, 'local-only');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'SKILL.md'), 'Local only.\n');
    await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });
    rmSync(source, { recursive: true });

    await runPush({ projectDir, force: true, deleteStale: true, types: ['skill'], homeDir: fakeHome });

    expect(existsSync(join(paths.claude, 'local-only'))).toBe(false);
    expect(existsSync(join(paths.antigravity, 'local-only'))).toBe(false);
  }, E2E_TIMEOUT);

  test('rolls back an earlier projection when a later projection fails', async () => {
    const fakeHome = createTestHome('push-skill-rollback');
    const projectDir = createTestProject('push-skill-rollback', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);
    const first = join(paths.codex, 'obsidian');
    mkdirSync(first, { recursive: true });
    writeFileSync(join(first, 'SKILL.md'), 'Original shared tree.\n');
    writeFileSync(join(first, '.metronome-public-v1'), '.metronome-public-v1\n');
    mkdirSync(join(paths.antigravity, 'obsidian'), { recursive: true });
    writeFileSync(join(paths.antigravity, 'obsidian', 'SKILL.md'), 'Unowned collision.\n');

    await expect(runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome }))
      .rejects.toThrow('conflicts with managed skill');
    expect(readFileSync(join(first, 'SKILL.md'), 'utf-8')).toBe('Original shared tree.\n');
  }, E2E_TIMEOUT);

  test('stale skill directories are removed with deleteStale only when marker-owned', async () => {
    const fakeHome = createTestHome('push-skill-stale');
    const projectDir = createTestProject('push-skill-stale', FIXTURE_ROOT);
    const paths = targetPaths(fakeHome);

    await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });

    // Plant stale marker-owned and unmarked skill directories in Claude skills dir.
    const staleDir = join(paths.claude, 'stale-test-skill');
    mkdirSync(staleDir, { recursive: true });
    writeFileSync(join(staleDir, 'SKILL.md'), '---\nname: stale-test-skill\n---\n\nStale skill.\n');
    writeFileSync(join(staleDir, '.metronome-public-v1'), '.metronome-public-v1\n');
    const privateDir = join(paths.claude, 'private-skill');
    mkdirSync(privateDir, { recursive: true });
    writeFileSync(join(privateDir, 'SKILL.md'), 'Private.\n');
    expect(existsSync(join(staleDir, 'SKILL.md'))).toBe(true);
    expect(await hasSkillMarker(staleDir)).toBe(true);

    const check = await runCheck({ projectDir, types: ['skill'], homeDir: fakeHome });
    expect(check.diffs.find((diff) => diff.target === 'claude-code')?.operations.some(
      (operation) => operation.type === 'delete' && operation.name === 'stale-test-skill',
    )).toBe(true);
    await runPush({ projectDir, force: true, deleteStale: true, types: ['skill'], homeDir: fakeHome });

    // Stale skill directory should be removed entirely
    expect(existsSync(staleDir)).toBe(false);
    expect(existsSync(privateDir)).toBe(true);

    // Canonical skills should still exist
    expect(existsSync(join(paths.claude, 'obsidian', 'SKILL.md'))).toBe(true);
  }, E2E_TIMEOUT);

  test('does not delete projections when the canonical skills root is unavailable', async () => {
    const fakeHome = createTestHome('push-skill-missing-canonical');
    const projectDir = createTestProject('push-skill-missing-canonical', FIXTURE_ROOT);
    const stale = join(targetPaths(fakeHome).claude, 'stale-public');
    mkdirSync(stale, { recursive: true });
    writeFileSync(join(stale, 'SKILL.md'), 'Stale.\n');
    writeFileSync(join(stale, '.metronome-public-v1'), '.metronome-public-v1\n');
    rmSync(join(projectDir, 'configs', 'skills'), { recursive: true });

    await expect(runPush({ projectDir, force: true, deleteStale: true, types: ['skill'], homeDir: fakeHome }))
      .rejects.toThrow('Unable to read canonical skills root');
    expect(existsSync(stale)).toBe(true);
  }, E2E_TIMEOUT);

  test('detects changed and removed nested support files as skill drift', async () => {
    const fakeHome = createTestHome('push-skill-tree-drift');
    const projectDir = createTestProject('push-skill-tree-drift', FIXTURE_ROOT);
    const sourceDir = join(projectDir, 'configs', 'skills', 'obsidian');
    mkdirSync(join(sourceDir, 'references'), { recursive: true });
    writeFileSync(join(sourceDir, 'references', 'guide.md'), 'Version one.\n');
    await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });
    writeFileSync(join(sourceDir, 'references', 'guide.md'), 'Version two.\n');

    const changed = await runCheck({ projectDir, types: ['skill'], homeDir: fakeHome });
    expect(changed.hasDrift).toBe(true);

    await runPush({ projectDir, force: true, types: ['skill'], homeDir: fakeHome });
    writeFileSync(join(sourceDir, 'references', 'new-guide.md'), 'New.\n');
    const added = await runCheck({ projectDir, types: ['skill'], homeDir: fakeHome });
    expect(added.hasDrift).toBe(true);
  }, E2E_TIMEOUT);
});
