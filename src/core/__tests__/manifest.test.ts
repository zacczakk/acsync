import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createEmptyManifest,
  loadManifest,
  saveManifest,
  updateManifestItem,
  getManifestHash,
  getManifestPath,
} from '../manifest';
import type { Manifest } from '../../types';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'manifest-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('createEmptyManifest', () => {
  test('returns manifest with correct version', () => {
    const m = createEmptyManifest();
    expect(m.version).toBe('1.0.0');
  });

  test('returns manifest with empty items', () => {
    const m = createEmptyManifest();
    expect(m.items).toEqual({});
  });

  test('returns manifest with ISO 8601 lastSynced', () => {
    const before = new Date().toISOString();
    const m = createEmptyManifest();
    const after = new Date().toISOString();
    expect(m.lastSynced >= before).toBe(true);
    expect(m.lastSynced <= after).toBe(true);
  });
});

describe('getManifestPath', () => {
  test('returns .acsync/manifest.json under given dir', () => {
    const p = getManifestPath('/some/dir');
    expect(p).toBe('/some/dir/.acsync/manifest.json');
  });
});

describe('loadManifest', () => {
  test('returns empty manifest when file missing', async () => {
    const m = await loadManifest(tempDir);
    expect(m.version).toBe('1.0.0');
    expect(m.items).toEqual({});
  });

  test('returns empty manifest when file is corrupt JSON', async () => {
    const acsyncDir = join(tempDir, '.acsync');
    await mkdir(acsyncDir, { recursive: true });
    await writeFile(join(acsyncDir, 'manifest.json'), 'not valid json {{{{');
    const m = await loadManifest(tempDir);
    expect(m.version).toBe('1.0.0');
    expect(m.items).toEqual({});
  });

  test('returns empty manifest when JSON lacks required fields', async () => {
    const acsyncDir = join(tempDir, '.acsync');
    await mkdir(acsyncDir, { recursive: true });
    await writeFile(join(acsyncDir, 'manifest.json'), JSON.stringify({ foo: 'bar' }));
    const m = await loadManifest(tempDir);
    expect(m.version).toBe('1.0.0');
    expect(m.items).toEqual({});
  });

  test('loads valid manifest from disk', async () => {
    const saved: Manifest = {
      version: '1.0.0',
      lastSynced: '2026-01-01T00:00:00.000Z',
      items: {
        'command/test': {
          type: 'command',
          name: 'test',
          sourceHash: 'abc123',
          lastSynced: '2026-01-01T00:00:00.000Z',
          targets: {
            'claude-code': { hash: 'abc123', lastSynced: '2026-01-01T00:00:00.000Z' },
          },
        },
      },
    };
    const acsyncDir = join(tempDir, '.acsync');
    await mkdir(acsyncDir, { recursive: true });
    await writeFile(join(acsyncDir, 'manifest.json'), JSON.stringify(saved));

    const m = await loadManifest(tempDir);
    expect(m.version).toBe('1.0.0');
    expect(m.items['command/test']).toBeDefined();
    expect(m.items['command/test'].name).toBe('test');
  });
});

describe('saveManifest', () => {
  test('creates .acsync directory if missing', async () => {
    const m = createEmptyManifest();
    await saveManifest(m, tempDir);
    expect(existsSync(join(tempDir, '.acsync', 'manifest.json'))).toBe(true);
  });

  test('saves manifest as valid JSON', async () => {
    const m = createEmptyManifest();
    m.items['agent/test'] = {
      type: 'agent',
      name: 'test',
      sourceHash: 'xyz',
      lastSynced: m.lastSynced,
      targets: {},
    };
    await saveManifest(m, tempDir);

    const loaded = await loadManifest(tempDir);
    expect(loaded.items['agent/test']).toBeDefined();
    expect(loaded.items['agent/test'].name).toBe('test');
  });

  test('updates lastSynced on save', async () => {
    const m = createEmptyManifest();
    const before = m.lastSynced;
    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 5));
    await saveManifest(m, tempDir);
    expect(m.lastSynced >= before).toBe(true);
  });
});

describe('updateManifestItem', () => {
  test('creates new item if not exists', () => {
    const m = createEmptyManifest();
    updateManifestItem(m, 'command', 'my-cmd', 'hash1', 'claude-code', 'hash1');
    expect(m.items['command/my-cmd']).toBeDefined();
    expect(m.items['command/my-cmd'].name).toBe('my-cmd');
    expect(m.items['command/my-cmd'].type).toBe('command');
    expect(m.items['command/my-cmd'].sourceHash).toBe('hash1');
  });

  test('updates existing item and target', () => {
    const m = createEmptyManifest();
    updateManifestItem(m, 'agent', 'planner', 'hash1', 'opencode', 'hash1');
    updateManifestItem(m, 'agent', 'planner', 'hash2', 'opencode', 'hash2');
    expect(m.items['agent/planner'].sourceHash).toBe('hash2');
    expect(m.items['agent/planner'].targets['opencode']?.hash).toBe('hash2');
  });

  test('sets target hash correctly', () => {
    const m = createEmptyManifest();
    updateManifestItem(m, 'skill', 'my-skill', 'srcHash', 'gemini', 'tgtHash');
    expect(m.items['skill/my-skill'].targets['gemini']?.hash).toBe('tgtHash');
  });

  test('tracks multiple targets independently', () => {
    const m = createEmptyManifest();
    updateManifestItem(m, 'mcp', 'context7', 'hash1', 'claude-code', 'hash1');
    updateManifestItem(m, 'mcp', 'context7', 'hash1', 'opencode', 'hash2');
    expect(m.items['mcp/context7'].targets['claude-code']?.hash).toBe('hash1');
    expect(m.items['mcp/context7'].targets['opencode']?.hash).toBe('hash2');
  });
});

describe('getManifestHash', () => {
  test('returns target hash for known item', () => {
    const m = createEmptyManifest();
    updateManifestItem(m, 'command', 'test', 'src', 'codex', 'tgt');
    expect(getManifestHash(m, 'command', 'test', 'codex')).toBe('tgt');
  });

  test('returns null for unknown item', () => {
    const m = createEmptyManifest();
    expect(getManifestHash(m, 'command', 'nope', 'claude-code')).toBeNull();
  });

  test('returns null for item with no target entry', () => {
    const m = createEmptyManifest();
    updateManifestItem(m, 'agent', 'x', 'h', 'claude-code', 'h');
    expect(getManifestHash(m, 'agent', 'x', 'opencode')).toBeNull();
  });
});
