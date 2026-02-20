import { parse, stringify } from 'smol-toml';
import { ParseError } from '../errors';

export function readToml<T = unknown>(raw: string): T {
  try {
    return parse(raw) as T;
  } catch (error) {
    throw new ParseError(
      `Failed to parse TOML: ${error instanceof Error ? error.message : String(error)}`,
      {
        operation: 'readToml',
        path: '<string input>',
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}

export function writeToml(data: Record<string, unknown>): string {
  try {
    return stringify(data) + '\n';
  } catch (error) {
    throw new ParseError(
      `Failed to stringify TOML: ${error instanceof Error ? error.message : String(error)}`,
      {
        operation: 'writeToml',
        path: '<string output>',
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}
