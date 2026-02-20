import matter from 'gray-matter';
import { ParseError } from '../errors';

export function parseFrontmatter(
  raw: string,
): { data: Record<string, unknown>; content: string } {
  try {
    const result = matter(raw);
    return {
      data: result.data as Record<string, unknown>,
      content: result.content,
    };
  } catch (error) {
    throw new ParseError(
      `Failed to parse frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      {
        operation: 'parseFrontmatter',
        path: '<string input>',
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}

export function stringifyFrontmatter(
  content: string,
  data: Record<string, unknown>,
): string {
  try {
    return matter.stringify(content, data);
  } catch (error) {
    throw new ParseError(
      `Failed to stringify frontmatter: ${error instanceof Error ? error.message : String(error)}`,
      {
        operation: 'stringifyFrontmatter',
        path: '<string output>',
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}
