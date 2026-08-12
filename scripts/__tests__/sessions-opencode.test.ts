import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

describe("sessions OpenCode V2 adapter", () => {
  test("lists, reads, indexes, and exports V2 session records", () => {
    const root = mkdtempSync(join(tmpdir(), "sessions-opencode-"));
    roots.push(root);
    const home = join(root, "home");
    const database = join(home, ".local", "share", "opencode-v2", "opencode", "opencode.db");
    const script = `
import json
import sqlite3
import sys
from pathlib import Path
sys.path.insert(0, ${JSON.stringify(join(import.meta.dir, ".."))})
from sessions_opencode import list_sessions, read_session, session_to_markdown, stats, text_blocks_since

db = Path(${JSON.stringify(database)})
db.parent.mkdir(parents=True, exist_ok=True)
conn = sqlite3.connect(db)
conn.executescript("""
CREATE TABLE session_v2 (
  id TEXT PRIMARY KEY,
  title TEXT,
  directory TEXT NOT NULL,
  time_created INTEGER NOT NULL,
  time_updated INTEGER NOT NULL,
  parent_id TEXT,
  model TEXT
);
CREATE TABLE session_message (
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  seq INTEGER NOT NULL,
  time_created INTEGER NOT NULL,
  data TEXT NOT NULL
);
""")
conn.executemany(
    "INSERT INTO session_v2 VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
        ("ses-main", "V2 fixture", "/work/metronome", 1000, 4000, None, '{"id":"model","providerID":"provider"}'),
        ("ses-child", "Child", "/work/metronome", 2000, 3000, "ses-main", None),
    ],
)
conn.executemany(
    "INSERT INTO session_message VALUES (?, ?, ?, ?, ?)",
    [
        ("ses-main", "user", 1, 1100, '{"text":"Build the fixture","files":[],"agents":[]}'),
        ("ses-main", "assistant", 2, 1200, '{"content":[{"type":"reasoning","text":"hidden reasoning"},{"type":"text","text":"Implemented."},{"type":"tool","name":"shell","state":{"input":{"command":"pwd"}}}]}'),
        ("ses-z", "user", 1, 1200, '{"text":"Same timestamp","files":[],"agents":[]}'),
        ("ses-main", "system", 3, 1300, '{"text":"injected system context"}'),
    ],
)
conn.commit()
conn.close()

print(json.dumps({
    "sessions": list_sessions(db),
    "messages": read_session(db, "ses-main"),
    "user_messages": read_session(db, "ses-main", role_filter="user"),
    "blocks": text_blocks_since(db),
    "markdown": session_to_markdown(db, "ses-main"),
    "stats": stats(db),
}))
`;
    const result = Bun.spawnSync(["python3", "-c", script]);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.toString());

    expect(parsed.sessions[0]).toMatchObject({
      id: "ses-child",
      parent_id: "ses-main",
      title: "Child",
    });
    expect(parsed.messages.map((message: { type: string; text?: string; tool?: string }) => message.text ?? message.tool)).toEqual([
      "Build the fixture",
      "Implemented.",
      "shell",
    ]);
    expect(parsed.user_messages).toHaveLength(1);
    expect(parsed.blocks).toEqual([
      ["ses-main", "user", "Build the fixture", 1100],
      ["ses-main", "assistant", "Implemented.", 1200],
      ["ses-z", "user", "Same timestamp", 1200],
    ]);
    expect(parsed.markdown).toContain("source: opencode2");
    expect(parsed.markdown).toContain("Implemented.");
    expect(parsed.markdown).not.toContain("hidden reasoning");
    expect(parsed.markdown).not.toContain("pwd");
    expect(parsed.stats).toEqual({
      sessions_total: 2,
      sessions_top_level: 1,
      sessions_subagent: 1,
      messages: 4,
      text_parts: 3,
    });

    const cli = join(import.meta.dir, "..", "sessions");
    const env = { ...process.env, HOME: home };
    const listResult = Bun.spawnSync(["python3", cli, "list", "--json"], { env });
    expect(listResult.exitCode).toBe(0);
    expect(JSON.parse(listResult.stdout.toString())[0]).toMatchObject({ source: "opencode2" });

    const exportResult = Bun.spawnSync(["python3", cli, "export", "--no-index"], { env });
    expect(exportResult.exitCode).toBe(0);
    expect(exportResult.stdout.toString()).toContain("exported 1 opencode2 sessions");

    const searchResult = Bun.spawnSync(["python3", cli, "search", "fixture", "--source", "opencode2", "--json"], { env });
    expect(searchResult.exitCode).toBe(0);
    expect(JSON.parse(searchResult.stdout.toString())[0]).toMatchObject({ source: "opencode2", title: "V2 fixture" });

    const mutate = `
import sqlite3
db = ${JSON.stringify(database)}
conn = sqlite3.connect(db)
conn.execute("UPDATE session_v2 SET time_updated = 5000 WHERE id = 'ses-main'")
conn.execute("INSERT INTO session_message VALUES (?, ?, ?, ?, ?)", ("ses-main", "assistant", 4, 1400, '{"content":[{"type":"text","text":"Follow-up"}]}'))
conn.commit()
conn.close()
`;
    const mutateResult = Bun.spawnSync(["python3", "-c", mutate]);
    expect(mutateResult.exitCode).toBe(0);

    const updateExportResult = Bun.spawnSync(["python3", cli, "export", "--no-index"], { env });
    expect(updateExportResult.exitCode).toBe(0);
    expect(updateExportResult.stdout.toString()).toContain("exported 1 opencode2 sessions");
    expect(existsSync(join(home, "Vaults", "Sessions", "opencode2", "1970-01-01-v2-fixture.md"))).toBe(true);
    expect(readFileSync(join(home, "Vaults", "Sessions", "opencode2", "1970-01-01-v2-fixture.md"), "utf8")).toContain("Follow-up");
  });
});
