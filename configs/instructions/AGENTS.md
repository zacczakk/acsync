# AGENTS.md

zacczakk owns this. Start: say hi + 1 line about your mood today.
Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

## Agent Protocol
- Contact: `@zacczakk` on GitHub.
- Workspace: `~/Repos/`. Missing repo: clone `https://github.com/zacczakk/<repo>.git`.
- 3rd-party/OSS (non-zacczakk): clone under `~/Repos/oss/`.
- Files: repo or `~/Repos/acsync/`.
- PRs: use `gh pr view/diff` (no URLs).
- "Make a note" => edit `AGENTS.md` and/or active plan in `docs/plans/` (shortcut; not a blocker).
- No `./runner`. Guardrails: use `trash` for deletes.
- Need upstream file: stage in `/tmp/`, then cherry-pick; never overwrite tracked.
- Bugs: add regression test when it fits.
- Keep files <~500 LOC; split/refactor as needed.
- Commits: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- CI: `gh run list/view` (rerun/fix til green).
- Prefer end-to-end verify; if blocked, say what's missing.
- New deps: quick health check (recent releases/commits, adoption).
- Web: search early; prefer 2025–2026 sources. Claude: Tavily MCP; others: WebFetch + Tavily search tool.
- Style: telegraph. Drop filler/grammar. Min tokens.
- **No breadcrumbs**. Delete/move code = no residual comments. No `// moved to X`. Just remove.
- Fix root cause, not bandaids.
- Idiomatic, simple, maintainable. Simplest intuitive solution wins.
- Kill dead code. Unused params/helpers: delete + update callers.
- **Search before pivoting**. Stuck? Search official docs first. No direction change unless asked.

## Flow & Runtime
- Use repo's package manager/runtime; no swaps w/o approval.
- Aggressive delegation. Subagents for anything exploratory, research-heavy, or context-expensive. Main context = coordination + decisions.
- Act-and-report on scoped work with precedent. Propose-then-execute on novel work.
- Deterministic formatting hooks when available.
- Hangs >5 min: stop, capture logs, ask user.
- New dep: research health + fit; confirm w/ user.
- Helpers in `scripts/` (`committer`, `ask-model`, `docs-list.ts`, `browser-tools.ts`)

## Proactive Behaviors
- Dead code in files you're editing: clean without asking.
- Bugs found during other work: surface before fixing.
- Better patterns in touched files: suggest refactor opportunities.
- Stale tech encountered during work: flag deprecated packages/patterns.
- Never guess API signatures, CLI flags, version numbers, config options. Look it up.

## Session Notes
Write atomic notes to `~/Vaults/Memory/sessions/` using `session-notes` skill.
Triggers: meaningful decision, discovery/correction, task completion, pre-compaction.
Skip trivial decisions. One note per trigger, not batched.

## Session End
When work concludes (skip if trivial):
1. Summarize (telegraphic).
2. Ensure all decisions/discoveries from this session have session notes.
3. Write/update pattern notes in Memory vault if reusable knowledge emerged.
4. Update `SOUL.md` (Learned Preferences, Relationship Notes) if dynamic shifted.

## Agent Config Management
- Global configs are managed in `~/Repos/acsync`.
- Keep secrets in `.env`; never commit them.
- Canonical rules: `~/Repos/acsync/configs/instructions/AGENTS.md`
- Canonical commands: `~/Repos/acsync/configs/commands`
- Canonical subagents: `~/Repos/acsync/configs/agents`
- Canonical skills: `~/Repos/acsync/configs/skills`
- Helper scripts: `~/Repos/acsync/scripts`

## PR Feedback
- Active PR: `gh pr view --json number,title,url --jq '"PR #\\(.number): \\(.title)\\n\\(.url)"'`.
- PR comments: `gh pr view …` + `gh api …/comments --paginate`.
- Replies: cite fix + file/line; resolve threads only after fix lands.
- When merging a PR: thank the contributor (in `docs/CHANGELOG.md` if repo has one).

## Docs
- System of record: `docs/`. AGENTS.md = index.
- Unfamiliar repo or domain: run `docs-list` (if installed) and read relevant docs before coding.
- Honor `Read when` hints in doc front-matter.
- Keep notes short; update docs when behavior/API changes (no ship w/o docs).
- Staleness: dead links / stale refs = bugs; groom docs often.
- Context7 MCP has library documentation.

## Build / Test
- No mocks; unit or e2e.
- Before handoff: run relevant checks. Full gate (lint/typecheck/tests/docs) for milestones, PRs, and releases.
- CI red: `gh run list/view`, rerun, fix, push, repeat til green.
- Keep it observable (logs, panes, tails, MCP/browser tools).
- Release: read release checklist if repo has one.

## Git
- Safe by default: `git status/diff/log`. Push only when user asks.
- `git checkout` ok for PR review / explicit request.
- Branch changes require user consent; destructive ops forbidden unless explicit (`reset --hard`, `clean`, `restore`, `rm`, …).
- Remotes under `~/Repos`: prefer HTTPS; flip SSH->HTTPS before pull/push.
- Use Commit helper `committer`.
- Don't delete/rename unexpected stuff; stop + ask.
- User types command = consent.
- Big review: `git --no-pager diff --color=never`.
- Multi-agent coordination:
  - Check `git status/diff` before edits; ship small commits.
  - Claim scope: note owned files/modules in active plan in `docs/plans/` before editing.
  - Pull before edit, commit immediately after.
  - Conflict detected: stop, show diff, ask user.
  - Don't revert or modify another agent's recent commits w/o consent.

## Language/Stack Notes
- Swift: use workspace helper/daemon; validate `swift build` + tests; keep concurrency attrs right.
- TypeScript: use repo PM; prefer `bun` over `npm`/`yarn`/`pnpm`; run `docs:list`; keep files small; follow existing patterns; do not use `any` or `as`.
- Python: use `ruff`, `uv`, and `pyproject.toml`. no `pip` venvs, poetry, or `requirements.txt` unless asked. `pytest` for tests. strong types & type hints.

## Permissions and Safety
- Do not read or commit secrets. Use placeholders and `.env` for local values.

## Critical Thinking
- Fix root cause (not band-aid).
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.

## Tools
On PATH: `trash`, `acsync`, `committer`, `docs-list`, `browser-tools`, `mcporter`, `qmd`, `obsidian`, `gh`.
Full catalog: `~/Repos/acsync/configs/instructions/TOOLS.md`.

