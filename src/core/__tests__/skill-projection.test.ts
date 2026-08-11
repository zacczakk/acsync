import { describe, expect, test } from 'bun:test';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createTestHome, createTestProject } from '../../../test/helpers/backup';
import { planSkillProjection, projectionNeedsUpdate, selectedSkillProjectionRoots } from '../skill-projection';
import type { Manifest } from '../../types';

function historicalManifest(skillName: string, primaryContent: string): Manifest {
  return {
    version: '1.0.0',
    lastSynced: '2026-01-01T00:00:00.000Z',
    items: {
      [`skill/${skillName}`]: {
        type: 'skill',
        name: skillName,
        sourceHash: 'source',
        lastSynced: '2026-01-01T00:00:00.000Z',
        targets: {
          'claude-code': {
            hash: createHash('sha256').update(primaryContent.trimEnd(), 'utf8').digest('hex'),
            lastSynced: '2026-01-01T00:00:00.000Z',
          },
        },
      },
    },
  };
}

function writeSkill(root: string, name: string, files: Record<string, string>): void {
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, name, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, content);
  }
}

async function historicalAdoptionFor(files: Record<string, string>, peerFiles?: Record<string, string>, peerPrimary = 'historical primary'): Promise<boolean | undefined> {
  const homeDir = createTestHome('projection-historical-hybrid');
  const projectDir = createTestProject('projection-historical-hybrid', join(import.meta.dir, '../../../test/fixtures'));
  const name = 'historical-hybrid';
  const canonical = { 'SKILL.md': 'current primary', 'references/support.md': 'current support', 'scripts/run.ts': 'current script' };
  writeSkill(join(projectDir, 'configs', 'skills'), name, canonical);
  writeSkill(join(homeDir, '.gemini', 'antigravity-cli', 'skills'), name, files);
  if (peerFiles) writeSkill(join(homeDir, '.claude', 'skills'), name, { 'SKILL.md': peerPrimary, ...peerFiles });

  const plan = await planSkillProjection({
    projectDir,
    homeDir,
    targets: ['antigravity'],
    publicSkillNames: [name],
    deleteStale: false,
    historicalManifest: historicalManifest(name, peerPrimary),
  });
  return plan.operations.find((operation) => operation.kind === 'public')?.historicalAdoption;
}

