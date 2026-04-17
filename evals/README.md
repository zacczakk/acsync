# Skill and Agent Evals

Framework for testing whether skills or agents auto-route correctly.

## Quick Start

```bash
# Run evals (opencode adapter, default)
bun evals/runner.ts --skill session-notes --verbose

# Use claude adapter
bun evals/runner.ts --skill session-notes --adapter claude

# Run OpenCode agent auto-routing evals
bun evals/runner.ts --type agent --agent research --adapter opencode

# Lower per-query timeout for faster routing checks
bun evals/runner.ts --type agent --agent research --adapter opencode --timeout 20000

# Improve description automatically
bun evals/runner.ts --skill session-notes --improve --iterations 3
```

## How It Works

1. The runner reads an eval set (`evals/sets/<name>.json`) — an array of `{query, should_trigger}` pairs.
2. For each query, it runs the selected backend.
3. It checks whether the target skill or agent was auto-routed.
4. Results are reported as pass/fail + an HTML report.

The opencode adapter uses streaming early-exit — it kills the agent process as soon as triggering is detected (or the first step completes without triggering), so each query takes ~15-25 seconds instead of minutes.

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--skill` | optional | Skill name (exists in `configs/skills/`) |
| `--type` | `skill` | Eval target type: `skill`, `agent` |
| `--agent` | optional | Agent name (exists in `configs/agents/`) |
| `--adapter` | `opencode` | Execution backend: `opencode`, `claude` |
| `--timeout` | `20000` | Per-query timeout in milliseconds |
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

For skill evals: runs `opencode run --format json` and parses NDJSON stream events.

For agent evals: also uses `opencode run --format json`, but detects auto-routing via streamed `task` tool calls (`subagent_type`) and, when OpenCode emits delegation text before the tool event, an explicit delegation-text fallback.

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
