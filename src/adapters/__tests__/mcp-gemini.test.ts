import { describe, test, expect } from 'bun:test';
import { GeminiAdapter } from '../gemini';
import type { MCPServer } from '../../types';

const adapter = new GeminiAdapter();

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

describe('GeminiAdapter.renderMCPServers', () => {
  test('renders same shape as Claude Code — mcpServers key in JSON', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    const parsed = JSON.parse(result);
    expect(parsed.mcpServers).toBeDefined();
  });

  test('renders stdio server with command, args, env', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    const parsed = JSON.parse(result);

    expect(parsed.mcpServers.context7).toEqual({
      command: 'npx',
      args: ['-y', '@context7/mcp'],
      env: { CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}' },
    });
  });

  test('env vars remain as ${VAR} format (same as Claude Code)', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    expect(result).toContain('${CONTEXT7_API_KEY}');
    expect(result).not.toContain('{env:');
  });

  test('renders http server with url and headers', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = JSON.parse(result);

    expect(parsed.mcpServers.tavily).toEqual({
      url: 'https://mcp.tavily.com/mcp',
      headers: { Authorization: 'Bearer ${TAVILY_API_KEY}' },
    });
  });

  test('filters out servers disabled for gemini', () => {
    const disabled: MCPServer = {
      name: 'not-for-gemini',
      transport: 'stdio',
      command: 'some-tool',
      disabledFor: ['gemini'],
    };
    const result = adapter.renderMCPServers([stdioServer, disabled]);
    const parsed = JSON.parse(result);

    expect(parsed.mcpServers.context7).toBeDefined();
    expect(parsed.mcpServers['not-for-gemini']).toBeUndefined();
  });

  test('merges with existing settings.json preserving other keys', () => {
    const existing = JSON.stringify({ apiKey: 'abc', theme: 'dark' });
    const result = adapter.renderMCPServers([stdioServer], existing);
    const parsed = JSON.parse(result);

    expect(parsed.apiKey).toBe('abc');
    expect(parsed.theme).toBe('dark');
    expect(parsed.mcpServers.context7).toBeDefined();
  });

  test('empty server list produces empty mcpServers object', () => {
    const result = adapter.renderMCPServers([]);
    const parsed = JSON.parse(result);
    expect(parsed.mcpServers).toEqual({});
  });

  test('output is valid JSON with trailing newline', () => {
    const result = adapter.renderMCPServers([stdioServer]);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(result.endsWith('\n')).toBe(true);
  });

  test('stdio server omits env key when no env configured', () => {
    const noEnv: MCPServer = { name: 'bare', transport: 'stdio', command: 'mytool', args: [] };
    const result = adapter.renderMCPServers([noEnv]);
    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.bare.env).toBeUndefined();
  });
});
