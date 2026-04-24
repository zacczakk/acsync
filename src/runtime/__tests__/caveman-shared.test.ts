import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getCavemanStatePath } from '../caveman-paths';
import shared from '../../../configs/hooks/caveman-shared.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

function makeTempDir(): string {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'caveman-shared-'));
  tempDirs.push(tempDir);
  return tempDir;
}

function makeSupportedStatePath(tempDir: string, target: 'claude-code' | 'codex' | 'opencode'): string {
  return getCavemanStatePath(target, tempDir);
}

describe('parseRequestedMode', () => {
  test('parses slash activation and deactivation commands', () => {
    expect(shared.parseRequestedMode('/caveman')).toEqual({ kind: 'activate-default' });
    expect(shared.parseRequestedMode('/caveman lite')).toEqual({ kind: 'activate-explicit', mode: 'lite' });
    expect(shared.parseRequestedMode('/caveman stop')).toEqual({ kind: 'deactivate', mode: 'off' });
  });

  test('parses natural language deactivation aliases only', () => {
    expect(shared.parseRequestedMode('normal mode')).toEqual({ kind: 'deactivate', mode: 'off' });
    expect(shared.parseRequestedMode('stop caveman')).toEqual({ kind: 'deactivate', mode: 'off' });
    expect(shared.parseRequestedMode('please go caveman')).toBeNull();
  });
});

describe('resolveActivationMode', () => {
  test('falls back to full for bare /caveman when defaultMode is off', () => {
    expect(shared.readCavemanConfig().defaultMode).toBe('off');
    expect(shared.resolveActivationMode('off')).toBe('full');
  });

  test('preserves explicit active default modes', () => {
    expect(shared.resolveActivationMode('lite')).toBe('lite');
    expect(shared.resolveActivationMode('full')).toBe('full');
    expect(shared.resolveActivationMode('ultra')).toBe('ultra');
  });
});

describe('state file IO', () => {
  test('reads valid state content from a supported path', () => {
    const tempDir = makeTempDir();
    const statePath = makeSupportedStatePath(tempDir, 'codex');
    mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileSync(statePath, 'lite');

    expect(shared.readState(statePath)).toBe('lite');
  });

  test('falls back to off for invalid state content', () => {
    const tempDir = makeTempDir();
    const statePath = makeSupportedStatePath(tempDir, 'claude-code');
    mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileSync(statePath, 'banana');

    expect(shared.readState(statePath)).toBe('off');
  });

  test('falls back to off for oversized state content', () => {
    const tempDir = makeTempDir();
    const statePath = makeSupportedStatePath(tempDir, 'opencode');
    mkdirSync(path.dirname(statePath), { recursive: true });
    writeFileSync(statePath, 'ultra-ultra-ultra');

    expect(shared.readState(statePath)).toBe('off');
  });

  test('rejects unsupported state paths for reads and writes', () => {
    const tempDir = makeTempDir();
    const statePath = path.join(tempDir, 'elsewhere', '.caveman-active');

    shared.writeState(statePath, 'lite');

    expect(shared.readState(statePath)).toBe('off');
    expect(existsSync(statePath)).toBe(false);
  });

  test('rejects symlinked supported paths', () => {
    const tempDir = makeTempDir();
    const realDir = path.join(tempDir, 'real-codex');
    const linkedDir = path.join(tempDir, '.codex');
    mkdirSync(realDir, { recursive: true });
    symlinkSync(realDir, linkedDir);
    const statePath = path.join(linkedDir, '.caveman-active');
    const realStatePath = path.join(realDir, '.caveman-active');
    writeFileSync(realStatePath, 'full');

    shared.writeState(statePath, 'ultra');

    expect(shared.readState(statePath)).toBe('off');
    expect(readFileSync(realStatePath, 'utf8')).toBe('full');
    expect(lstatSync(linkedDir).isSymbolicLink()).toBe(true);
  });
});

describe('renderActiveContext', () => {
  test('includes only the active level intensity row and matching sections', () => {
    const context = shared.renderActiveContext('full');

    expect(context).toContain('| level | style | allowed detail |');
    expect(context).toContain('|-------|-------|----------------|');
    expect(context).toContain('| full | telegraph default | noun phrases ok, drop filler |');
    expect(context).not.toContain('| lite | terse but grammatical | short sentences, keep connectors |');
    expect(context).not.toContain('| ultra | maximal compression | fragments ok, only if still unambiguous |');
    expect(context).toContain('Level Rules (full):');
    expect(context).toContain('Examples (full):');
  });
});
