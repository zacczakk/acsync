import { createHash } from 'node:crypto';
import type { MCPServer } from '../types';

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return value;
}

/** Hash one parsed MCP server independently of file formatting or sibling servers. */
export function hashMCPServer(server: MCPServer | undefined): string | null {
  if (!server) return null;
  return createHash('sha256')
    .update(JSON.stringify(normalize(server)), 'utf-8')
    .digest('hex');
}
