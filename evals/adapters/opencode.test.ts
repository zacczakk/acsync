import { describe, expect, it, mock } from "bun:test";

function createSpawn(output: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${output}\n`));
      controller.close();
    },
  });

  return {
    stdout: stream,
    kill: mock(),
  } as unknown as ReturnType<typeof Bun.spawn>;
}

describe("createOpenCodeAdapter", () => {
  it("detects skill trigger via skill tool use", async () => {
    const { createOpenCodeAdapter } = await import("./opencode");
    const spawn = createSpawn(
      [
        JSON.stringify({ type: "tool_use", part: { tool: "skill", state: { input: { name: "session-notes" } } } }),
      ].join("\n"),
    );

    const adapter = createOpenCodeAdapter(undefined, { timeoutMs: 50, spawnFn: mock(() => spawn) as typeof Bun.spawn });
    const triggered = await adapter.runQuery("write a session note", "session-notes");
    expect(triggered).toBe(true);
  });

  it("detects agent auto-routing via task tool subagent_type", async () => {
    const { createOpenCodeAdapter } = await import("./opencode");
    const spawn = createSpawn(
      [
        JSON.stringify({ type: "text", part: { type: "text", text: "Launching research agent" } }),
        JSON.stringify({ type: "tool_use", part: { tool: "task", state: { input: { subagent_type: "research" } } } }),
      ].join("\n"),
    );

    const adapter = createOpenCodeAdapter(undefined, { timeoutMs: 50, spawnFn: mock(() => spawn) as typeof Bun.spawn });
    const triggered = await adapter.runQuery("research prior decisions", "research");
    expect(triggered).toBe(true);
  });

  it("falls back to explicit delegation text for agent routing", async () => {
    const { createOpenCodeAdapter } = await import("./opencode");
    const spawn = createSpawn(
      [
        JSON.stringify({ type: "text", part: { type: "text", text: "Launching a research agent to scan the repo." } }),
      ].join("\n"),
    );

    const adapter = createOpenCodeAdapter(undefined, { timeoutMs: 50, spawnFn: mock(() => spawn) as typeof Bun.spawn });
    const triggered = await adapter.runQuery("research prior decisions", "research");
    expect(triggered).toBe(true);
  });

  it("returns false when first step ends without matching target", async () => {
    const { createOpenCodeAdapter } = await import("./opencode");
    const spawn = createSpawn(
      [
        JSON.stringify({ type: "step_finish", part: { reason: "stop" } }),
      ].join("\n"),
    );

    const adapter = createOpenCodeAdapter(undefined, { timeoutMs: 50, spawnFn: mock(() => spawn) as typeof Bun.spawn });
    const triggered = await adapter.runQuery("fix a test", "research");
    expect(triggered).toBe(false);
  });
});
