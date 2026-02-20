import { describe, test, expect } from 'bun:test';
import { CodexAdapter } from '../codex';
import { readToml } from '../../formats/toml';
import type { MCPServer } from '../../types';

const adapter = new CodexAdapter();

const httpServer: MCPServer = {
  name: 'tavily',
  transport: 'http',
  url: 'https://mcp.tavily.com/mcp',
  envVars: ['TAVILY_API_KEY'],
  headers: { Authorization: 'Bearer ${TAVILY_API_KEY}' },
};

const stdioServer: MCPServer = {
  name: 'context7',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@context7/mcp'],
  env: { CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}' },
};

describe('CodexAdapter.renderMCPServers', () => {
  test('skips stdio servers entirely — only HTTP in output', () => {
    const result = adapter.renderMCPServers([stdioServer, httpServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, unknown>;

    expect(mcp.context7).toBeUndefined();
    expect(mcp.tavily).toBeDefined();
  });

  test('produces TOML with mcp_servers section', () => {
    const result = adapter.renderMCPServers([httpServer]);
    expect(result).toContain('[mcp_servers.tavily]');
  });

  test('includes url for http server', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.tavily.url).toBe('https://mcp.tavily.com/mcp');
  });

  test('env_vars array contains bare variable names (no ${} wrapping)', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.tavily.env_vars).toEqual(['TAVILY_API_KEY']);
  });

  test('extracts bearer_token_env_var from Authorization header', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.tavily.bearer_token_env_var).toBe('TAVILY_API_KEY');
  });

  test('omits bearer_token_env_var when no Authorization header', () => {
    const noAuth: MCPServer = {
      name: 'simple',
      transport: 'http',
      url: 'https://example.com/mcp',
      envVars: ['API_KEY'],
    };
    const result = adapter.renderMCPServers([noAuth]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.simple.bearer_token_env_var).toBeUndefined();
  });

  test('omits env_vars when not provided', () => {
    const noEnvVars: MCPServer = {
      name: 'minimal',
      transport: 'http',
      url: 'https://example.com/mcp',
    };
    const result = adapter.renderMCPServers([noEnvVars]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.minimal.env_vars).toBeUndefined();
  });

  test('filters out servers disabled for codex', () => {
    const disabled: MCPServer = {
      name: 'not-for-codex',
      transport: 'http',
      url: 'https://example.com/mcp',
      disabledFor: ['codex'],
    };
    const result = adapter.renderMCPServers([httpServer, disabled]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, unknown>;

    expect(mcp.tavily).toBeDefined();
    expect(mcp['not-for-codex']).toBeUndefined();
  });

  test('returns empty string when all servers are stdio', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    expect(result).toBe('');
  });

  test('returns empty string for empty server list', () => {
    const result = adapter.renderMCPServers([]);
    expect(result).toBe('');
  });

  test('handles multiple HTTP servers', () => {
    const second: MCPServer = {
      name: 'another',
      transport: 'http',
      url: 'https://another.com/mcp',
    };
    const result = adapter.renderMCPServers([httpServer, second]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, unknown>;
    expect(Object.keys(mcp)).toHaveLength(2);
  });
});
