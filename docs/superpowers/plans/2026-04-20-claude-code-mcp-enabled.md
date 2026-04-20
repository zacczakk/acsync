# Claude Code MCP Enabled Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Claude Code MCP adapter parity for canonical `enabled: false` so disabled servers render, round-trip, and participate correctly in drift checks.

**Architecture:** Keep the change adapter-local in `ClaudeCodeAdapter`. Override only the Claude-specific MCP rendering, rendered-name tracking, and reverse parsing paths. Preserve existing `disabledFor` omission semantics and leave all other adapters unchanged.

**Tech Stack:** TypeScript, Bun test runner, adapter render/parse layer

---

## File Map

- Modify: `src/adapters/claude-code.ts`
  - Claude-specific MCP render behavior
  - Claude-specific rendered-name policy
  - Claude-specific reverse parse for `enabled: false`
- Modify: `src/adapters/__tests__/mcp-claude-code.test.ts`
  - render + rendered-name coverage for disabled Claude servers
- Optional modify: `src/adapters/__tests__/reverse-parsing.test.ts`
  - only if Claude reverse parsing coverage fits better there than in the MCP test file

## Task 1: Lock Failing Claude MCP Tests First

**Files:**
- Modify: `src/adapters/__tests__/mcp-claude-code.test.ts`
- Test: `src/adapters/__tests__/mcp-claude-code.test.ts`

- [ ] **Step 1: Replace the current Claude disabled-server expectations with failing parity tests**

Add or update tests in `src/adapters/__tests__/mcp-claude-code.test.ts` so the Claude adapter is expected to keep disabled servers instead of dropping them.

```ts
test('renders enabled: false servers with disabled flag', () => {
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
  expect(parsed.mcpServers.thinking.enabled).toBe(false);
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

test('parseMCPServers preserves enabled: false from Claude config', () => {
  const content = JSON.stringify({
    mcpServers: {
      context7: {
        command: 'npx',
        args: ['-y', '@context7/mcp'],
        env: { CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}' },
      },
      thinking: {
        command: 'npx',
        args: ['-y', '@mcp/thinking'],
        enabled: false,
      },
    },
  });

  const servers = adapter.parseMCPServers(content);
  expect(servers).toEqual([
    {
      name: 'context7',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@context7/mcp'],
      env: { CONTEXT7_API_KEY: '${CONTEXT7_API_KEY}' },
      envVars: ['CONTEXT7_API_KEY'],
    },
    {
      name: 'thinking',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@mcp/thinking'],
      enabled: false,
    },
  ]);
});

test('parseMCPServers leaves enabled undefined when omitted', () => {
  const content = JSON.stringify({
    mcpServers: {
      tavily: {
        type: 'http',
        url: 'https://mcp.tavily.com/mcp',
        headers: { Authorization: 'Bearer ${TAVILY_API_KEY}' },
      },
    },
  });

  const [server] = adapter.parseMCPServers(content);
  expect(server).toEqual({
    name: 'tavily',
    transport: 'http',
    url: 'https://mcp.tavily.com/mcp',
    headers: { Authorization: 'Bearer ${TAVILY_API_KEY}' },
  });
  expect(server.enabled).toBeUndefined();
});
```

- [ ] **Step 2: Run the Claude MCP test file and confirm the new expectations fail**

Run:

```bash
bun test src/adapters/__tests__/mcp-claude-code.test.ts
```

Expected:

```text
failures in the tests expecting Claude to keep enabled: false servers
```

- [ ] **Step 3: Verify the unchanged omission test for `disabledFor` still exists**

Ensure this test remains in the file unchanged:

```ts
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
```

- [ ] **Step 4: Re-run the single omission test to confirm it still passes before implementation**

Run:

```bash
bun test src/adapters/__tests__/mcp-claude-code.test.ts --test-name-pattern "filters out servers disabled for claude-code"
```

Expected:

```text
1 pass
```

## Task 2: Implement Claude Adapter Parity

**Files:**
- Modify: `src/adapters/claude-code.ts`
- Test: `src/adapters/__tests__/mcp-claude-code.test.ts`

- [ ] **Step 1: Override Claude rendered-name policy to include disabled servers**

Insert this method into `src/adapters/claude-code.ts` above `renderMCPServers`:

```ts
  override getRenderedServerNames(servers: MCPServer[]): string[] {
    return servers
      .filter((s) => !s.disabledFor?.includes('claude-code'))
      .map((s) => s.name);
  }
```

- [ ] **Step 2: Update `renderMCPServers()` to keep `enabled: false` servers and emit the flag only when false**

