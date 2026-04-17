import type { Adapter } from "../types";

const DEFAULT_TIMEOUT_MS = 60_000;

export function createOpenCodeAdapter(
  model?: string,
  options?: {
    timeoutMs?: number;
    directory?: string;
    spawnFn?: typeof Bun.spawn;
  },
): Adapter {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const directory = options?.directory ?? process.cwd();
  const spawnFn = options?.spawnFn ?? Bun.spawn;

  return {
    name: "opencode",
    async runQuery(query: string, targetName: string): Promise<boolean> {
      const args = ["run", "--format", "json", "--dir", directory];
      if (model) args.push("--model", model);
      args.push(query);

      const proc = spawnFn(["opencode", ...args], {
        stdout: "pipe",
        stderr: "ignore",
      });

      try {
        const result = await Promise.race([
          streamParse(proc, targetName),
          timeout(timeoutMs),
        ]);
        return result ?? false;
      } finally {
        try {
          proc.kill();
        } catch {}
      }
    },
  };
}

async function streamParse(
  proc: ReturnType<typeof Bun.spawn>,
  targetName: string,
): Promise<boolean> {
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstStepFinished = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (buffer.includes("\n")) {
        const idx = buffer.indexOf("\n");
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);

        if (!line) continue;

        try {
          const event = JSON.parse(line);

          if (event.type === "tool_use") {
            const part = event.part;
            if (part?.tool === "skill" && part?.state?.input?.name === targetName) {
              return true;
            }
            if (part?.tool === "task" && part?.state?.input?.subagent_type === targetName) {
              return true;
            }
          }

          if (event.type === "text") {
            const text = event.part?.text;
            if (typeof text === "string" && indicatesAgentDelegation(text, targetName)) {
              return true;
            }
          }

          if (event.type === "step_finish") {
            if (!firstStepFinished) {
              firstStepFinished = true;
              if (event.part?.reason === "stop") {
                return false;
              }
              continue;
            }
            return false;
          }
        } catch {
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return false;
}

function timeout(ms: number): Promise<undefined> {
  return new Promise((resolve) => setTimeout(() => resolve(undefined), ms));
}

function indicatesAgentDelegation(text: string, targetName: string): boolean {
  const normalized = text.toLowerCase();
  const agent = targetName.toLowerCase();
  return (
    normalized.includes(`${agent} agent`) ||
    normalized.includes(`launch a ${agent} agent`) ||
    normalized.includes(`launching a ${agent} agent`) ||
    normalized.includes(`delegate this to ${agent}`) ||
    normalized.includes(`delegating to ${agent}`) ||
    normalized.includes(`spin up ${agent}`)
  );
}
