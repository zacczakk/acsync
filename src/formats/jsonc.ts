import { parse, modify, applyEdits } from 'jsonc-parser';
import type { FormattingOptions } from 'jsonc-parser';
import { ParseError } from '../errors';

const FORMATTING: FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
  eol: '\n',
};

export function readJsonc<T = unknown>(raw: string): T {
  const errors: { error: number; offset: number; length: number }[] = [];
  const result = parse(raw, errors, { allowTrailingComma: true });

  if (errors.length > 0) {
    throw new ParseError(
      `Failed to parse JSONC: ${errors.length} error(s) at offset ${errors[0].offset}`,
      {
        operation: 'readJsonc',
        path: '<string input>',
        cause: new Error(`JSONC parse error at offset ${errors[0].offset}`),
      },
    );
  }

  return result as T;
}

export function modifyJsonc(
  existingText: string,
  path: (string | number)[],
  value: unknown,
): string {
  try {
    const edits = modify(existingText, path, value, {
      formattingOptions: FORMATTING,
    });
    return applyEdits(existingText, edits);
  } catch (error) {
    throw new ParseError(
      `Failed to modify JSONC at path [${path.join('.')}]: ${error instanceof Error ? error.message : String(error)}`,
      {
        operation: 'modifyJsonc',
        path: `[${path.join('.')}]`,
        cause: error instanceof Error ? error : new Error(String(error)),
      },
    );
  }
}
