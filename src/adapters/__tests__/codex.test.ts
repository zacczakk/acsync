import { describe, it, expect } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { CodexAdapter } from '../codex';
import type { CanonicalSettings } from '../../types';

const HOME = os.homedir();

const adapter = new CodexAdapter();

const codexSettings: CanonicalSettings = {
  target: 'codex',
  keys: {
    features: {
      hooks: true,
    },
  },
};

const baseCommandItem = {
  name: 'my-plan',
  content: 'This is the command body.\nWith details.\n',
  metadata: {
    description: 'Plan a feature',
    'argument-hint': '[feature]',
    'allowed-tools': ['Read', 'Write'],
  },
};

const agentWithTools = {
  name: 'my-agent',
  content: 'Agent body content.\n',
  metadata: {
    description: 'Does agent things',
    permission: { bash: 'allow', edit: 'deny', webfetch: 'deny' },
    color: '#a277ff',
  },
};

const agentWithOpenCodeModelOptions = {
  name: 'openai-agent',
  content: 'Agent body content.\n',
  metadata: {
    description: 'Does OpenAI agent things',
    model: 'github-copilot/gpt-5.5',
    reasoningEffort: 'medium',
    textVerbosity: 'low',
  },
};

const fastOpenAIAgent = {
  name: 'fast-worker',
  content: 'Handle delegated work.\n',
  metadata: {
    description: 'Fast OpenAI worker',
    model: 'openai/gpt-5.6-luna-fast',
    reasoningEffort: 'max',
  },
};

const agentWithoutTools = {
  name: 'simple-agent',
  content: 'Simple agent body.\n',
  metadata: {
    description: 'A simple agent',
  },
};

describe('CodexAdapter.renderCommand', () => {
  it('produces correct command file path (.md in prompts/)', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.relativePath).toBe(path.join(HOME, '.codex/prompts/my-plan.md'));
  });

  it('uses # /{name} heading', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('# /my-plan');
  });

  it('includes description as paragraph', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('Plan a feature');
  });

  it('includes body verbatim', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).toContain('This is the command body.');
    expect(result.content).toContain('With details.');
  });

  it('has no frontmatter (no --- delimiters)', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).not.toContain('---');
  });

  it('has no allowed-tools in output', () => {
    const result = adapter.renderCommand(baseCommandItem);
    expect(result.content).not.toContain('allowed-tools');
  });

  it('orders: heading → description → body', () => {
    const result = adapter.renderCommand(baseCommandItem);
    const headingIdx = result.content.indexOf('# /my-plan');
    const descIdx = result.content.indexOf('Plan a feature');
    const bodyIdx = result.content.indexOf('This is the command body.');
    expect(headingIdx).toBeLessThan(descIdx);
    expect(descIdx).toBeLessThan(bodyIdx);
  });
});

describe('CodexAdapter.renderAgent', () => {
  it('produces correct agent file path (.toml in agents/)', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.relativePath).toBe(path.join(HOME, '.codex/agents/my-agent.toml'));
  });

  it('writes the agent name into TOML', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).toContain('name = "my-agent"');
  });

  it('includes description in TOML', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).toContain('description = "Does agent things"');
  });

  it('derives read-only sandbox when edit is denied', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).toContain('sandbox_mode = "read-only"');
  });

  it('omits sandbox_mode when no restrictive sandbox can be derived', () => {
    const result = adapter.renderAgent(agentWithoutTools);
    expect(result.content).not.toContain('sandbox_mode =');
  });

  it('includes developer_instructions body', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).toContain('developer_instructions = "');
    expect(result.content).toContain('Agent body content.');
  });

  it('renders TOML, not markdown frontmatter', () => {
    const result = adapter.renderAgent(agentWithTools);
    expect(result.content).not.toContain('# Agent:');
  });

  it('maps OpenCode-style GPT options to Codex TOML keys', () => {
    const result = adapter.renderAgent(agentWithOpenCodeModelOptions);
    expect(result.content).toContain('model_reasoning_effort = "medium"');
    expect(result.content).toContain('model_verbosity = "low"');
  });

  it('maps OpenAI fast aliases to Codex provider and service tier settings', () => {
    const result = adapter.renderAgent(fastOpenAIAgent);
    expect(result.content).toContain('model = "gpt-5.6-luna"');
    expect(result.content).toContain('model_provider = "openai"');
    expect(result.content).toContain('service_tier = "fast"');
    expect(result.content).toContain('model_reasoning_effort = "max"');
  });
});

