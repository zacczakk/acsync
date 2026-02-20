import { describe, test, expect } from 'bun:test';
import { ClaudeCodeAdapter } from '../claude-code';
import type { MCPServer } from '../../types';

const adapter = new ClaudeCodeAdapter();

const stdioServer: MCPServer = {
  name: 'context7',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@context7/mcp'],
  env: { CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}' },
};

const httpServer: MCPServer = {
  name: 'tavily',
  transport: 'http',
  url: 'https://mcp.tavily.com/mcp',
  headers: { Authorization: 'Bearer ${TAVILY_API_KEY}' },
};

describe('ClaudeCodeAdapter.renderMCPServers', () => {
  test('renders stdio server with command, args, and env', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    const parsed = JSON.parse(result);

    expect(parsed.mcpServers).toBeDefined();
    expect(parsed.mcpServers.context7).toEqual({
      command: 'npx',
      args: ['-y', '@context7/mcp'],
      env: { CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}' },
    });
  });

  test('env vars remain as ${VAR} placeholders (no conversion)', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    expect(result).toContain('${CONTEXT7_API_KEY}');
  });

  test('renders http server with url and headers', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = JSON.parse(result);

    expect(parsed.mcpServers.tavily).toEqual({
      url: 'https://mcp.tavily.com/mcp',
      headers: { Authorization: 'Bearer ${TAVILY_API_KEY}' },
    });
  });

  test('omits env key when server has no env', () => {
    const server: MCPServer = {
      name: 'simple',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
    };
    const result = adapter.renderMCPServers([server]);
    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.simple.env).toBeUndefined();
  });

  test('filters out servers disabled for claude-code', () => {
    const disabled: MCPServer = {
      name: 'opencode-only',
      transport: 'stdio',
      command: 'some-tool',
      disabledFor: ['claude-code'],
    };
    const result = adapter.renderMCPServers([stdioServer, disabled]);
    const parsed = JSON.parse(result);

    expect(parsed.mcpServers.context7).toBeDefined();
    expect(parsed.mcpServers['opencode-only']).toBeUndefined();
  });

  test('merges with existing settings.json preserving other keys', () => {
    const existing = JSON.stringify({
      permissions: { allow: ['Bash'] },
      otherKey: 42,
    });
    const result = adapter.renderMCPServers([stdioServer], existing);
    const parsed = JSON.parse(result);

    expect(parsed.permissions).toEqual({ allow: ['Bash'] });
    expect(parsed.otherKey).toBe(42);
    expect(parsed.mcpServers.context7).toBeDefined();
  });

  test('overwrites existing mcpServers key when merging', () => {
    const existing = JSON.stringify({
      mcpServers: { oldServer: { command: 'old', args: [] } },
    });
    const result = adapter.renderMCPServers([stdioServer], existing);
    const parsed = JSON.parse(result);

    expect(parsed.mcpServers.oldServer).toBeUndefined();
    expect(parsed.mcpServers.context7).toBeDefined();
  });

  test('empty server list produces empty mcpServers object', () => {
    const result = adapter.renderMCPServers([]);
    const parsed = JSON.parse(result);
    expect(parsed.mcpServers).toEqual({});
  });

  test('renders multiple servers in one call', () => {
    const result = adapter.renderMCPServers([stdioServer, httpServer]);
    const parsed = JSON.parse(result);
    expect(Object.keys(parsed.mcpServers)).toHaveLength(2);
  });

  test('output is valid JSON with trailing newline', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(result.endsWith('\n')).toBe(true);
  });

  test('excludes servers with enabled: false (no native disabled support)', () => {
    const disabled: MCPServer = {
      name: 'thinking',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@mcp/thinking'],
      enabled: false,
    };
    const result = adapter.renderMCPServers([stdioServer, disabled]);
    const parsed = JSON.parse(result);

    expect(parsed.mcpServers.context7).toBeDefined();
    expect(parsed.mcpServers.thinking).toBeUndefined();
  });

  test('getRenderedServerNames excludes enabled: false servers', () => {
    const disabled: MCPServer = {
      name: 'thinking',
      transport: 'stdio',
      command: 'npx',
      enabled: false,
    };
    const names = adapter.getRenderedServerNames([stdioServer, disabled]);
    expect(names).toEqual(['context7']);
  });

  test('parseExistingMCPServerNames extracts mcpServers keys', () => {
    const content = JSON.stringify({
      mcpServers: { context7: {}, tavily: {}, 'chrome-devtools': {} },
    });
    const names = adapter.parseExistingMCPServerNames(content);
    expect(names).toEqual(['context7', 'tavily', 'chrome-devtools']);
  });

  test('parseExistingMCPServerNames returns empty for no mcpServers', () => {
    expect(adapter.parseExistingMCPServerNames('{}')).toEqual([]);
    expect(adapter.parseExistingMCPServerNames('invalid')).toEqual([]);
  });

  test('removesNonCanonicalOnPush returns true', () => {
    expect(adapter.removesNonCanonicalOnPush()).toBe(true);
  });
});
