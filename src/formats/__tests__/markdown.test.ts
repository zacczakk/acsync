import { describe, expect, test } from 'bun:test';
import { parseFrontmatter, stringifyFrontmatter } from '../markdown';
import { ParseError } from '../../errors';

describe('parseFrontmatter', () => {
  test('extracts data and content from markdown with YAML frontmatter', () => {
    const input = `---
title: Hello
tags:
  - a
  - b
---

# Body

Some content here.
`;
    const result = parseFrontmatter(input);
    expect(result.data.title).toBe('Hello');
    expect(result.data.tags).toEqual(['a', 'b']);
    expect(result.content.trim()).toContain('# Body');
    expect(result.content).toContain('Some content here.');
  });

  test('handles empty frontmatter', () => {
    const input = `---
---

Body text.
`;
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({});
    expect(result.content.trim()).toBe('Body text.');
  });

  test('handles markdown with no frontmatter', () => {
    const input = `# Just a heading

No frontmatter here.
`;
    const result = parseFrontmatter(input);
    expect(result.data).toEqual({});
    expect(result.content).toContain('# Just a heading');
  });

  test('content with --- inside body does not confuse parser', () => {
    const input = `---
title: Test
---

Some text

---

More text after separator.
`;
    const result = parseFrontmatter(input);
    expect(result.data.title).toBe('Test');
    expect(result.content).toContain('---');
    expect(result.content).toContain('More text after separator.');
  });

  test('throws ParseError on malformed YAML', () => {
    const input = `---
key: [invalid yaml
  : broken: {{
---

Body.
`;
    expect(() => parseFrontmatter(input)).toThrow(ParseError);
  });
});

describe('stringifyFrontmatter', () => {
  test('produces markdown with YAML frontmatter delimited by ---', () => {
    const result = stringifyFrontmatter('Body content', { title: 'Test', version: 1 });
    expect(result).toContain('---');
    expect(result).toContain('title: Test');
    expect(result).toContain('version: 1');
    expect(result).toContain('Body content');
  });

  test('handles empty data', () => {
    const result = stringifyFrontmatter('Just body', {});
    expect(result).toContain('Just body');
  });
});

describe('round-trip', () => {
  test('parseFrontmatter(stringifyFrontmatter(...)) preserves data and content', () => {
    const originalContent = 'Hello world\n\nParagraph two.';
    const originalData = { title: 'Test', count: 5, tags: ['x', 'y'] };

    const stringified = stringifyFrontmatter(originalContent, originalData);
    const parsed = parseFrontmatter(stringified);

    expect(parsed.data.title).toBe(originalData.title);
    expect(parsed.data.count).toBe(originalData.count);
    expect(parsed.data.tags).toEqual(originalData.tags);
    expect(parsed.content).toContain('Hello world');
    expect(parsed.content).toContain('Paragraph two.');
  });
});
