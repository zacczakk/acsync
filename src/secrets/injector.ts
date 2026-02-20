export interface InjectSecretsResult {
  result: string;
  warnings: string[];
}

/**
 * Replace ${VAR_NAME} placeholders in content with values from secrets map.
 * Unresolved placeholders are left intact and produce a warning per variable.
 */
export function injectSecrets(
  content: string,
  secrets: Record<string, string>,
): InjectSecretsResult {
  const warnings: string[] = [];

  const result = content.replace(/\$\{([A-Za-z0-9_]+)\}/g, (match, varName: string) => {
    if (Object.prototype.hasOwnProperty.call(secrets, varName)) {
      return secrets[varName];
    }
    warnings.push(`Unresolved secret: ${varName}`);
    return match;
  });

  return { result, warnings };
}

/**
 * Replace actual secret values in content with ****.
 * Sorts by length descending to avoid partial-match issues.
 */
export function redactSecrets(
  content: string,
  secrets: Record<string, string>,
): string {
  const values = Object.values(secrets)
    .filter((v) => v.length > 0)
    .sort((a, b) => b.length - a.length);

  let result = content;
  for (const value of values) {
    // Escape special regex chars in the value
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), '****');
  }

  return result;
}
