---
description: >-
  Run a structured Codex code review on the current diff as a closeout check
  before commit or ship.
---

# Autoreview

Run the autoreview helper as a closeout check. Codex reviews the diff, returns
structured JSON findings, and exits nonzero if actionable issues remain. Loop
until clean.

User input: $ARGUMENTS

## Pick Target

If $ARGUMENTS specifies a mode or base ref, use it. Otherwise auto-detect:

- Dirty working tree → `--mode local`
- On a branch with an open PR → `--mode branch` with the PR base
- On a branch without a PR → `--mode branch --base origin/main`
- Already-committed work → `--mode commit --commit HEAD`

## Run

```bash
python ~/Repos/zacczakk/metronome/scripts/autoreview --mode branch --base origin/main
```

Override examples:

```bash
# Local uncommitted changes
python ~/Repos/zacczakk/metronome/scripts/autoreview --mode local

# Specific commit
python ~/Repos/zacczakk/metronome/scripts/autoreview --mode commit --commit HEAD

# With parallel tests
python ~/Repos/zacczakk/metronome/scripts/autoreview --mode branch --base origin/main --parallel-tests "pytest tests/ -x"

# Stream live Codex output
python ~/Repos/zacczakk/metronome/scripts/autoreview --mode branch --base origin/main --stream-engine-output
```

## Contract

- Treat review output as advisory. Verify every finding by reading the real code path.
- Reject unrealistic edge cases, speculative risks, and broad rewrites.
- Fix only grounded findings. Rerun focused tests and rerun autoreview after each fix.
- Keep going until autoreview exits 0 with no accepted/actionable findings.
- Do not switch engines unless asked. Codex is the default.
- Heartbeat lines (`review still running: ... elapsed=...s pid=...`) are healthy — do not kill the process.
- Reviews can take up to 30 minutes. Do not interrupt under the 30-minute window.

## Final Report

Include:
- Command run
- Tests run (if any)
- Findings accepted/rejected and brief reason
- Final clean exit confirmation, or any consciously rejected finding with rationale
