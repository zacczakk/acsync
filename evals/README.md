# Skill Evals

CLI-agnostic framework for testing whether skill descriptions trigger correctly.

## Quick Start

```bash
# Run evals (opencode adapter, default)
bun evals/runner.ts --skill session-notes --verbose

# Use claude adapter
bun evals/runner.ts --skill session-notes --adapter claude

# Improve description automatically
bun evals/runner.ts --skill session-notes --improve --iterations 3
```

## How It Works

1. The runner reads an eval set (`evals/sets/<skill>.json`) — an array of `{query, should_trigger}` pairs.
2. For each query, it spawns an agent session (`opencode run` or `claude -p`).
3. It streams the JSON output and checks if the agent loaded the target skill.
4. Results are reported as pass/fail + an HTML report.

The opencode adapter uses streaming early-exit — it kills the agent process as soon as triggering is detected (or the first step completes without triggering), so each query takes ~15-25 seconds instead of minutes.

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--skill` | (required) | Skill name (must exist in `configs/skills/`) |
| `--adapter` | `opencode` | Execution backend: `opencode`, `claude` |
| `--eval-set` | `evals/sets/<skill>.json` | Path to eval set JSON |
| `--workers` | `3` | Concurrent query workers |
| `--model` | (adapter default) | Model override |
| `--report` | `auto` | HTML report path (`auto` = temp file, `none` = skip) |
| `--verbose` | `false` | Print per-query progress |
| `--improve` | `false` | Run description improvement loop |
| `--iterations` | `3` | Max improvement iterations |

## Eval Set Format

```json
[
  { "query": "A prompt that should trigger the skill", "should_trigger": true },
  { "query": "A prompt that should NOT trigger it", "should_trigger": false }
]
```

Guidelines for writing eval queries (from Anthropic's skill-creator):
- Queries should be substantive — simple one-step tasks won't reliably trigger skills.
- Include both positive (should trigger) and negative (should not) cases.
- Negative cases should be plausible near-misses, not obviously unrelated.
- Aim for 10-15 queries per skill (6 positive, 6 negative minimum).

## Adapters

### opencode (default)

Runs `opencode run --format json` and parses NDJSON stream events. Detects skill loading via `tool_use` events where `tool === "skill"`.

### claude

Runs `claude -p --output-format stream-json` and parses stream events. Detects skill loading via `content_block_start` events with tool name `Skill` or `Read`.

## Description Improvement

`--improve` runs an optimization loop:

1. Evaluate current description
2. Send failures to the agent with improvement instructions
3. Apply proposed description to SKILL.md
4. Re-evaluate
5. Repeat up to `--iterations` times
6. Apply the best-scoring description

The improvement prompt is routed through the same adapter as evals — no separate API key needed.

## Files

```
evals/
  runner.ts              CLI entry point
  types.ts               Shared types (EvalQuery, EvalResult, Adapter)
  improve.ts             Description improvement loop
  report.ts              HTML report generator
  adapters/
    opencode.ts          OpenCode execution backend
    claude.ts            Claude Code execution backend
  sets/
    *.json               Eval query sets (one per skill)
```
