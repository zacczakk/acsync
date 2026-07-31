import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

describe("sessions Codex adapter", () => {
  test("lists and reads user-visible Codex messages without injected context", () => {
    const root = mkdtempSync(join(tmpdir(), "sessions-codex-"));
    roots.push(root);
    const session = join(root, "rollout.jsonl");
    const rows = [
      { type: "session_meta", timestamp: "2026-07-31T10:00:00Z", payload: { id: "codex-123", timestamp: "2026-07-31T10:00:00Z", cwd: "/work/metronome", model_provider: "openai" } },
      { type: "response_item", timestamp: "2026-07-31T10:00:01Z", payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "secret injected instructions" }] } },
      { type: "event_msg", timestamp: "2026-07-31T10:00:02Z", payload: { type: "user_message", message: "Add Codex support" } },
      { type: "response_item", timestamp: "2026-07-31T10:00:03Z", payload: { type: "function_call", name: "shell", arguments: '{"command":"pwd"}' } },
      { type: "event_msg", timestamp: "2026-07-31T10:00:04Z", payload: { type: "agent_message", message: "Implemented." } },
    ];
    writeFileSync(session, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);

    const script = `
import json, sys
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(join(import.meta.dir, ".."))})
from sessions_codex import list_sessions, read_session, session_to_markdown
p = Path(${JSON.stringify(session)})
print(json.dumps({"sessions": list_sessions(p.parent), "messages": read_session(p), "markdown": session_to_markdown(p)}))
`;
    const result = Bun.spawnSync(["python3", "-c", script]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.toString());

    expect(parsed.sessions[0]).toMatchObject({ id: "codex-123", title: "Add Codex support", directory: "/work/metronome" });
    expect(parsed.messages.map((message: { type: string; text?: string; tool?: string }) => message.text ?? message.tool)).toEqual([
      "Add Codex support",
      "shell",
      "Implemented.",
    ]);
    expect(parsed.markdown).toContain("source: codex");
    expect(parsed.markdown).not.toContain("secret injected instructions");
  });
});
