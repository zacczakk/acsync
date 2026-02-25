# AGENTS.md

zacczakk owns this. Start: say hi + 1 motivating line.
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
- Use repo’s package manager/runtime; no swaps w/o approval.
- Subagents for deep work (planning, research, verification, refactor).
- Deterministic formatting hooks when available.
- Hangs >5 min: stop, capture logs, ask user.
- New dep: research health + fit; confirm w/ user.
- Helpers in `scripts/` (`committer`, `ask-model`, `docs-list.ts`, `browser-tools.ts`)

## Screenshots ("use a screenshot")
- Pick newest PNG in `~/Desktop` or `~/Downloads`.
- Verify it's the right UI (ignore filename).
- Size: `sips -g pixelWidth -g pixelHeight <file>` (prefer 2×).
- Optimize: `imageoptim <file>` (install: `brew install imageoptim-cli`).
- Replace asset; keep dimensions; commit; run gate; verify CI.

## PR Feedback
- Active PR: `gh pr view --json number,title,url --jq '"PR #\\(.number): \\(.title)\\n\\(.url)"'`.
- PR comments: `gh pr view …` + `gh api …/comments --paginate`.
- Replies: cite fix + file/line; resolve threads only after fix lands.
- When merging a PR: thank the contributor in `CHANGELOG.md`.

## Docs
- System of record: `docs/`. AGENTS.md = index.
- Start: run docs list (`docs:list` script, or `bin/docs-list` here if present; ignore if not installed); open docs before coding.
- Follow links until domain makes sense; honor `Read when` hints.
- Keep notes short; update docs when behavior/API changes (no ship w/o docs).
- Staleness: dead links / stale refs = bugs; groom docs often.
- Context7 MCP has library documentation.

### Structure (create dirs as needed per repo)

#### `docs/architecture.md`
- Domain map: modules, packages, layers, dependency direction.
- Create on first non-trivial setup. Update when boundaries change.
- Map, not novel. Diagram-like bullets preferred.

#### `docs/design/`
- One file per design decision (`docs/design/{slug}.md`). Add `index.md` w/ one-line summaries.
- Create when: choosing between approaches, adopting patterns, rejecting alternatives.
- Format: context, options considered, decision, consequences, verification status.

#### `docs/plans/`
- Execution plans. Replaces `TASK.md` / `.tasks/`.
- `active/{slug}/PLAN.md` — goals, steps, verification criteria, progress log.
- `active/{slug}/CONTEXT.md` — discovery context.
- `completed/{slug}/` — archived plans; move here when done.
- `STATE.md` — active plan pointer.
- `DECISIONS.md` — cross-plan decision log.
- Complex work → plan in repo, not ephemeral chat.

#### `docs/references/`
- Vendored external docs: llms.txt, API specs, library guides.
- Add when adopting a dep whose docs agent needs at coding time.
- Concise extracts over full dumps. Link to source in header comment.

#### `docs/generated/`
- Auto-generated: DB schemas, API docs, type inventories.
- Gitignore or CI-refresh. Never hand-edit.

## PR Feedback
- Active PR: `gh pr view --json number,title,url --jq '"PR #\\(.number): \\(.title)\\n\\(.url)"'`.
- PR comments: `gh pr view …` + `gh api …/comments --paginate`.
- Replies: cite fix + file/line; resolve threads only after fix lands.
- When merging a PR: thank the contributor (in `docs/CHANGELOG.md` if repo has one).

## Build / Test
- No mocks; unit or e2e.
- Before handoff: run full gate (lint/typecheck/tests/docs).
- CI red: `gh run list/view`, rerun, fix, push, repeat til green.
- Keep it observable (logs, panes, tails, MCP/browser tools).
- Release: read release checklist if repo has one.

