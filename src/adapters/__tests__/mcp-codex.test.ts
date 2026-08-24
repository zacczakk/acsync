import { describe, test, expect } from 'bun:test';
import { CodexAdapter } from '../codex';
import { readToml } from '../../formats/toml';
import type { MCPServer } from '../../types';

const adapter = new CodexAdapter();

const httpServer: MCPServer = {
  name: 'context7',
  transport: 'http',
  url: 'https://mcp.context7.com/mcp',
  headers: {
    'X-Static': 'static-value',
    'X-Env': '${CONTEXT7_API_KEY}',
    Authorization: 'Bearer ${CONTEXT7_BEARER_TOKEN}',
  },
};

const stdioServer: MCPServer = {
  name: 'tavily',
  transport: 'stdio',
  command: 'python',
  args: ['-m', 'tavily_mcp'],
  envVars: ['TAVILY_API_KEY'],
  env: {
    TAVILY_API_KEY: '${TAVILY_API_KEY}',
    UPTIMIZE_ENV: 'dev',
  },
};

describe('CodexAdapter.renderMCPServers', () => {
  test('renders both stdio and HTTP servers', () => {
    const result = adapter.renderMCPServers([stdioServer, httpServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;

    expect(mcp.context7).toBeDefined();
    expect(mcp.tavily).toBeDefined();
  });

  test('produces TOML with mcp_servers section', () => {
    const result = adapter.renderMCPServers([httpServer]);
    expect(result).toContain('[mcp_servers.context7]');
  });

  test('includes url for HTTP server', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.context7.url).toBe('https://mcp.context7.com/mcp');
  });

  test('renders stdio env_vars array with bare variable names', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.tavily.env_vars).toEqual(['TAVILY_API_KEY']);
  });

  test('renders stdio env table', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.tavily.env).toEqual({
      TAVILY_API_KEY: '${TAVILY_API_KEY}',
      UPTIMIZE_ENV: 'dev',
    });
  });

  test('extracts bearer_token_env_var from Authorization header', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.context7.bearer_token_env_var).toBe('CONTEXT7_BEARER_TOKEN');
  });

  test('renders env_http_headers from ${VAR} header values', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.context7.env_http_headers).toEqual({ 'X-Env': 'CONTEXT7_API_KEY' });
  });

  test('renders http_headers from static header values', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.context7.http_headers).toEqual({ 'X-Static': 'static-value' });
  });

  test('omits bearer_token_env_var when Authorization is not bearer env-backed', () => {
    const noBearer: MCPServer = {
      name: 'simple-http',
      transport: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Basic abc123' },
    };
    const result = adapter.renderMCPServers([noBearer]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp['simple-http'].bearer_token_env_var).toBeUndefined();
  });

  test('omits stdio env_vars when not provided', () => {
    const noEnvVars: MCPServer = { name: 'bare', transport: 'stdio', command: 'mytool', args: [] };
    const result = adapter.renderMCPServers([noEnvVars]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;
    expect(mcp.bare.env_vars).toBeUndefined();
  });

  test('filters out servers disabled for codex', () => {
    const disabled: MCPServer = {
      name: 'not-for-codex',
      transport: 'stdio',
      command: 'nope',
      args: [],
      disabledFor: ['codex'],
    };
    const result = adapter.renderMCPServers([stdioServer, httpServer, disabled]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, unknown>;

    expect(mcp.context7).toBeDefined();
    expect(mcp.tavily).toBeDefined();
    expect(mcp['not-for-codex']).toBeUndefined();
  });

  test('returns empty string for empty server list', () => {
    const result = adapter.renderMCPServers([]);
    expect(result).toBe('');
  });

  test('handles multiple servers', () => {
    const second: MCPServer = {
      name: 'another-stdio',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
    };
    const result = adapter.renderMCPServers([httpServer, stdioServer, second]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, unknown>;
    expect(Object.keys(mcp)).toHaveLength(3);
  });

  test('renders enabled = false for disabled servers', () => {
    const disabled: MCPServer = {
      name: 'disabled-stdio',
      transport: 'stdio',
      command: 'node',
      args: ['disabled.js'],
      enabled: false,
    };
    const result = adapter.renderMCPServers([disabled]);
    const parsed = readToml<Record<string, unknown>>(result);
    const mcp = parsed.mcp_servers as Record<string, Record<string, unknown>>;

    expect(mcp['disabled-stdio'].enabled).toBe(false);
  });

  test('getRenderedServerNames excludes only disabledFor matches', () => {
    const disabled: MCPServer = {
      name: 'disabled-stdio',
      transport: 'stdio',
      command: 'node',
      args: ['disabled.js'],
      enabled: false,
    };
    const excluded: MCPServer = {
      name: 'excluded',
      transport: 'http',
      url: 'https://excluded.example/mcp',
      disabledFor: ['codex'],
    };
    const names = adapter.getRenderedServerNames([httpServer, stdioServer, disabled, excluded]);
    expect(names).toEqual(['context7', 'tavily', 'disabled-stdio']);
  });

  test('parseExistingMCPServerNames extracts mcp_servers keys from TOML', () => {
    const content = '[mcp_servers.context7]\nurl = "https://example.com"\n';
    const names = adapter.parseExistingMCPServerNames(content);
    expect(names).toEqual(['context7']);
  });

  test('parseExistingMCPServerNames returns empty for no mcp_servers', () => {
    expect(adapter.parseExistingMCPServerNames('model = "gpt-5"')).toEqual([]);
  });

  test('removesNonCanonicalOnPush returns true', () => {
    expect(adapter.removesNonCanonicalOnPush()).toBe(true);
  });

  test('parseMCPServers parses stdio servers and enabled: false', () => {
    const content = `
[mcp_servers.tavily]
command = "python"
args = ["-m", "tavily_mcp"]
env_vars = ["TAVILY_API_KEY", { name = "REMOTE_ONLY", source = "remote" }]
enabled = false

[mcp_servers.tavily.env]
TAVILY_API_KEY = "\${TAVILY_API_KEY}"
UPTIMIZE_ENV = "dev"
`;

    const [server] = adapter.parseMCPServers(content);

    expect(server).toEqual({
      name: 'tavily',
      transport: 'stdio',
      command: 'python',
      args: ['-m', 'tavily_mcp'],
      envVars: ['TAVILY_API_KEY', 'REMOTE_ONLY'],
      env: {
        TAVILY_API_KEY: '${TAVILY_API_KEY}',
        UPTIMIZE_ENV: 'dev',
      },
      enabled: false,
    });
  });

  test('parseMCPServers parses HTTP bearer, static headers, env headers, and enabled: false', () => {
    const content = `
[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"
bearer_token_env_var = "CONTEXT7_BEARER_TOKEN"
http_headers = { "X-Static" = "static-value" }
env_http_headers = { "X-Env" = "CONTEXT7_API_KEY" }
enabled = false
`;

    const [server] = adapter.parseMCPServers(content);

    expect(server).toEqual({
      name: 'context7',
      transport: 'http',
      url: 'https://mcp.context7.com/mcp',
      headers: {
        Authorization: 'Bearer ${CONTEXT7_BEARER_TOKEN}',
        'X-Static': 'static-value',
        'X-Env': '${CONTEXT7_API_KEY}',
      },
      enabled: false,
    });
  });
});
