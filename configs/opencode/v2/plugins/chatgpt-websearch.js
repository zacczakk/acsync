// Vendored bundle of opencode-chatgpt-websearch@0.1.1 (MIT, (c) 2026 OpenCode ChatGPT
// Web Search contributors: https://github.com/neriousy/opencode-chatgpt-websearch).
// Upstream ships only as an npm package meant for `plugins: ["./chatgpt-websearch"]`-style
// directory resolution; OpenCode2's local-plugin auto-discovery only loads flat files under
// plugins/, so this bundles upstream's dist output into one file placed there directly.
// Upstream is unmaintained (single 2026-08-08 release) -- re-bundle from a newer release
// if one ships, otherwise keep this in sync by hand.

class ChatGPTWebSearchError extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "ChatGPTWebSearchError";
    this.code = code;
  }
}

var responseLengths = ["short", "medium", "long"];
var reasoningEfforts = ["low", "medium", "high", "xhigh", "max"];
var defaultConfig = {
  model: "gpt-5.6-luna",
  reasoningEffort: "max",
  responseLength: "short",
  maxOutputTokens: 4096,
  timeoutMs: 25000
};
function parseConfig(options) {
  const model = options.model ?? defaultConfig.model;
  const reasoningEffort = options.reasoningEffort ?? defaultConfig.reasoningEffort;
  const responseLength = options.responseLength ?? defaultConfig.responseLength;
  const maxOutputTokens = options.maxOutputTokens ?? defaultConfig.maxOutputTokens;
  const timeoutMs = options.timeoutMs ?? defaultConfig.timeoutMs;
  if (typeof model !== "string" || model.length === 0 || model.length > 100) {
    throw invalidOption("model", "a non-empty string of at most 100 characters");
  }
  if (typeof reasoningEffort !== "string" || !reasoningEfforts.includes(reasoningEffort)) {
    throw invalidOption("reasoningEffort", 'one of "low", "medium", "high", "xhigh", or "max"');
  }
  if (typeof responseLength !== "string" || !responseLengths.includes(responseLength)) {
    throw invalidOption("responseLength", 'one of "short", "medium", or "long"');
  }
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 1e5) {
    throw invalidOption("maxOutputTokens", "an integer from 256 through 100000");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) {
    throw invalidOption("timeoutMs", "an integer from 100 through 120000");
  }
  return {
    model,
    reasoningEffort,
    responseLength,
    maxOutputTokens,
    timeoutMs
  };
}
function invalidOption(name, expected) {
  return new ChatGPTWebSearchError("request_failed", `Invalid plugin option ${name}; expected ${expected}.`);
}

