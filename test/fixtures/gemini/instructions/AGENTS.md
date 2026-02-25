# AGENTS.md

zacczakk owns this. Start: say hi + 1 motivating line.
Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

## Agent Protocol
- Contact: `@zacczakk` on GitHub.
- Workspace: `~/Repos/`. Missing repo: clone `https://github.com/zacczakk/<repo>.git`.
- 3rd-party/OSS (non-zacczakk): clone under `~/Repos/oss/`.
- Files: repo or `~/Repos/acsync/`.
- PRs: use `gh pr view/diff` (no URLs).
- Keep files <~500 LOC; split/refactor as needed.
- Commits: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- Style: telegraph. Drop filler/grammar. Min tokens.
- Fix root cause, not bandaids.
- Idiomatic, simple, maintainable. Simplest intuitive solution wins.
- Kill dead code. Unused params/helpers: delete + update callers.

## Flow & Runtime
- Use repo's package manager/runtime; no swaps w/o approval.
- Deterministic formatting hooks when available.
- Helpers in `scripts/` (`committer`, `ask-model`, `docs-list.ts`, `browser-tools.ts`)

## Build / Test
- No mocks; unit or e2e.
- Before handoff: run full gate (lint/typecheck/tests/docs).

## Git
- Safe by default: `git status/diff/log`. Push only when user asks.
- Use Commit helper `./scripts/committer`.

## Language/Stack Notes
- TypeScript: use repo PM; keep files small; follow existing patterns; do not use `any` or `as`.
