# Agent Operating System (Ground Truth)

zacczakk owns this. Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

## Agent Protocol
- Contact: @zacczakk on GitHub.
- Model preference: latest only. OK: Anthropic Opus 4.6 / Sonnet 4.5 (Sonnet 3.5 = old; avoid), OpenAI GPT-5.3, xAI Grok-4.1 Fast, Google Gemini 3 Flash.
- Workspace: `~/Repos`. Missing repo: clone `https://github.com/zacczakk/<repo>.git`.
- 3rd-party/OSS (non-zacczakk): clone under `~/Repos/oss`.
- Files: repo or `~/Repos/agents`.
- PRs: use `gh pr view/diff` (no URLs).
- “Make a note” => edit `AGENTS.md` and/or `TASK.md` (shortcut; not a blocker).
- No `./runner`. Guardrails: use `trash` for deletes.
- Need upstream file: stage in `/tmp/`, then cherry-pick; never overwrite tracked.
- Bugs: add regression test when it fits.
- Keep files <~500 LOC; split/refactor as needed.
- Commits: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- Subagents: read `docs/subagent.md`.
- Editor: `code <path>`.
- CI: `gh run list/view` (rerun/fix til green).
- Prefer end-to-end verify; if blocked, say what’s missing.
- New deps: quick health check (recent releases/commits, adoption).
- Web: search early; quote exact errors; prefer 2025–2026 sources; fallback Tavily MCP.
- WebFetch: blocked in Claude Code (corporate proxy); works fine in OpenCode. Use Tavily for search regardless (better structured results).
- Style: telegraph. Drop filler/grammar. Min tokens (global AGENTS + replies).
- **No breadcrumbs**. If you delete or move code, do not leave a comment in the old place. No "// moved to X", no "relocated". Just remove it.
- Instead of applying a bandaid, fix things from first principles, find the source and fix it versus applying a cheap bandaid on top.
- Write idiomatic, simple, maintainable code. Always ask yourself if this is the most simple intuitive solution to the problem.
- Leave each repo better than how you found it. If something is giving a code smell, fix it for the next person.
- Clean up unused code ruthlessly. If a function no longer needs a parameter or a helper is dead, delete it and update the callers instead of letting the junk linger.
- **Search before pivoting**. If you are stuck or uncertain, do a quick web search for official docs or specs, then continue with the current approach. Do not change direction unless asked.

## Core Principles
1. **Plan first**: For any non-trivial task, create a plan and get alignment before execution.
2. **Verify before done**: Tests > manual checks > "looks right". If you cannot run tests, say why.
3. **Fix root cause**: No band-aids. If it feels hacky, stop and ask for a better approach.
4. **Small, reviewable changes**: Prefer small diffs and explicit steps.
5. **Compound knowledge**: After mistakes, add a rule here or in TASK.md so it does not happen again.

## Flow & Runtime
- Enter plan mode for non-trivial tasks.
- Create or update `TASK.md` with goals, steps, and verification criteria.
- Ask for missing info before executing.
- Update this file or `TASK.md` with new rules, commands, or pitfalls.
- GSD upkeep: run `npx get-shit-done-cc@latest --all --global` often (before major work / weekly).
- GSD patch: `model_overrides` in `gsd-tools.js` (3 edits: `loadConfig`, `cmdResolveModel`, `resolveModelInternal`). Re-apply after GSD updates. Config: `"model_overrides": { "agent-type": "opus" }` in `.planning/config.json`.
- One task per session.
- Use parallel sessions for independent tasks; label each session and keep scopes separate.
- Use repo’s package manager/runtime; no swaps w/o approval.
- Use Codex background for long jobs; tmux only for interactive/persistent (debugger/server).
- Use slash commands to enforce zz-plan/zz-verify/zz-handoff discipline.
- Use subagents for deep work (planning, research, verification, refactor).
- Prefer deterministic formatting hooks when available to avoid CI churn.
- Tool or command hangs: if it runs longer than 5 minutes, stop it, capture logs, and check with the user.
- Adding a dependency: research well-maintained options and confirm fit with the user before adding.
- Repo helpers (`scripts/`): keep byte-identical across repos; use `/zz-sync-agent-helpers` to distribute.
- When taking on new work, follow this order:
  1. Think about the architecture.
  2. Research official docs, blogs, or papers on the best architecture.
  3. Review the existing codebase.
  4. Compare the research with the codebase to choose the best fit.
  5. Implement the fix or ask about the tradeoffs the user is willing to make.

## Screenshots (“use a screenshot”)
- Pick newest PNG in `~/Desktop` or `~/Downloads`.
- Verify it’s the right UI (ignore filename).
- Size: `sips -g pixelWidth -g pixelHeight <file>` (prefer 2×).
- Optimize: `imageoptim <file>` (install: `brew install imageoptim-cli`).
- Replace asset; keep dimensions; commit; run gate; verify CI.