var endpoint = "https://chatgpt.com/backend-api/codex/alpha/search";
var maximumResponseBytes = 256 * 1024;
var maximumQueryBytes = 8 * 1024;
async function searchChatGPT(input, dependencies) {
  const query = validateQuery(input.query);
  const requestSignal = timedSignal(input.signal, input.config.timeoutMs);
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${input.auth.accessToken}`,
    "Content-Type": "application/json",
    originator: "opencode"
  };
  if (input.auth.accountID)
    headers["ChatGPT-Account-ID"] = input.auth.accountID;
  try {
    const response = await dependencies.fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: dependencies.randomUUID(),
        model: input.config.model,
        reasoning: {
          effort: input.config.reasoningEffort
        },
        input: query,
        commands: {
          search_query: [{ q: query }],
          response_length: input.config.responseLength
        },
        settings: {
          allowed_callers: ["direct"],
          external_web_access: true
        },
        max_output_tokens: input.config.maxOutputTokens
      }),
      signal: requestSignal.signal,
      redirect: "error",
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer"
    });
    if (response.url && new URL(response.url).origin !== new URL(endpoint).origin) {
      await response.body?.cancel().catch(() => {
        return;
      });
      throw new ChatGPTWebSearchError("request_failed", "ChatGPT web search returned from an unexpected origin.");
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {
        return;
      });
      if (response.status === 401 || response.status === 403) {
        throw new ChatGPTWebSearchError("authentication_failed", `ChatGPT web search authentication failed (HTTP ${response.status}). Reconnect ChatGPT in OpenCode.`);
      }
      throw new ChatGPTWebSearchError("request_failed", `ChatGPT web search failed (HTTP ${response.status}).`);
    }
    return parseResponse(await readBounded(response));
  } catch (error) {
    if (error instanceof ChatGPTWebSearchError)
      throw error;
    if (input.signal.aborted) {
      throw new ChatGPTWebSearchError("request_aborted", "ChatGPT web search was aborted.");
    }
    if (requestSignal.timedOut()) {
      throw new ChatGPTWebSearchError("request_timeout", "ChatGPT web search timed out.");
    }
    throw new ChatGPTWebSearchError("request_failed", "ChatGPT web search request failed.");
  } finally {
    requestSignal.dispose();
  }
}
function parseResponse(body) {
  let value;
  try {
    value = JSON.parse(body);
  } catch {
    throw new ChatGPTWebSearchError("invalid_response", "ChatGPT web search returned invalid JSON.");
  }
  if (!isRecord(value) || typeof value.output !== "string") {
    throw new ChatGPTWebSearchError("invalid_response", "ChatGPT web search returned an invalid response.");
  }
  if (value.results === undefined || value.results === null) {
    throw new ChatGPTWebSearchError("invalid_response", "ChatGPT web search did not return structured citations; the alpha protocol may have changed.");
  }
  if (!Array.isArray(value.results)) {
    throw new ChatGPTWebSearchError("invalid_response", "ChatGPT web search returned invalid results.");
  }
  return value.results.flatMap((result) => {
    if (!isRecord(result) || result.type !== "text_result" || typeof result.url !== "string")
      return [];
    if (!isSafeURL(result.url))
      return [];
    const title = text(result.title);
    const content = text(result.snippet);
    return [
      {
        url: result.url,
        ...title ? { title } : {},
        ...content ? { content } : {},
        time: {}
      }
    ];
  });
}
function validateQuery(query) {
  const value = query.trim();
  if (!value) {
    throw new ChatGPTWebSearchError("invalid_query", "ChatGPT web search requires a non-empty query.");
  }
  if (new TextEncoder().encode(value).byteLength > maximumQueryBytes) {
    throw new ChatGPTWebSearchError("invalid_query", `ChatGPT web search query exceeded ${maximumQueryBytes} UTF-8 bytes.`);
  }
  return value;
}
async function readBounded(response) {
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maximumResponseBytes) {
    await response.body?.cancel().catch(() => {
      return;
    });
    throw tooLarge();
  }
  if (!response.body)
    return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done)
        break;
      size += item.value.byteLength;
      if (size > maximumResponseBytes) {
        await reader.cancel().catch(() => {
          return;
        });
        throw tooLarge();
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}
function timedSignal(parent, timeoutMs) {
  const controller = new AbortController;
  let timedOut = false;
  const abort = () => controller.abort(parent.reason);
  if (parent.aborted)
    abort();
  else
    parent.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      parent.removeEventListener("abort", abort);
    }
  };
}
function tooLarge() {
  return new ChatGPTWebSearchError("response_too_large", `ChatGPT web search response exceeded ${maximumResponseBytes} bytes.`);
}
function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function isSafeURL(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

var pluginID = "opencode.chatgpt-websearch";
var providerID = "chatgpt";
var providerName = "ChatGPT (experimental)";
var chatGPTMethods = new Set(["chatgpt-browser", "chatgpt-headless"]);
function createPlugin(overrides = {}) {
  const dependencies = {
    fetch: overrides.fetch ?? ((input, init) => globalThis.fetch(input, init)),
    randomUUID: overrides.randomUUID ?? (() => globalThis.crypto.randomUUID())
  };
  return {
    id: pluginID,
    setup: async (context) => {
      const config = parseConfig(context.options);
      const registration = await context.websearch.transform((draft) => {
        draft.add({
          id: providerID,
          name: providerName,
          execute: async (input, execution) => {
            const query = validateQuery(input.query);
            return searchChatGPT({
              query,
              auth: await resolveAuth(context),
              config,
              signal: execution.signal
            }, dependencies);
          }
        });
      });
      return () => registration.dispose();
    }
  };
}
async function resolveAuth(context) {
  const connection = await context.integration.connection.active("openai");
  if (!connection)
    throw authRequired();
  let credential;
  try {
    credential = await context.integration.connection.resolve(connection);
  } catch {
    throw new ChatGPTWebSearchError("authentication_failed", "OpenCode could not refresh the ChatGPT credential. Reconnect ChatGPT and try again.");
  }
  if (!isRecord2(credential) || credential.type !== "oauth")
    throw authRequired();
  if (typeof credential.methodID !== "string" || !chatGPTMethods.has(credential.methodID))
    throw authRequired();
  if (typeof credential.access !== "string" || credential.access.length === 0)
    throw authRequired();
  const accountID = isRecord2(credential.metadata) && typeof credential.metadata.accountID === "string" ? credential.metadata.accountID : undefined;
  return {
    accessToken: credential.access,
    ...accountID ? { accountID } : {}
  };
}
function authRequired() {
  return new ChatGPTWebSearchError("authentication_required", "ChatGPT OAuth is required. Connect OpenAI with the ChatGPT browser or headless login in OpenCode.");
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var server_default = createPlugin();
export {
  providerName,
  providerID,
  pluginID,
  server_default as default,
  createPlugin
};