describe('CodexAdapter capabilities', () => {
  it('declares skills capability', () => {
    const caps = adapter.getCapabilities();
    expect(caps.skills).toBe(true);
  });

  it('reports core capabilities as true', () => {
    const caps = adapter.getCapabilities();
    expect(caps.commands).toBe(true);
    expect(caps.agents).toBe(true);
    expect(caps.mcp).toBe(true);
    expect(caps.instructions).toBe(true);
    expect(caps.settings).toBe(true);
  });

  it('has correct target and displayName', () => {
    expect(adapter.target).toBe('codex');
    expect(adapter.displayName).toBe('Codex');
  });

  it('resolves skills dir to ~/.agents/skills/', () => {
    expect(adapter.getPaths().getSkillsDir()).toBe(path.join(HOME, '.agents/skills/'));
  });
});

describe('CodexAdapter settings', () => {
  it('merges canonical settings into existing TOML', () => {
    const existing = [
      'model = "gpt-5.4"',
      '',
      '[features]',
      'multi_agent = true',
      'codex_hooks = true',
      '',
    ].join('\n');

    const result = adapter.renderSettings(codexSettings, existing);

    expect(result).toContain('model = "gpt-5.4"');
    expect(result).toContain('[features]');
    expect(result).toContain('multi_agent = true');
    expect(result).toContain('hooks = true');
    expect(result).not.toContain('codex_hooks');
  });

  it('extracts only canonical TOML keys for drift comparison', () => {
    const target = [
      'model = "gpt-5.4"',
      '',
      '[features]',
      'codex_hooks = true',
      'multi_agent = true',
      '',
    ].join('\n');

    const result = adapter.extractSettingsKeys(['features'], target);

    expect(result).toBe('{\n  "features": {\n    "hooks": true,\n    "multi_agent": true\n  }\n}\n');
  });

  it('renders named profile files separately from base settings', () => {
    const settings = {
      target: 'codex' as const,
      keys: {
        model: 'gpt-5.6-terra',
        profile_files: {
          tux: { model: 'gpt-5.6-luna', model_provider: 'tux' },
        },
      },
    };

    expect(adapter.renderSettings(settings)).not.toContain('profile_files');
    expect(adapter.renderAdditionalSettings(settings)).toEqual([{
      relativePath: path.join(HOME, '.codex/tux.config.toml'),
      content: 'model = "gpt-5.6-luna"\nmodel_provider = "tux"\n\n',
    }]);
  });

  it('removes incompatible legacy auth keys when command auth is canonical', () => {
    const existing = '[model_providers.api]\nenv_key = "OPENAI_API_KEY"\n';
    const settings = {
      target: 'codex' as const,
      keys: { model_providers: { api: { auth: { command: 'token-helper' } } } },
    };

    const result = adapter.renderSettings(settings, existing);
    expect(result).toContain('command = "token-helper"');
    expect(result).not.toContain('env_key');
  });
});

describe('CodexAdapter hooks', () => {
  const canonical = {
    content: JSON.stringify({
      hooks: {
        SessionStart: [{
          _managed: 'metronome',
          matcher: 'startup|resume',
          hooks: [{ type: 'command', command: 'node vault-context-loader-codex.js' }],
        }],
      },
    }),
  };

  it('preserves third-party hook groups while replacing managed groups', () => {
    const existing = JSON.stringify({
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'muxy stop' }] }],
        SessionStart: [{
          _managed: 'metronome',
          hooks: [{ type: 'command', command: 'node old-loader.js' }],
        }],
      },
    });

    const result = JSON.parse(adapter.renderHooks(canonical, existing));

    expect(result.hooks.Stop[0].hooks[0].command).toBe('muxy stop');
    expect(result.hooks.SessionStart).toHaveLength(1);
    expect(result.hooks.SessionStart[0].hooks[0].command).toBe('node vault-context-loader-codex.js');
  });

  it('migrates the legacy unmarked Metronome hook without duplication', () => {
    const existing = JSON.stringify({
      hooks: {
        SessionStart: [{
          matcher: 'startup|resume',
          hooks: [{
            type: 'command',
            command: 'node "$HOME/Repos/zacczakk/metronome/configs/hooks/vault-context-loader-codex.js"',
          }],
        }],
      },
    });

    const result = JSON.parse(adapter.renderHooks(canonical, existing));

    expect(result.hooks.SessionStart).toHaveLength(1);
    expect(result.hooks.SessionStart[0]._managed).toBe('metronome');
  });

  it('extracts only metronome-managed groups for drift comparison', () => {
    const target = JSON.stringify({
      thirdPartyMetadata: { enabled: true },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'muxy stop' }] }],
        SessionStart: [{
          _managed: 'metronome',
          hooks: [{ type: 'command', command: 'node vault-context-loader-codex.js' }],
        }],
      },
    });

    expect(JSON.parse(adapter.extractHooks(target))).toEqual({
      hooks: {
        SessionStart: [{
          _managed: 'metronome',
          hooks: [{ type: 'command', command: 'node vault-context-loader-codex.js' }],
        }],
      },
    });
  });
});