## Docs
- Start: run `python scripts/generate-docs.py`; open docs before coding.
- Follow links until domain makes sense; honor `Read when` hints.
- Keep notes short; update docs when behavior/API changes (no ship w/o docs).
- Add `read_when` hints on cross-cutting docs.
- Search Context7 MCP for library documentation.

## PR Feedback
- Active PR: `gh pr view --json number,title,url --jq '"PR #\\(.number): \\(.title)\\n\\(.url)"'`.
- PR comments: `gh pr view …` + `gh api …/comments --paginate`.
- Replies: cite fix + file/line; resolve threads only after fix lands.
- When merging a PR: thank the contributor (in `CHANGELOG.md` if repo has one).

## Build / Test
- Before handoff: run full gate (lint/typecheck/tests/docs).
- CI red: `gh run list/view`, rerun, fix, push, repeat til green.
- Keep it observable (logs, panes, tails, MCP/browser tools).
- Release: read `docs/RELEASING.md` (or find best checklist if missing).
- Definition of done by task type:
  - Bug fix: regression test + existing suite green + CI green.
  - Feature: tests + docs updated + CI green.
  - Refactor: behavior unchanged + tests pass + CI green.
  - Docs: render/preview if available + links valid.
- Avoid mock tests; do unit or e2e instead. Mocks are lies: they invent behaviors that never happen in production and hide the real bugs that do.
- Test everything with rigor. Our intent is ensuring a new person contributing to the same code base cannot break our stuff and that nothing slips by. We love rigour.

## Git
- Safe by default: `git status/diff/log`. Push only when user asks.
- `git checkout` ok for PR review / explicit request.
- Branch changes require user consent.
- Destructive ops forbidden unless explicit (`reset --hard`, `clean`, `restore`, `rm`, …).
- Remotes under `~/Repos`: prefer HTTPS; flip SSH->HTTPS before pull/push.
- Commit helper on PATH: `committer` (bash). Prefer it; if repo has `./scripts/committer`, use that.
- Don’t delete/rename unexpected stuff; stop + ask.
- No repo-wide S/R scripts; keep edits small/reviewable.
- Avoid manual `git stash`; if Git auto-stashes during pull/rebase, that’s fine (hint, not hard guardrail).
- If user types a command (“pull and push”), that’s consent for that command.
- No amend unless asked.
- Big review: `git --no-pager diff --color=never`.
- Multi-agent coordination:
  - Check `git status/diff` before edits; ship small commits.
  - Claim scope: note owned files/modules in `TASK.md` before editing.
  - Pull before edit, commit immediately after.
  - Conflict detected: stop, show diff, ask user.
  - Don't revert or modify another agent's recent commits w/o consent.

## Language/Stack Notes
- Swift: use workspace helper/daemon; validate `swift build` + tests; keep concurrency attrs right.
- TypeScript: use repo PM; run `docs:list`; keep files small; follow existing patterns; do not use `any` or `as`.
- Python: use `ruff`, `uv`, and `pyproject.toml`. no `pip` venvs, poetry, or `requirements.txt` unless asked; strong types, type hints everywhere, explicit models instead of loose dicts or strings.

## Permissions and Safety
- Do not read or commit secrets. Use placeholders and `.env` for local values.

## Critical Thinking
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.
- Leave progress notes in thread.

## Tools
Read `~/Repos/agents/docs/tools.md` for the full tool catalog if it exists.

### committer
- Commit helper (PATH). Stages only listed paths; required here. Repo may also ship `./scripts/committer`.
- Usage: `committer "commit message" file1 file2 ...`
- Example: `committer "fix: update config" src/app.ts README.md`

### trash
- Move files to Trash: `trash …` (system command).

### generate-docs
- Lists `docs/` catalog + enforces front-matter. Run: `python scripts/generate-docs.py`.

### bin/browser-tools / scripts/browser-tools.ts
- Chrome DevTools helper. Cmds: `start`, `nav`, `eval`, `screenshot`, `pick`, `cookies`, `inspect`, `kill`.
- Rebuild: `bun build scripts/browser-tools.ts --compile --target bun --outfile bin/browser-tools`.

### gh
- GitHub CLI for PRs/CI/releases. Given issue/PR URL (or `/pull/5`): use `gh`, not web search.
- Examples: `gh issue view <url> --comments -R owner/repo`, `gh pr view <url> --comments --files -R owner/repo`.

### tmux
- Use only when you need persistence/interaction (debugger/server).
- Quick refs: `tmux new -d -s codex-shell`, `tmux attach -t codex-shell`, `tmux list-sessions`, `tmux kill-session -t codex-shell`.

## Frontend Aesthetics
Avoid “AI slop” UI. Be opinionated + distinctive.

Do:
- Typography: pick a real font; avoid Inter/Roboto/Arial/system defaults.
- Theme: commit to a palette; use CSS vars; bold accents > timid gradients.
- Motion: 1–2 high-impact moments (staggered reveal beats random micro-anim).
- Background: add depth (gradients/patterns), not flat default.

Avoid: purple-on-white clichés, generic component grids, predictable layouts.