describe('selectedSkillProjectionRoots', () => {
  const home = '/portable-home';

  test('deduplicates OpenCode and Codex shared root', () => {
    expect(selectedSkillProjectionRoots(['opencode', 'codex'], home)).toEqual([
      { target: 'opencode', root: join(home, '.agents', 'skills') },
    ]);
  });

  test('deduplicates both OpenCode identities and Codex at the shared root', () => {
    expect(selectedSkillProjectionRoots(['opencode', 'opencode2', 'codex'], home)).toEqual([
      { target: 'opencode', root: join(home, '.agents', 'skills') },
    ]);
  });

  test('manages the shared root for either selected client', () => {
    expect(selectedSkillProjectionRoots(['codex'], home)).toEqual([
      { target: 'codex', root: join(home, '.agents', 'skills') },
    ]);
  });

  test('plans the shared root exactly once when both shared clients are selected', async () => {
    const homeDir = createTestHome('projection-shared-once');
    const projectDir = createTestProject('projection-shared-once', join(import.meta.dir, '../../../test/fixtures'));

    const plan = await planSkillProjection({
      projectDir,
      homeDir,
      targets: ['opencode', 'codex'],
      publicSkillNames: ['obsidian'],
      deleteStale: false,
    });

    expect(plan.operations.filter((operation) => operation.kind === 'public' && operation.name === 'obsidian')).toHaveLength(1);
    expect(plan.operations[0]?.filesystemPath).toBe(join(homeDir, '.agents', 'skills', 'obsidian'));
  });

  test('plans equal legacy public projections for deletion only with deleteStale', async () => {
    const homeDir = createTestHome('projection-legacy');
    const projectDir = createTestProject('projection-legacy', join(import.meta.dir, '../../../test/fixtures'));
    const source = join(projectDir, 'configs', 'skills', 'obsidian');
    const legacy = join(homeDir, '.codex', 'skills', 'obsidian');
    cpSync(source, legacy, { recursive: true });
    cpSync(source, join(homeDir, '.agents', 'skills', 'obsidian'), { recursive: true });

    const plan = await planSkillProjection({ projectDir, homeDir, targets: ['codex'], publicSkillNames: ['obsidian'], deleteStale: true });

    expect(plan.operations).toContainEqual(expect.objectContaining({ kind: 'legacy-delete', name: 'obsidian', targetPath: join(homeDir, '.codex', 'skills', 'obsidian') }));
  });

  test('preserves modified, private-only, hidden, oe-prefixed, and symlink legacy entries', async () => {
    const homeDir = createTestHome('projection-legacy-preserve');
    const projectDir = createTestProject('projection-legacy-preserve', join(import.meta.dir, '../../../test/fixtures'));
    const legacyRoot = join(homeDir, '.codex', 'skills');
    for (const [name, content] of [['obsidian', 'modified'], ['private-only', 'private'], ['.system', 'system'], ['oe-local', 'local']] as const) {
      mkdirSync(join(legacyRoot, name), { recursive: true });
      writeFileSync(join(legacyRoot, name, 'SKILL.md'), content);
    }
    const plan = await planSkillProjection({ projectDir, homeDir, targets: ['codex'], publicSkillNames: ['obsidian'], deleteStale: true });
    expect(plan.operations.filter((operation) => operation.kind === 'legacy-delete')).toHaveLength(0);
    expect(existsSync(join(legacyRoot, 'private-only'))).toBe(true);
  });

  test('does not delete private projections when the shared source root is missing', async () => {
    const homeDir = createTestHome('projection-private-source-missing');
    const projectDir = createTestProject('projection-private-source-missing', join(import.meta.dir, '../../../test/fixtures'));
    const privateProjection = join(homeDir, '.claude', 'skills', 'private-canary');
    mkdirSync(privateProjection, { recursive: true });
    writeFileSync(join(privateProjection, 'SKILL.md'), 'private');
    writeFileSync(join(privateProjection, '.metronome-private-v1'), '.metronome-private-v1\n');

    const plan = await planSkillProjection({ projectDir, homeDir, targets: ['claude-code'], publicSkillNames: ['obsidian'], deleteStale: true });

    expect(plan.operations.some((operation) => operation.kind === 'private-delete')).toBe(false);
  });

  test('only cleans legacy roots selected by their replacement target', async () => {
    const homeDir = createTestHome('projection-legacy-selected');
    const projectDir = createTestProject('projection-legacy-selected', join(import.meta.dir, '../../../test/fixtures'));
    const source = join(projectDir, 'configs', 'skills', 'obsidian');
    for (const root of [join(homeDir, '.config', 'opencode', 'skill'), join(homeDir, '.codex', 'skills')]) {
      cpSync(source, join(root, 'obsidian'), { recursive: true });
    }
    cpSync(source, join(homeDir, '.agents', 'skills', 'obsidian'), { recursive: true });

    const plan = await planSkillProjection({ projectDir, homeDir, targets: ['opencode'], publicSkillNames: ['obsidian'], deleteStale: true });

    expect(plan.operations).toContainEqual(expect.objectContaining({ kind: 'legacy-delete', targetPath: join(homeDir, '.config', 'opencode', 'skill', 'obsidian') }));
    expect(plan.operations.some((operation) => operation.targetPath === join(homeDir, '.codex', 'skills', 'obsidian'))).toBe(false);
  });

  test('requires a matching shared replacement before deleting marker-owned legacy skills', async () => {
    const homeDir = createTestHome('projection-legacy-marker');
    const projectDir = createTestProject('projection-legacy-marker', join(import.meta.dir, '../../../test/fixtures'));
    const legacy = join(homeDir, '.codex', 'skills', 'obsidian');
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, 'SKILL.md'), 'old');
    writeFileSync(join(legacy, '.metronome-public-v1'), '.metronome-public-v1\n');

    const plan = await planSkillProjection({ projectDir, homeDir, targets: ['codex'], publicSkillNames: ['obsidian'], deleteStale: true });

    expect(plan.operations.some((operation) => operation.kind === 'legacy-delete')).toBe(false);
  });
});

describe('projectionNeedsUpdate', () => {
  test('reports drift when an ownership marker is malformed', async () => {
    const homeDir = createTestHome('projection-malformed-marker');
    const source = join(homeDir, 'source');
    const destination = join(homeDir, 'destination');
    writeSkill(homeDir, 'source', { 'SKILL.md': 'same' });
    writeSkill(homeDir, 'destination', {
      'SKILL.md': 'same',
      '.metronome-private-v1': 'corrupted\n',
    });

    expect(await projectionNeedsUpdate(source, destination, '.metronome-private-v1')).toBe(true);
  });
});

describe('historical public skill adoption', () => {
  test('adopts a safe hybrid of current canonical and manifest-proven historical peer files', async () => {
    expect(await historicalAdoptionFor(
      { 'SKILL.md': 'historical primary', 'references/support.md': 'historical support', 'scripts/run.ts': 'current script' },
      { 'references/support.md': 'historical support', 'scripts/run.ts': 'historical script' },
    )).toBe(true);
  });

  test('blocks a historical hybrid with an extra file', async () => {
    expect(await historicalAdoptionFor(
      { 'SKILL.md': 'historical primary', 'references/support.md': 'historical support', 'scripts/run.ts': 'current script', 'extra.md': 'extra' },
      { 'references/support.md': 'historical support', 'scripts/run.ts': 'historical script' },
    )).toBe(false);
  });

  test('blocks a historical hybrid with content from neither canonical nor proven peer', async () => {
    expect(await historicalAdoptionFor(
      { 'SKILL.md': 'historical primary', 'references/support.md': 'unknown support', 'scripts/run.ts': 'current script' },
      { 'references/support.md': 'historical support', 'scripts/run.ts': 'historical script' },
    )).toBe(false);
  });

  test('does not accept support content from a peer whose primary is absent from the manifest', async () => {
    expect(await historicalAdoptionFor(
      { 'SKILL.md': 'historical primary', 'references/support.md': 'unproven support', 'scripts/run.ts': 'current script' },
      { 'references/support.md': 'unproven support', 'scripts/run.ts': 'historical script' },
      'unproven primary',
    )).toBe(false);
  });
});
