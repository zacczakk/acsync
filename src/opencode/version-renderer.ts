import type { MCPServer, TargetName } from '../types';
import { EnvVarTransformer } from '../secrets/env-var-transformer';

export type OpenCodeVersion = 'v1' | 'v2';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function renamedPermission(name: string): string {
  if (name === 'bash') return 'shell';
  if (name === 'task') return 'subagent';
  if (name === 'write' || name === 'patch') return 'edit';
  return name;
}

function renderPermissions(permission: unknown): unknown[] {
  if (!isRecord(permission)) return [];

  const rules: unknown[] = [];
  for (const [name, value] of Object.entries(permission)) {
    const renderedName = renamedPermission(name);
    if (isRecord(value)) {
      for (const [pattern, action] of Object.entries(value)) {
        rules.push({ action: renderedName, resource: pattern, effect: clone(action) });
      }
    } else {
      rules.push({ action: renderedName, resource: '*', effect: clone(value) });
    }
  }
  return rules;
}

function withAnthropicOutputLimit(model: UnknownRecord, packageName: unknown): UnknownRecord {
  if (packageName !== 'aisdk:@ai-sdk/anthropic') return model;

  const limit = isRecord(model.limit) ? clone(model.limit) : {};
  if (typeof limit.output !== 'number' || limit.output <= 0) limit.output = 64000;
  return { ...model, limit };
}

function renderModel(model: unknown, providerPackage: unknown): unknown {
  if (!isRecord(model)) return clone(model);

  const rendered: UnknownRecord = {};
  const modelProvider = isRecord(model.provider) ? model.provider : undefined;
  let effectivePackage = providerPackage;

  for (const [key, value] of Object.entries(model)) {
    if (key === 'options') {
      rendered.settings = clone(value);
    } else if (key === 'modalities') {
      rendered.capabilities = isRecord(value) ? { tools: true, ...clone(value) } : clone(value);
    } else if (key === 'tool_call') {
      const capabilities = isRecord(rendered.capabilities) ? rendered.capabilities : {};
      rendered.capabilities = { ...capabilities, tools: clone(value) };
    } else if (key === 'variants' && isRecord(value)) {
      rendered.variants = Object.entries(value).map(([id, settings]) => ({ id, settings: clone(settings) }));
    } else if (key === 'cost' && isRecord(value)) {
      const cost: UnknownRecord = {};
      const cache: UnknownRecord = {};
      for (const [costKey, costValue] of Object.entries(value)) {
        if (costKey === 'cache_read') cache.read = clone(costValue);
        else if (costKey === 'cache_write') cache.write = clone(costValue);
        else cost[costKey] = clone(costValue);
      }
      if (Object.keys(cache).length > 0) cost.cache = cache;
      rendered.cost = cost;
    } else if (key === 'provider' && modelProvider) {
      for (const [providerKey, providerValue] of Object.entries(modelProvider)) {
        if (providerKey === 'npm') {
          const packageValue = typeof providerValue === 'string' && providerValue.startsWith('aisdk:')
            ? providerValue
            : `aisdk:${String(providerValue)}`;
          rendered.package = packageValue;
          effectivePackage = packageValue;
        } else {
          rendered[providerKey] = clone(providerValue);
        }
      }
    } else if (key !== 'reasoning') {
      rendered[key] = clone(value);
    }
  }

  return withAnthropicOutputLimit(rendered, effectivePackage);
}

function renderProvider(provider: unknown): unknown {
  if (!isRecord(provider)) return clone(provider);
  const rendered: UnknownRecord = {};
  const npm = provider.npm;
  const packageName: unknown = typeof npm === 'string' && npm.startsWith('aisdk:')
    ? npm
    : typeof npm === 'string' ? `aisdk:${npm}` : undefined;

  for (const [key, value] of Object.entries(provider)) {
    if (key === 'npm') {
      rendered.package = packageName ?? `aisdk:${String(value)}`;
    } else if (key === 'options' && isRecord(value)) {
      const { headers, ...options } = value;
      if (Object.keys(options).length > 0) rendered.settings = clone(options);
      if (headers !== undefined) rendered.headers = clone(headers);
    } else if (key === 'models' && isRecord(value)) {
      const models: UnknownRecord = {};
      for (const [modelID, model] of Object.entries(value)) models[modelID] = renderModel(model, packageName);
      rendered.models = models;
    } else {
      rendered[key] = clone(value);
    }
  }
  return rendered;
}

function splitModel(model: unknown): { providerID: string; modelID: string } | undefined {
  if (typeof model !== 'string') return undefined;
  const slash = model.indexOf('/');
  if (slash <= 0 || slash === model.length - 1) return undefined;
  return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) };
}

function sanitizedAgentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed';
}

function agentVariantSettings(agent: UnknownRecord): UnknownRecord {
  const settings = isRecord(agent.options) ? clone(agent.options) : {};
  for (const key of ['reasoningEffort', 'textVerbosity']) {
    if (agent[key] !== undefined) settings[key] = clone(agent[key]);
  }
  return settings;
}

export function renderOpenCodeAgent(metadata: Record<string, unknown>, version: OpenCodeVersion): Record<string, unknown> {
  if (version === 'v1') return clone(metadata);

  const rendered: UnknownRecord = {};
  const variantSettings = agentVariantSettings(metadata);
  const agentName = typeof metadata._agentName === 'string' ? metadata._agentName : undefined;
  const modelReference = splitModel(metadata.model);

  for (const [key, value] of Object.entries(metadata)) {
    if (key === '_agentName' || key === 'options' || key === 'reasoningEffort' || key === 'textVerbosity' || key === 'request') continue;
    if (key === 'permission') rendered.permissions = renderPermissions(value);
    else rendered[key] = clone(value);
  }

  if (agentName && modelReference) {
    const id = `agent-${sanitizedAgentName(agentName)}`;
    rendered.model = `${metadata.model}#${id}`;
    rendered._modelVariant = { ...modelReference, id, settings: variantSettings };
  }
  return rendered;
}

export function renderOpenCodeSettings(settings: Record<string, unknown>, version: OpenCodeVersion): Record<string, unknown> {
  if (version === 'v1') {
    const rendered = clone(settings);
    if (Array.isArray(rendered.plugin)) rendered.plugin = rendered.plugin.filter((entry) => entry !== './chatgpt-websearch');
    if (isRecord(rendered.websearch) && rendered.websearch.provider === 'chatgpt') delete rendered.websearch;
    return rendered;
  }

  const rendered: UnknownRecord = {};
  const agentVariants: Array<{ providerID: string; modelID: string; id: string; settings: UnknownRecord }> = [];

  for (const [key, value] of Object.entries(settings)) {
    if (key === 'permission') rendered.permissions = renderPermissions(value);
    else if (key === 'plugin') {
      const configured = Array.isArray(value) ? clone(value) : [];
      const existing = Array.isArray(rendered.plugins) ? rendered.plugins : [];
      rendered.plugins = [...new Map([...existing, ...configured].map((entry) => [JSON.stringify(entry), entry])).values()];
    }
    else if (key === 'provider' && isRecord(value)) {
      const providers: UnknownRecord = {};
      for (const [providerID, provider] of Object.entries(value)) providers[providerID] = renderProvider(provider);
      rendered.providers = providers;
    } else if (key === 'agent' && isRecord(value)) {
      const agents: UnknownRecord = {};
      for (const [name, agent] of Object.entries(value)) {
        if (!isRecord(agent)) {
          agents[name] = clone(agent);
          continue;
        }
        const renderedAgent = renderOpenCodeAgent({ ...agent, _agentName: name }, 'v2');
        const descriptor = renderedAgent._modelVariant;
        delete renderedAgent._modelVariant;
        agents[name] = renderedAgent;
        if (isRecord(descriptor) && typeof descriptor.providerID === 'string' && typeof descriptor.modelID === 'string' && typeof descriptor.id === 'string' && isRecord(descriptor.settings)) {
          agentVariants.push({ providerID: descriptor.providerID, modelID: descriptor.modelID, id: descriptor.id, settings: descriptor.settings });
        }
      }
      rendered.agents = agents;
    } else {
      rendered[key] = clone(value);
    }
  }

  return applyOpenCodeAgentVariants(rendered, agentVariants);
}

export interface OpenCodeModelVariant {
  providerID: string;
  modelID: string;
  id: string;
  settings: Record<string, unknown>;
}

export function mergeOpenCodeSettings(
  existing: Record<string, unknown>,
  rendered: Record<string, unknown>,
  version: OpenCodeVersion,
): Record<string, unknown> {
  const next = structuredClone(existing);
  const remove = version === 'v1'
    ? ['permissions', 'agents', 'plugins', 'providers', 'websearch']
    : ['permission', 'agent', 'plugin'];
  for (const key of remove) delete next[key];
  const providerKey = version === 'v1' ? 'provider' : 'providers';
  const existingProviders = existing[providerKey];
  const renderedProviders = rendered[providerKey];
  if (isRecord(existingProviders) && isRecord(renderedProviders)) {
    rendered = { ...rendered, [providerKey]: { ...existingProviders, ...renderedProviders } };
  }
  Object.assign(next, rendered);
  return next;
}

