import { ParseError } from '../errors';

export function readJson<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new ParseError(
      `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
      {
        operation: 'readJson',
        path: '<string input>',
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}

export function writeJson(data: unknown, indent?: number): string {
  try {
    return JSON.stringify(data, null, indent ?? 2) + '\n';
  } catch (error) {
    throw new ParseError(
      `Failed to stringify JSON: ${error instanceof Error ? error.message : String(error)}`,
      {
        operation: 'writeJson',
        path: '<string output>',
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}
