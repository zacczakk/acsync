import { describe, expect, test } from 'bun:test';
import type { MCPServer } from '../../types';
import {
  renderOpenCodeAgent,
  renderOpenCodeMcp,
  renderOpenCodeSettings,
} from '../version-renderer';

describe('renderOpenCodeSettings', () => {
  test('preserves V1 syntax in an independent deep clone', () => {
    const settings = { permission: { bash: { '*': 'allow' } }, plugin: ['context-mode'] };

    const rendered = renderOpenCodeSettings(settings, 'v1');
    settings.permission.bash['*'] = 'deny';

    expect(rendered).toEqual({ permission: { bash: { '*': 'allow' } }, plugin: ['context-mode'] });
  });

  test('keeps ChatGPT websearch in V2 and omits the V2-only integration from V1', () => {
    const settings = {
      plugin: ['context-mode', './chatgpt-websearch'],
      websearch: { provider: 'chatgpt' },
    };

    expect(renderOpenCodeSettings(settings, 'v2')).toMatchObject({
      plugins: ['context-mode', './chatgpt-websearch'],
      websearch: { provider: 'chatgpt' },
    });
    expect(renderOpenCodeSettings(settings, 'v1')).toEqual({ plugin: ['context-mode'] });
  });

  test('migrates settings, providers, models, permissions, and explore agent variants to V2', () => {
    const rendered = renderOpenCodeSettings({
      permission: { bash: { '*': 'allow' }, task: 'ask', write: 'deny', patch: 'allow' },
      agent: { explore: { model: 'acme/model', options: { reasoningEffort: 'low', textVerbosity: 'brief' } } },
      plugin: ['context-mode'],
      provider: {
        acme: {
          npm: '@ai-sdk/anthropic',
          options: { apiKey: '{env:KEY}', headers: { 'x-client': 'metronome' } },
          models: {
            model: {
              options: { temperature: 0.2 },
              modalities: { input: ['text'], output: ['text'] },
              tool_call: true,
              reasoning: true,
              cost: { input: 1, output: 2, cache_read: 0.1, cache_write: 0.2 },
              variants: { fast: { temperature: 0 } },
            },
          },
        },
      },
    }, 'v2');

    expect(rendered.permissions).toEqual([
      { action: 'shell', resource: '*', effect: 'allow' },
      { action: 'subagent', resource: '*', effect: 'ask' },
      { action: 'edit', resource: '*', effect: 'deny' },
      { action: 'edit', resource: '*', effect: 'allow' },
    ]);
    expect(rendered.agents).toEqual({ explore: { model: 'acme/model#agent-explore' } });
    expect(rendered.plugins).toEqual(['context-mode']);
    expect(rendered.providers).toEqual({
      acme: {
        package: 'aisdk:@ai-sdk/anthropic',
        settings: { apiKey: '{env:KEY}' },
        headers: { 'x-client': 'metronome' },
        models: {
          model: {
            settings: { temperature: 0.2 },
            capabilities: { tools: true, input: ['text'], output: ['text'] },
            cost: { input: 1, output: 2, cache: { read: 0.1, write: 0.2 } },
            variants: [
              { id: 'fast', settings: { temperature: 0 } },
              { id: 'agent-explore', settings: { reasoningEffort: 'low', textVerbosity: 'brief' } },
            ],
            limit: { output: 64000 },
          },
        },
      },
    });
    expect(rendered).not.toHaveProperty('permission');
    expect(rendered).not.toHaveProperty('agent');
  });

  test('preserves Anthropic context limits and does not invent tool capabilities', () => {
    const rendered = renderOpenCodeSettings({
      provider: { anthropic: { npm: '@ai-sdk/anthropic', models: { claude: { limit: { context: 200000 } } } } },
    }, 'v2');

    expect(rendered.providers).toEqual({
      anthropic: {
        package: 'aisdk:@ai-sdk/anthropic',
        models: { claude: { limit: { context: 200000, output: 64000 } } },
      },
    });
  });

  test('applies Anthropic output limits when models precede the package declaration', () => {
    const rendered = renderOpenCodeSettings({
      provider: { anthropic: { models: { claude: { limit: { context: 200000 } } }, npm: '@ai-sdk/anthropic' } },
    }, 'v2');

    expect(rendered.providers).toEqual({
      anthropic: {
        package: 'aisdk:@ai-sdk/anthropic',
        models: { claude: { limit: { context: 200000, output: 64000 } } },
      },
    });
  });
});

describe('renderOpenCodeAgent', () => {
  test('creates a named V2 model variant descriptor and removes inert overlays', () => {
    const rendered = renderOpenCodeAgent({
      _agentName: 'Research Review!',
      model: 'github-copilot/gpt-5',
      options: { temperature: 0.1 },
      reasoningEffort: 'high',
      textVerbosity: 'low',
      permission: { bash: 'allow', write: 'deny' },
    }, 'v2');

    expect(rendered).toEqual({
      model: 'github-copilot/gpt-5#agent-research-review',
      permissions: [
        { action: 'shell', resource: '*', effect: 'allow' },
        { action: 'edit', resource: '*', effect: 'deny' },
      ],
      _modelVariant: {
        providerID: 'github-copilot',
        modelID: 'gpt-5',
        id: 'agent-research-review',
        settings: { temperature: 0.1, reasoningEffort: 'high', textVerbosity: 'low' },
      },
    });
  });

  test('preserves V1 agent metadata in an independent clone', () => {
    const metadata = { permission: { bash: 'allow' } };
    const rendered = renderOpenCodeAgent(metadata, 'v1');
    metadata.permission.bash = 'deny';

    expect(rendered).toEqual({ permission: { bash: 'allow' } });
  });
});

describe('renderOpenCodeMcp', () => {
  const servers: MCPServer[] = [{ name: 'local', transport: 'stdio', command: 'node', args: ['server.js'], env: { TOKEN: '${TOKEN}' }, enabled: false, targetOptions: { opencode: { timeout: 30 } } }];

  test('renders V1 as an enabled flat map', () => {
    expect(renderOpenCodeMcp(servers, 'v1')).toEqual({
      local: { type: 'local', command: ['node', 'server.js'], environment: { TOKEN: '{env:TOKEN}' }, enabled: false, timeout: 30 },
    });
  });

  test('renders V2 servers with disabled inverse and split timeout', () => {
    expect(renderOpenCodeMcp(servers, 'v2')).toEqual({
      servers: { local: { type: 'local', command: ['node', 'server.js'], environment: { TOKEN: '{env:TOKEN}' }, disabled: true, timeout: { catalog: 30, execution: 30 } } },
    });
  });
});
