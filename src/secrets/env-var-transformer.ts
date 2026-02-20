/**
 * Environment Variable Transformer
 * Converts env var syntax between claude-code, opencode, gemini, and codex formats.
 *
 * Format reference:
 *   claude-code / gemini : ${VAR_NAME}
 *   opencode             : {env:VAR_NAME}
 *   codex                : bare VAR_NAME (strips ${} wrapper)
 *
 * Normalizes through claude-code format as intermediate.
 */

export type EnvVarFormat = 'claude-code' | 'opencode' | 'gemini' | 'codex';

export class EnvVarTransformer {
  static transform(value: unknown, from: EnvVarFormat, to: EnvVarFormat): unknown {
    if (from === to) return value;

    if (typeof value === 'string') {
      return this.transformString(value, from, to);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.transform(item, from, to));
    }

    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.transform(item, from, to);
      }
      return result;
    }

    return value;
  }

  /** claude-code → opencode */
  static toOpenCode(value: unknown): unknown {
    return this.transform(value, 'claude-code', 'opencode');
  }

  /** opencode → claude-code */
  static fromOpenCode(value: unknown): unknown {
    return this.transform(value, 'opencode', 'claude-code');
  }

  private static transformString(value: string, from: EnvVarFormat, to: EnvVarFormat): string {
    const normalized = this.toNormalized(value, from);
    return this.fromNormalized(normalized, to);
  }

  /** Convert any format → normalized ${VAR} (claude-code / gemini format) */
  private static toNormalized(value: string, from: EnvVarFormat): string {
    switch (from) {
      case 'claude-code':
      case 'gemini':
        return value; // already normalized

      case 'opencode':
        // {env:VAR} → ${VAR}
        return value.replace(/\{env:([A-Za-z0-9_]+)\}/g, '${$1}');

      case 'codex':
        // bare VAR_NAME in arrays — nothing to normalize at string level;
        // codex vars appear as plain strings, not wrapped
        return value;
    }
  }

  /** Convert normalized ${VAR} → target format */
  private static fromNormalized(value: string, to: EnvVarFormat): string {
    switch (to) {
      case 'claude-code':
      case 'gemini':
        return value; // already in target format

      case 'opencode':
        // ${VAR} → {env:VAR}  (uppercase vars only, per convention)
        return value.replace(/\$\{([A-Z0-9_]+)\}/g, '{env:$1}');

      case 'codex':
        // Strip ${} wrapper — return bare var name
        return value.replace(/\$\{([A-Za-z0-9_]+)\}/g, '$1');
    }
  }
}