## Git
- Safe by default: `git status/diff/log`. Push only when user asks.
- `git checkout` ok for PR review / explicit request.
- Branch changes require user consent.
- Destructive ops forbidden unless explicit (`reset --hard`, `clean`, `restore`, `rm`, …).
- Remotes under `~/Repos`: prefer HTTPS; flip SSH->HTTPS before pull/push.
- Use Commit helper `./scripts/committer`.
- Don't delete/rename unexpected stuff; stop + ask.
- No repo-wide S/R scripts; keep edits small/reviewable.
- Avoid manual `git stash`; auto-stash during pull/rebase OK (soft rule).
- User types command = consent.
- No amend unless asked.
- Big review: `git --no-pager diff --color=never`.
- Multi-agent coordination:
  - Check `git status/diff` before edits; ship small commits.
  - Claim scope: note owned files/modules in active plan in `docs/plans/` before editing.
  - Pull before edit, commit immediately after.
  - Conflict detected: stop, show diff, ask user.
  - Don't revert or modify another agent's recent commits w/o consent.

## Language/Stack Notes
- Swift: use workspace helper/daemon; validate `swift build` + tests; keep concurrency attrs right.
- TypeScript: use repo PM; run `docs:list`; keep files small; follow existing patterns; do not use `any` or `as`.
- Python: use `ruff`, `uv`, and `pyproject.toml`. no `pip` venvs, poetry, or `requirements.txt` unless asked. `pytest` for tests. strong types & type hints.

## Permissions and Safety
- Do not read or commit secrets. Use placeholders and `.env` for local values.

## Critical Thinking
- Fix root cause (not band-aid).
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.

## Tools
Read `~/Repos/acsync/configs/instructions/TOOLS.md` for the full tool catalog.

### trash
- Move files to Trash: `trash …` (system command).

### acsync
- Agent config sync on PATH. `acsync {check|push|pull|diff|render|helpers}`.

### /scripts/committer
- Commit helper. Stages only listed paths; required.

### bin/docs-list / scripts/docs-list.ts
- Optional. Lists `docs/` + enforces front-matter. Ignore if `bin/docs-list` not installed. Rebuild: `bun build scripts/docs-list.ts --compile --outfile bin/docs-list`.

### bin/browser-tools / scripts/browser-tools.ts
- Chrome DevTools helper. Cmds: `start`, `nav`, `eval`, `screenshot`, `pick`, `cookies`, `inspect`, `kill`.
- Rebuild: `bun build scripts/browser-tools.ts --compile --target bun --outfile bin/browser-tools`.

### mcporter / iterm / firecrawl / XcodeBuildMCP
- MCP launcher: `npx mcporter <server>` (see `npx mcporter --help`). Common: `palantir-mcp` `liquid-carbon` `shadcn` `chrome-devtools`.

### gh
- GitHub CLI for PRs/CI/releases. Given issue/PR URL (or `/pull/5`): use `gh`, not web search.
- Examples: `gh issue view <url> --comments -R owner/repo`, `gh pr view <url> --comments --files -R owner/repo`.

## Frontend Aesthetics
Avoid "AI slop" UI. Be opinionated + distinctive.

Do:
- Typography: pick a real font; avoid Inter/Roboto/Arial/system defaults.
- Theme: commit to a palette; use CSS vars; bold accents > timid gradients.
- Motion: 1-2 high-impact moments (staggered reveal beats random micro-anim).
- Background: add depth (gradients/patterns), not flat default.

Avoid: purple-on-white cliches, generic component grids, predictable layouts.

## Web Access
WebFetch blocked (corporate proxy). Use Tavily MCP
(`mcp__tavily_*`) for web lookups.

## SSL Certificates
SSL_CERT_FILE + NODE_EXTRA_CA_CERTS -> `~/.claude/cacert.pem`.
Set in `~/.claude/settings.json` under `env` key.

## MCPorter
Non-native MCP servers via `mcporter call`. See `## Tools` in AGENTS.md.

## Notes
- Subagents: `experimental.enableAgents = true` in `~/.gemini/settings.json`.
- Context: `AGENTS.md` canonical; `GEMINI.md` fallback (`context.fileName = ["AGENTS.md", "GEMINI.md"]`).
- Missing local context: import `@~/Repos/acsync/AGENTS.md`.

## Paths
- Canonical rules: `~/Repos/acsync/configs/instructions/AGENTS.md`
- Canonical commands: `~/Repos/acsync/configs/commands`
- Canonical subagents: `~/Repos/acsync/configs/agents`
- Canonical skills: `~/Repos/acsync/configs/skills`
- Helper scripts: `~/Repos/acsync/scripts`

## Config Management
- Global configs are managed in `~/Repos/acsync`.
- Keep secrets in `.env`; never commit them.
