import type { Adapter } from "../types";

export function createClaudeAdapter(model?: string): Adapter {
  return {
    name: "claude",
    async runQuery(query: string, skillName: string): Promise<boolean> {
      const args = ["-p", query, "--output-format", "stream-json", "--verbose"];
      if (model) args.push("--model", model);

      const env = Object.fromEntries(
        Object.entries(Bun.env).filter(([k]) => k !== "CLAUDECODE"),
      );

      const proc = Bun.spawn(["claude", ...args], {
        stdout: "pipe",
        stderr: "ignore",
        env,
      });

      const text = await new Response(proc.stdout).text();
      await proc.exited;

      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "assistant") {
            const content = event.message?.content ?? [];
            for (const item of content) {
              if (item.type !== "tool_use") continue;
              if (item.name === "Skill" && item.input?.skill?.includes(skillName)) return true;
              if (item.name === "Read" && item.input?.file_path?.includes(skillName)) return true;
            }
          }
          if (event.type === "stream_event") {
            const se = event.event ?? {};
            if (se.type === "content_block_start") {
              const cb = se.content_block ?? {};
              if (cb.type === "tool_use" && cb.name === "Skill") {
                return true;
              }
            }
          }
        } catch {
          continue;
        }
      }
      return false;
    },
  };
}
