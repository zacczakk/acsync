import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dir, '../..');

describe('bundled Office Python scripts', () => {
  test('all scripts compile', async () => {
    const paths: string[] = [];
    const glob = new Bun.Glob('configs/skills/{docx,pptx,xlsx}/scripts/**/*.py');
    for await (const path of glob.scan({ cwd: root, onlyFiles: true })) paths.push(path);

    const result = spawnSync('python3', [
      '-c',
      'import pathlib, sys\nfor path in sys.argv[1:]: compile(pathlib.Path(path).read_bytes(), path, "exec")',
      ...paths,
    ], { cwd: root, encoding: 'utf8' });

    expect(paths.length).toBeGreaterThan(0);
    expect(result.status, result.stderr).toBe(0);
  });

  test('add_slide registers a duplicated slide in an unpacked PPTX', () => {
    const deck = mkdtempSync(join(tmpdir(), 'metronome-pptx-'));
    mkdirSync(join(deck, 'ppt', 'slides', '_rels'), { recursive: true });
    mkdirSync(join(deck, 'ppt', '_rels'), { recursive: true });
    writeFileSync(join(deck, '[Content_Types].xml'), '<Types></Types>');
    writeFileSync(join(deck, 'ppt', 'slides', 'slide1.xml'), '<p:sld/>');
    writeFileSync(join(deck, 'ppt', 'presentation.xml'), '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>');
    writeFileSync(join(deck, 'ppt', '_rels', 'presentation.xml.rels'), '<Relationships><Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/></Relationships>');

    const result = spawnSync('python3', [
      join(root, 'configs/skills/pptx/scripts/add_slide.py'), deck, 'slide1.xml',
    ], { cwd: root, encoding: 'utf8' });

    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(join(deck, 'ppt', 'slides', 'slide2.xml'), 'utf8')).toBe('<p:sld/>');
    expect(readFileSync(join(deck, '[Content_Types].xml'), 'utf8')).toContain('/ppt/slides/slide2.xml');
    expect(readFileSync(join(deck, 'ppt', '_rels', 'presentation.xml.rels'), 'utf8')).toContain('Target="slides/slide2.xml"');
    expect(readFileSync(join(deck, 'ppt', 'presentation.xml'), 'utf8')).toContain('<p:sldId id="257" r:id="rId2"/>');
  });
});
