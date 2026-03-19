import type { Adapter } from "../types";

const TIMEOUT_MS = 60_000;

export function createOpenCodeAdapter(model?: string): Adapter {
  return {
    name: "opencode",
    async runQuery(query: string, skillName: string): Promise<boolean> {
      const args = ["run", "--format", "json", "--dir", "/tmp"];
      if (model) args.push("--model", model);
      args.push(query);

      const proc = Bun.spawn(["opencode", ...args], {
        stdout: "pipe",
        stderr: "ignore",
      });

      let triggered = false;
      let resolved = false;

      const result = await Promise.race([
        streamParse(proc, skillName),
        timeout(TIMEOUT_MS),
      ]);

      triggered = result ?? false;

      // Kill immediately — we only care about triggering, not the full run
      try {
        proc.kill();
      } catch {}

      return triggered;
    },
  };
}

async function streamParse(
  proc: ReturnType<typeof Bun.spawn>,
  skillName: string,
): Promise<boolean> {
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let triggered = false;
  let firstStepDone = false;

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

          // Skill trigger detected
          if (
            event.type === "tool_use" &&
            event.part?.tool === "skill" &&
            event.part?.state?.input?.name === skillName
          ) {
            triggered = true;
            return true;
          }

          // First step finished without triggering the skill = not triggered
          if (event.type === "step_finish" && !firstStepDone) {
            firstStepDone = true;
            if (event.part?.reason === "stop") {
              return false;
            }
            // If reason is "tool-calls", the step used tools — check if
            // subsequent events include our skill. Keep reading one more step.
          }

          // Second step finish = definitely done checking
          if (event.type === "step_finish" && firstStepDone) {
            return triggered;
          }
        } catch {
          continue;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return triggered;
}

function timeout(ms: number): Promise<undefined> {
  return new Promise((resolve) => setTimeout(() => resolve(undefined), ms));
}
