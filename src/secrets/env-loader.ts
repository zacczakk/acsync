export interface LoadSecretsResult {
  secrets: Record<string, string>;
  warnings: string[];
}

/**
 * Parse a .env file and return key-value pairs.
 * Handles: quoted values, comments, blank lines, export prefix.
 * Does not perform variable expansion.
 * Missing file returns empty secrets + warning (does not throw).
 */
export async function loadSecrets(envPath: string): Promise<LoadSecretsResult> {
  const file = Bun.file(envPath);
  const exists = await file.exists();

  if (!exists) {
    return {
      secrets: {},
      warnings: [`No .env file found at ${envPath}`],
    };
  }

  const text = await file.text();
  const secrets: Record<string, string> = {};
  const warnings: string[] = [];

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    // Skip blanks and comments
    if (!line || line.startsWith('#')) continue;

    // Strip optional "export " prefix
    const stripped = line.startsWith('export ') ? line.slice(7).trim() : line;

    const eqIdx = stripped.indexOf('=');
    if (eqIdx === -1) {
      // Malformed line — skip silently
      continue;
    }

    const key = stripped.slice(0, eqIdx).trim();
    if (!key) continue;

    let value = stripped.slice(eqIdx + 1);

    // Strip surrounding quotes (single or double)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    secrets[key] = value;
  }

  return { secrets, warnings };
}
