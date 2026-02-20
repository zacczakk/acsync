import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { loadSecrets } from '../env-loader';
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';

const tmpDir = join(os.tmpdir(), 'env-loader-test-' + process.pid);

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeEnv(filename: string, content: string): string {
  const p = join(tmpDir, filename);
  writeFileSync(p, content, 'utf-8');
  return p;
}

describe('loadSecrets', () => {
  it('returns empty secrets and warning when file does not exist', async () => {
    const result = await loadSecrets(join(tmpDir, 'nonexistent.env'));
    expect(result.secrets).toEqual({});
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('No .env file found');
  });

  it('parses simple KEY=VALUE pairs', async () => {
    const p = writeEnv('.env', 'FOO=bar\nBAZ=qux\n');
    const result = await loadSecrets(p);
    expect(result.secrets).toEqual({ FOO: 'bar', BAZ: 'qux' });
    expect(result.warnings).toHaveLength(0);
  });

  it('strips double-quoted values', async () => {
    const p = writeEnv('.env', 'TOKEN="my secret value"\n');
    const { secrets } = await loadSecrets(p);
    expect(secrets['TOKEN']).toBe('my secret value');
  });

  it('strips single-quoted values', async () => {
    const p = writeEnv('.env', "KEY='hello world'\n");
    const { secrets } = await loadSecrets(p);
    expect(secrets['KEY']).toBe('hello world');
  });

  it('skips comment lines', async () => {
    const p = writeEnv('.env', '# this is a comment\nFOO=bar\n');
    const { secrets } = await loadSecrets(p);
    expect(Object.keys(secrets)).toEqual(['FOO']);
  });

  it('skips blank lines', async () => {
    const p = writeEnv('.env', '\nFOO=bar\n\nBAZ=qux\n');
    const { secrets } = await loadSecrets(p);
    expect(secrets).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('handles export prefix', async () => {
    const p = writeEnv('.env', 'export API_KEY=abc123\n');
    const { secrets } = await loadSecrets(p);
    expect(secrets['API_KEY']).toBe('abc123');
  });

  it('skips malformed lines without an equals sign', async () => {
    const p = writeEnv('.env', 'NOEQUALS\nFOO=bar\n');
    const { secrets } = await loadSecrets(p);
    expect(secrets).toEqual({ FOO: 'bar' });
  });

  it('value may contain = sign', async () => {
    const p = writeEnv('.env', 'URL=https://example.com?a=1&b=2\n');
    const { secrets } = await loadSecrets(p);
    expect(secrets['URL']).toBe('https://example.com?a=1&b=2');
  });
});
