import { describe, test, expect } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

  test('renders http server with httpUrl and headers', () => {
    const result = adapter.renderMCPServers([httpServer]);
    const parsed = JSON.parse(result);

    expect(parsed.mcpServers.tavily).toEqual({
      httpUrl: 'https://mcp.tavily.com/mcp',
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
    expect(parsed.mcpServers.thinking).toBeDefined();
    expect(parsed.mcp.excluded).toEqual(['thinking']);
  });

  test('getRenderedServerNames includes enabled: false servers', () => {
    const disabled: MCPServer = {
      name: 'thinking',
      transport: 'stdio',
      command: 'npx',
      enabled: false,
    };
    const names = adapter.getRenderedServerNames([stdioServer, disabled]);
    expect(names).toEqual(['context7', 'thinking']);
  });

  test('parseMCPServers reads httpUrl back into canonical url', () => {
    const content = JSON.stringify({
      mcpServers: {
        tavily: {
          httpUrl: 'https://mcp.tavily.com/mcp',
          headers: { Authorization: 'Bearer ${TAVILY_API_KEY}' },
        },
      },
    });

    const [server] = adapter.parseMCPServers(content);

    expect(server).toMatchObject({
      name: 'tavily',
      transport: 'http',
      url: 'https://mcp.tavily.com/mcp',
      headers: { Authorization: 'Bearer ${TAVILY_API_KEY}' },
    });
  });

  test('parseMCPServers marks mcp.excluded servers as disabled', () => {
    const content = JSON.stringify({
      mcpServers: {
        thinking: {
          command: 'npx',
          args: ['-y', '@mcp/thinking'],
        },
      },
      mcp: {
        excluded: ['thinking'],
      },
    });

    const [server] = adapter.parseMCPServers(content);

    expect(server?.enabled).toBe(false);
  });

  test('parseMCPServers marks servers disabled in mcp-server-enablement.json as disabled', () => {
    const fakeHome = path.join(os.tmpdir(), `gemini-enablement-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    mkdirSync(path.join(fakeHome, '.gemini'), { recursive: true });
    writeFileSync(
      path.join(fakeHome, '.gemini/mcp-server-enablement.json'),
      JSON.stringify({ thinking: { enabled: false } }, null, 2),
    );

    const adapterWithHome = new GeminiAdapter(fakeHome);
    const content = JSON.stringify({
      mcpServers: {
        thinking: {
          command: 'npx',
          args: ['-y', '@mcp/thinking'],
        },
      },
    });

    const [server] = adapterWithHome.parseMCPServers(content);

    expect(server?.enabled).toBe(false);
  });
});