Change the filter and config assembly inside `renderMCPServers()` to this shape:

```ts
  renderMCPServers(servers: MCPServer[], existingContent?: string): string {
    const filtered = servers.filter((s) => !s.disabledFor?.includes('claude-code'));

    const mcpServers: Record<string, unknown> = {};
    for (const server of filtered) {
      if (server.transport === 'stdio') {
        const cfg: Record<string, unknown> = { command: server.command, args: server.args ?? [] };
        if (server.env && Object.keys(server.env).length > 0) cfg.env = server.env;
        if (server.enabled === false) cfg.enabled = false;
        mcpServers[server.name] = cfg;
      } else {
        const cfg: Record<string, unknown> = { type: 'http', url: server.url };
        if (server.headers && Object.keys(server.headers).length > 0) cfg.headers = server.headers;
        if (server.enabled === false) cfg.enabled = false;
        mcpServers[server.name] = cfg;
      }
    }

    let base: Record<string, unknown> = {};
    if (existingContent) {
      base = readJson<Record<string, unknown>>(existingContent);
    }

    return writeJson({ ...base, mcpServers });
  }
```

- [ ] **Step 3: Override `parseMCPServers()` for Claude so reverse parsing keeps the disabled state**

Add this method below `extractSettingsKeys()` in `src/adapters/claude-code.ts`:

```ts
  override parseMCPServers(content: string): MCPServer[] {
    try {
      const parsed = readJson<Record<string, unknown>>(content);
      const mcpServers = parsed.mcpServers as Record<string, Record<string, unknown>> | undefined;
      if (!mcpServers) return [];

      const servers: MCPServer[] = [];
      for (const [name, cfg] of Object.entries(mcpServers)) {
        const transport: 'stdio' | 'http' = cfg.command ? 'stdio' : 'http';
        const server: MCPServer = { name, transport };

        if (transport === 'stdio') {
          server.command = cfg.command as string;
          if (cfg.args) server.args = cfg.args as string[];
          if (cfg.env && typeof cfg.env === 'object') {
            server.env = cfg.env as Record<string, string>;
            server.envVars = Object.keys(cfg.env as Record<string, string>);
          }
        } else {
          server.url = cfg.url as string;
          if (cfg.headers && typeof cfg.headers === 'object') {
            server.headers = cfg.headers as Record<string, string>;
          }
        }

        if (cfg.enabled === false) server.enabled = false;

        servers.push(server);
      }

      return servers;
    } catch {
      return [];
    }
  }
```

- [ ] **Step 4: Run the focused Claude MCP test file and confirm it passes**

Run:

```bash
bun test src/adapters/__tests__/mcp-claude-code.test.ts
```

Expected:

```text
all tests in mcp-claude-code.test.ts pass
```

## Task 3: Verify Integration Behavior

**Files:**
- Modify: none expected unless a test gap is found
- Test: `src/adapters/__tests__/mcp-claude-code.test.ts`
- Test: repository test suite

- [ ] **Step 1: Verify rendered-name logic matches `check.ts` assumptions**

Read this existing logic in `src/cli/check.ts` and confirm no code change is required because the new Claude override now matches it:

```ts
const renderedNames = new Set(adapter.getRenderedServerNames(mcpServers));
const existingNames = adapter.parseExistingMCPServerNames(existingContent);
const nonCanonical = existingNames.filter((n) => !renderedNames.has(n));
```

Success condition:

```text
disabled Claude servers are in renderedNames, so they will not be flagged as non-canonical
```

- [ ] **Step 2: Run the adapter-focused test subset**

Run:

```bash
bun test src/adapters/__tests__
```

Expected:

```text
adapter test suite passes with no regressions in OpenCode, Gemini, or Codex tests
```

- [ ] **Step 3: Run the full test suite**

Run:

```bash
bun test
```

Expected:

```text
full test suite passes
```

## Self-Review

Spec coverage check:

1. Claude render parity for `enabled: false` -> Task 2, Step 2
2. Claude rendered-name drift parity -> Task 2, Step 1 and Task 3, Step 1
3. Claude reverse parse parity -> Task 1, Step 1 and Task 2, Step 3
4. `disabledFor` unchanged -> Task 1, Steps 3-4
5. non-Claude unchanged -> Task 3, Steps 2-3

Placeholder scan:

1. no `TODO` or `TBD`
2. exact file paths included
3. exact commands included
4. concrete code shown for each code-edit step

Type consistency check:

1. `MCPServer.enabled` used consistently
2. method names match existing adapter API: `getRenderedServerNames`, `renderMCPServers`, `parseMCPServers`
3. Claude target string stays `claude-code`
