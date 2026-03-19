import { readFileSync, writeFileSync } from "fs";
import type { Adapter, EvalResult, EvalSummary } from "./types";

const IMPROVE_PROMPT = `You are optimizing a skill description for an AI coding assistant.

Skills are instruction sets that customize agent behavior. The agent sees a list of available skills with their descriptions and decides whether to load a skill based on the description alone.

Here is the current description:
<current_description>
{DESCRIPTION}
</current_description>

Current eval results ({SCORE}):
{FAILURES}

Based on these results, write an improved description that:
- Triggers for relevant queries (listed as MISSED above)
- Does NOT trigger for irrelevant queries (listed as FALSE POSITIVE above)
- Stays under 1024 characters
- Focuses on user intent, not implementation details
- Uses imperative voice ("Use when..." not "This skill does...")
- Is distinctive enough to avoid confusion with other skills

{HISTORY}

Respond with ONLY the new description text inside <new_description> tags.`;

interface ImproveOptions {
  adapter: Adapter;
  skillName: string;
  skillPath: string;
  evalResults: EvalSummary;
  history: HistoryEntry[];
}

interface HistoryEntry {
  iteration: number;
  description: string;
  passed: number;
  total: number;
  failures: string[];
}

export async function improveDescription(
  opts: ImproveOptions,
): Promise<string> {
  const { evalResults, history } = opts;

  const missed = evalResults.results
    .filter((r) => r.should_trigger && !r.triggered)
    .map((r) => `  - "${r.query}"`);

  const falsePos = evalResults.results
    .filter((r) => !r.should_trigger && r.triggered)
    .map((r) => `  - "${r.query}"`);

  let failures = "";
  if (missed.length > 0) {
    failures += `MISSED (should trigger but didn't):\n${missed.join("\n")}\n\n`;
  }
  if (falsePos.length > 0) {
    failures += `FALSE POSITIVE (triggered but shouldn't):\n${falsePos.join("\n")}\n`;
  }
  if (!failures) {
    failures = "All queries passed — no failures to address.\n";
  }

  let historySection = "";
  if (history.length > 0) {
    historySection =
      "Previous attempts (do NOT repeat — try something structurally different):\n" +
      history
        .map(
          (h) =>
            `  Iteration ${h.iteration}: ${h.passed}/${h.total} — "${h.description.slice(0, 80)}..."`,
        )
        .join("\n");
  }

  const prompt = IMPROVE_PROMPT.replace("{DESCRIPTION}", evalResults.description)
    .replace("{SCORE}", `${evalResults.passed}/${evalResults.total}`)
    .replace("{FAILURES}", failures)
    .replace("{HISTORY}", historySection);

  // Route through the same adapter — send the prompt and capture the text response
  // The adapter's runQuery checks for skill triggering, but we need raw text output.
  // Use opencode run / claude -p directly for this step.
  const text = await runPrompt(opts.adapter.name, prompt);

  const match = text.match(/<new_description>([\s\S]*?)<\/new_description>/);
  const newDesc = match ? match[1].trim() : text.trim();

  if (newDesc.length > 1024) {
    const retryPrompt = `The description below is ${newDesc.length} characters, over the 1024-character limit. Rewrite it to be under 1024 characters while keeping the most important trigger words. Respond with ONLY the text in <new_description> tags.\n\n"${newDesc}"`;
    const retryText = await runPrompt(opts.adapter.name, retryPrompt);
    const retryMatch = retryText.match(
      /<new_description>([\s\S]*?)<\/new_description>/,
    );
    return retryMatch ? retryMatch[1].trim() : retryText.trim();
  }

  return newDesc;
}

async function runPrompt(adapterName: string, prompt: string): Promise<string> {
  if (adapterName === "opencode") {
    const proc = Bun.spawn(["opencode", "run", "--format", "json", "--dir", "/tmp", prompt], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const text = await new Response(proc.stdout).text();
    await proc.exited;

    const parts: string[] = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === "text" && event.part?.text) {
          parts.push(event.part.text);
        }
      } catch {
        continue;
      }
    }
    return parts.join("");
  }

  if (adapterName === "claude") {
    const env = Object.fromEntries(
      Object.entries(Bun.env).filter(([k]) => k !== "CLAUDECODE"),
    );
    const proc = Bun.spawn(["claude", "-p", prompt, "--output-format", "text"], {
      stdout: "pipe",
      stderr: "ignore",
      env,
    });
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    return text;
  }

  throw new Error(`Unknown adapter: ${adapterName}`);
}

export function applyDescription(skillPath: string, newDescription: string): void {
  const content = readFileSync(skillPath, "utf-8");

  // Replace description in YAML frontmatter
  const updated = content.replace(
    /^(---\n[\s\S]*?description:\s*)[>|]?-?\s*\n(?:[ \t]+.*\n?)*([\s\S]*?---)/,
    `$1>\n  ${newDescription.replace(/\n/g, "\n  ")}\n$2`,
  );

  if (updated === content) {
    // Try inline replacement
    const inlineUpdated = content.replace(
      /^(---\n[\s\S]*?description:\s*)["']?.*?["']?\s*$/m,
      `$1>\n  ${newDescription}`,
    );
    writeFileSync(skillPath, inlineUpdated);
  } else {
    writeFileSync(skillPath, updated);
  }
}
