import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readCanonicalMCPServers } from '../canonical';

describe('readCanonicalMCPServers', () => {
  test('normalizes snake_case MCP fields from canonical JSON', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'canonical-mcp-'));
    const mcpDir = join(projectDir, 'configs', 'mcp');
    mkdirSync(mcpDir, { recursive: true });

    writeFileSync(join(mcpDir, 'context7.json'), JSON.stringify({
      transport: 'http',
      url: 'https://mcp.context7.com/mcp',
      headers: { 'X-Env': '${CONTEXT7_API_KEY}' },
      env_vars: ['CONTEXT7_API_KEY'],
      disabled_for: ['codex'],
      target_options: {
        opencode: { timeout: 20_000 },
      },
      enabled: false,
    }, null, 2));

    const [server] = await readCanonicalMCPServers(projectDir);

    expect(server).toEqual({
      name: 'context7',
      transport: 'http',
      url: 'https://mcp.context7.com/mcp',
      headers: { 'X-Env': '${CONTEXT7_API_KEY}' },
      envVars: ['CONTEXT7_API_KEY'],
      disabledFor: ['codex'],
      targetOptions: {
        opencode: { timeout: 20_000 },
      },
      enabled: false,
    });
  });
});
