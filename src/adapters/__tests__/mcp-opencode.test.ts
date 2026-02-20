import { describe, test, expect } from 'bun:test';
import { OpenCodeAdapter } from '../opencode';
import { readJsonc } from '../../formats/jsonc';
import type { MCPServer } from '../../types';

const adapter = new OpenCodeAdapter();

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
  env: { TAVILY_API_KEY: '${TAVILY_API_KEY}' },
};

describe('OpenCodeAdapter.renderMCPServers', () => {
  test('renders stdio server as local type with command array', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    const parsed = readJsonc<Record<string, unknown>>(result);
    const mcp = parsed.mcp as Record<string, Record<string, unknown>>;

    expect(mcp.context7.type).toBe('local');
    expect(mcp.context7.command).toEqual(['npx', '-y', '@context7/mcp']);
  });

  test('renders http server as remote type with url', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = readJsonc<Record<string, unknown>>(result);
    const mcp = parsed.mcp as Record<string, Record<string, unknown>>;

    expect(mcp.tavily.type).toBe('remote');
    expect(mcp.tavily.url).toBe('https://mcp.tavily.com/mcp');
  });

  test('converts env vars to OpenCode {env:VAR} format', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    expect(result).toContain('{env:CONTEXT7_API_KEY}');
    expect(result).not.toContain('${CONTEXT7_API_KEY}');
  });

  test('env vars in http server also converted', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = readJsonc<Record<string, unknown>>(result);
    const mcp = parsed.mcp as Record<string, Record<string, unknown>>;
    const env = mcp.tavily.environment as Record<string, string>;

    expect(env.TAVILY_API_KEY).toBe('{env:TAVILY_API_KEY}');
  });

  test('omits environment key when no env vars', () => {
    const server: MCPServer = {
      name: 'simple',
      transport: 'stdio',
      command: 'node',
      args: ['server.js'],
    };
    const result = adapter.renderMCPServers([server]);
    const parsed = readJsonc<Record<string, unknown>>(result);
    const mcp = parsed.mcp as Record<string, Record<string, unknown>>;
    expect(mcp.simple.environment).toBeUndefined();
  });

  test('filters out servers disabled for opencode', () => {
    const disabled: MCPServer = {
      name: 'claude-only',
      transport: 'stdio',
      command: 'some-tool',
      disabledFor: ['opencode'],
    };
    const result = adapter.renderMCPServers([stdioServer, disabled]);
    const parsed = readJsonc<Record<string, unknown>>(result);
    const mcp = parsed.mcp as Record<string, unknown>;

    expect(mcp.context7).toBeDefined();
    expect(mcp['claude-only']).toBeUndefined();
  });

  test('preserves existing JSONC comments when merging', () => {
    const existing = `{
  // This is a comment
  "theme": "dark"
}`;
    const result = adapter.renderMCPServers([stdioServer], existing);
    expect(result).toContain('// This is a comment');
    expect(result).toContain('"theme"');
    const parsed = readJsonc<Record<string, unknown>>(result);
    expect((parsed as Record<string, unknown>).theme).toBe('dark');
  });

  test('starts with empty {} when no existingContent', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    expect(() => readJsonc(result)).not.toThrow();
  });

  test('output contains mcp key at root', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    const parsed = readJsonc<Record<string, unknown>>(result);
    expect(parsed.mcp).toBeDefined();
  });

  test('command array includes command + args (no undefined)', () => {
    const noArgs: MCPServer = {
      name: 'minimal',
      transport: 'stdio',
      command: 'mytool',
    };
    const result = adapter.renderMCPServers([noArgs]);
    const parsed = readJsonc<Record<string, unknown>>(result);
    const mcp = parsed.mcp as Record<string, Record<string, unknown>>;
    expect(mcp.minimal.command).toEqual(['mytool']);
  });

  test('empty server list produces empty mcp object', () => {
    const result = adapter.renderMCPServers([]);
    const parsed = readJsonc<Record<string, unknown>>(result);
    expect(parsed.mcp).toEqual({});
  });
});
