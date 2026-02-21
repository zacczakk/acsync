import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { atomicWrite } from '../atomic-write';
import { AtomicWriteError } from '../../errors';

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'atomic-write-test-'));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe('atomicWrite', () => {
  test('creates file with correct content', async () => {
    const targetPath = join(tempDir, 'output.txt');
    await atomicWrite(targetPath, 'hello world');

    const content = await readFile(targetPath, 'utf-8');
    expect(content).toBe('hello world');
  });

  test('overwrites existing file', async () => {
    const targetPath = join(tempDir, 'existing.txt');
    await Bun.write(targetPath, 'original');

    await atomicWrite(targetPath, 'updated');

    const current = await readFile(targetPath, 'utf-8');
    expect(current).toBe('updated');
  });

  test('no tmp files remain after success', async () => {
    const targetPath = join(tempDir, 'clean.txt');
    await atomicWrite(targetPath, 'clean');

    const files = readdirSync(tempDir);
    const tmpFiles = files.filter((f) => f.startsWith('.tmp-'));
    expect(tmpFiles).toHaveLength(0);
  });

  test('creates parent directories if missing', async () => {
    const targetPath = join(tempDir, 'deep', 'nested', 'file.txt');
    await atomicWrite(targetPath, 'nested content');

    const content = await readFile(targetPath, 'utf-8');
    expect(content).toBe('nested content');
  });

  test('wraps errors in AtomicWriteError with context', async () => {
    // Write to a directory path (should fail)
    const dirPath = join(tempDir, 'adir');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(dirPath);

    try {
      await atomicWrite(dirPath, 'content');
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(AtomicWriteError);
      if (err instanceof AtomicWriteError) {
        expect(err.operation).toBe('atomicWrite');
        expect(err.path).toBe(dirPath);
      }
    }
  });

  test('handles Uint8Array content', async () => {
    const targetPath = join(tempDir, 'binary.bin');
    const bytes = new Uint8Array([0x00, 0xff, 0x42]);
    await atomicWrite(targetPath, bytes);

    const result = await Bun.file(targetPath).bytes();
    expect(result[0]).toBe(0x00);
    expect(result[1]).toBe(0xff);
    expect(result[2]).toBe(0x42);
  });
});