export function configureOpenCodeV2Plugins(settings: Record<string, unknown>, existing: Record<string, unknown>): void {
  const rendered = Array.isArray(settings.plugins) ? settings.plugins : [];
  const external = Array.isArray(existing.plugins) ? existing.plugins : [];
  const configured = [...new Map([...external, ...rendered].map((entry) => [JSON.stringify(entry), entry])).values()];
  settings.plugins = configured.filter((entry) => entry !== 'context-mode'
    && entry !== './plugins/memory-vault-advisor.ts'
    && !(isRecord(entry) && entry.package === './plugins/instructions-loader.ts'));
}

export function preserveOpenCodeAgentVariants(settings: Record<string, unknown>, existing: Record<string, unknown>): void {
  const renderedProviders = isRecord(settings.providers) ? settings.providers : {};
  const existingProviders = isRecord(existing.providers) ? existing.providers : {};
  for (const [providerID, renderedProviderValue] of Object.entries(renderedProviders)) {
    if (!isRecord(renderedProviderValue)) continue;
    const existingProvider = isRecord(existingProviders[providerID]) ? existingProviders[providerID] : {};
    const renderedModels = isRecord(renderedProviderValue.models) ? renderedProviderValue.models : {};
    renderedProviderValue.models = renderedModels;
    const existingModels = isRecord(existingProvider.models) ? existingProvider.models : {};
    for (const [modelID, existingModelValue] of Object.entries(existingModels)) {
      if (!isRecord(existingModelValue)) continue;
      const renderedModelValue = isRecord(renderedModels[modelID]) ? renderedModels[modelID] : {};
      const renderedVariants = Array.isArray(renderedModelValue.variants) ? renderedModelValue.variants : [];
      const ids = new Set(renderedVariants.flatMap((entry) => isRecord(entry) && typeof entry.id === 'string' ? [entry.id] : []));
      const profileVariants = Array.isArray(existingModelValue.variants)
        ? existingModelValue.variants.filter((entry) => isRecord(entry) && typeof entry.id === 'string' && entry.id.startsWith('agent-') && !ids.has(entry.id))
        : [];
      if (profileVariants.length > 0) {
        renderedModelValue.variants = [...clone(renderedVariants), ...clone(profileVariants)];
        renderedModels[modelID] = renderedModelValue;
      }
    }
  }
}

export function applyOpenCodeAgentVariants(
  settings: Record<string, unknown>,
  variantsToAdd: OpenCodeModelVariant[],
): Record<string, unknown> {
  const rendered = clone(settings);
  const providers = isRecord(rendered.providers) ? rendered.providers : {};
  rendered.providers = providers;
  for (const variant of variantsToAdd) {
    const provider = isRecord(providers[variant.providerID]) ? providers[variant.providerID] : {};
    providers[variant.providerID] = provider;
    const models = isRecord(provider.models) ? provider.models : {};
    provider.models = models;
    const model = isRecord(models[variant.modelID]) ? models[variant.modelID] : {};
    models[variant.modelID] = model;
    const variants = Array.isArray(model.variants) ? clone(model.variants) : [];
    const withoutExisting = variants.filter((entry) => !isRecord(entry) || entry.id !== variant.id);
    model.variants = [...withoutExisting, { id: variant.id, settings: clone(variant.settings) }];
  }
  return rendered;
}

export function renderOpenCodeMcp(servers: MCPServer[], version: OpenCodeVersion, target: TargetName = 'opencode'): Record<string, unknown> {
  const renderedServers: UnknownRecord = {};
  for (const server of servers) {
    if (server.disabledFor?.includes(target)) continue;
    const config: UnknownRecord = { type: server.transport === 'stdio' ? 'local' : 'remote' };
    if (server.transport === 'stdio') config.command = [server.command, ...(server.args ?? [])];
    else config.url = server.url;
    if (server.env) config.environment = EnvVarTransformer.toOpenCode(server.env);
    if (server.headers) config.headers = EnvVarTransformer.toOpenCode(server.headers);
    const targetOptions = server.targetOptions?.[target];
    if (targetOptions) Object.assign(config, clone(targetOptions));

    if (version === 'v1') config.enabled = server.enabled !== false;
    else {
      config.disabled = server.enabled === false;
      if (typeof config.timeout === 'number') config.timeout = { catalog: config.timeout, execution: config.timeout };
    }
    renderedServers[server.name] = config;
  }
  return version === 'v1' ? renderedServers : { servers: renderedServers };
}
