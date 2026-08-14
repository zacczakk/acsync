# AGENTS.md

zacczakk owns this. Start: say hi + 1 line about your mood today.
Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

## Agent Protocol
- Contact: `@zacczakk` on GitHub.
- Workspace: `~/Repos/`. Missing repo: clone `https://github.com/zacczakk/<repo>.git`.
- 3rd-party/OSS (non-zacczakk): clone under `~/Repos/oss/`.
- Files: repo or `~/Repos/zacczakk/metronome/`.
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
- Web: search early; prefer 2025–2026 sources. Claude: Tavily MCP; others: WebFetch + Tavily search tool. Tavily extract is legally restricted to approved domains; 403 usually means domain not approved, not MCP breakage. External/domain allowlisting needs legal approval from Andreas Jauch. `curl.md` = fallback for public docs/articles when WebFetch/Defuddle are noisy; not for GitHub repos.
- Local docs/media: prefer `markitdown` for PDF/DOCX/PPTX/XLSX/image/audio inspection before bespoke parsing. LLM-oriented markdown, not fidelity conversion.
- **No breadcrumbs**. Delete/move code = no residual comments. No `// moved to X`. Just remove.
- Fix root cause, not bandaids.
- Idiomatic, simple, maintainable. Simplest intuitive solution wins.
- Kill dead code. Unused params/helpers: delete + update callers.
- **Search before pivoting**. Stuck? Search official docs first. No direction change unless asked.

## Tool Routing
- For tool-specific work, use the named tool first; do not replace it with generic web search or assume it is unavailable. Read `~/Repos/zacczakk/metronome/configs/instructions/TOOLS.md` for full flags and fallback rules.
- **Past coding sessions:** `qmd query "..." -c memory` for curated memory, then run `sessions export` when new sessions may be missing from the index, followed by `sessions search "..."` for exact history or `sessions find "..."` for semantic history. `sessions list` and `sessions read` query live source databases.
- **GitHub:** use the loaded `github` MCP server for repository, issue, pull request, code, Actions, and review work. Use `gh` for URL-driven PR/CI operations or when MCP is unavailable. MCP auth requires `GITHUB_PERSONAL_ACCESS_TOKEN`.
- **Palantir Foundry:** use native `palantir-mcp` when loaded and responsive; for shell calls use the `palantir` CLI, then registered MCPorter. Tux owns native Palantir auth and host wiring; do not invent env/config.
- **MCP discovery:** `mcporter config list` (fast local/project registry), `mcporter config list --source import` (editor imports), then `mcporter list <server> --schema --json`. Native MCP config is separate, but MCPorter can discover imported editor definitions.

## Flow & Runtime
- Use repo's package manager/runtime; no swaps w/o approval.
- Default to direct execution. Delegate only independent, specialist, or context-heavy work that is likely to save main-session effort; never delegate work already investigated by the main agent.
- Quality-first session budget: target ≤35 minutes, ≤4 child sessions, one independent final review, and one focused re-review. Ask before exceeding any limit.
- Act-and-report on scoped work with precedent. Propose-then-execute on novel work.
- Deterministic formatting hooks when available.
- Hangs >5 min: stop, capture logs, ask user.
- New dep: research health + fit; confirm w/ user.
- Helpers in `scripts/` (`committer`, `ask-model`, `sessions`, `docs-list.ts`)

## Proactive Behaviors
- Dead code in files you're editing: clean without asking.
- Bugs found during other work: surface before fixing.
- Better patterns in touched files: suggest refactor opportunities.
- Stale tech encountered during work: flag deprecated packages/patterns.
- Never guess API signatures, CLI flags, version numbers, config options. Look it up.
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.

## Browser
- Prefer `agent-browser` for all browser work (automation, scraping, screenshots, console/network, authenticated pages).
- Default: `agent-browser --profile Default open <url> --headed`. `Default` = `z/acc`; isolated copy, auth intact. No `--native`.
- Loop: `snapshot -i` → act on refs → re-snapshot after page changes. Reuse during task; `close` when done.
- No `--auto-connect` unless Phil explicitly asks. Never `pkill`/restart Chrome. 403: stop.
- Viewport `1800x1169` (Phil's logical res). Never 1920x1080 — overflows.
- Skill: `agent-browser skills get core`. Ignore kill/reset advice. Lightpanda: unauthenticated reading only.

## Session Notes
Write atomic notes to `~/Vaults/Memory/sessions/` using `session-notes` skill.
Triggers: decision, discovery, dead end, surprising behavior, "need this later", task completion, pre-compaction.
Write at point-of-discovery, not end-of-task. Bias toward writing — a redundant note costs less than a lost insight.
Skip trivial decisions. One note per trigger, not batched.

## Session End
When work concludes (skip if trivial):
1. Summarize (telegraphic).
2. Ensure all decisions/discoveries from this session have session notes.
3. Write/update pattern notes in Memory vault if reusable knowledge emerged.
4. Update `SOUL.md` (Learned Preferences, Relationship Notes) if dynamic shifted.

## Agent Config Management
- Global configs are managed in `~/Repos/zacczakk/metronome`.
- Keep secrets in `.env`; never commit them.
- Canonical rules: `~/Repos/zacczakk/metronome/configs/instructions/AGENTS.md`
- Canonical commands: `~/Repos/zacczakk/metronome/configs/commands`
- Canonical subagents: `~/Repos/zacczakk/metronome/configs/agents`
- Canonical skills: `~/Repos/zacczakk/metronome/configs/skills`
- Helper scripts: `~/Repos/zacczakk/metronome/scripts`

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
- **Memory vault lookup:** scan `summary:` frontmatter first (`rg '^summary:.*topic' ~/Vaults/Memory/ --glob '*.md' -i`). Only read full notes when summary matches or is unclear. If Memory vault has no relevant notes, fall back to `sessions search "query"` or `sessions find "query"` for past session history. Full guide in `~/Vaults/AGENTS.md`.

## Build / Test
- No mocks; unit or e2e.
- During iteration, run the narrowest test that proves the changed behavior, then the impacted suite when shared code is affected.
- Verification evidence remains valid while its inputs and relevant files are unchanged. Record the exact command and result; do not rerun a passing command without a relevant change or concrete evidence gap.
- Implementers own targeted and impacted checks. Reviewers inspect code and existing evidence, then run only missing proof. The main agent owns at most one final gate.
- Before handoff: run relevant checks. Full gate (lint/typecheck/tests/docs) only for milestones, PRs, and releases.
- CI red: `gh run list/view`, rerun, fix, push, repeat til green.
- Waiting for CI/build/deploy: poll with `gh run view`; max 4 min per sleep interval (check → sleep ≤4 min → check → repeat).
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
- React: no direct `useEffect`. Five replacement patterns:
  1. Derived state — compute inline during render, no useState+useEffect sync
  2. Data-fetching lib — useQuery/useSWR; no manual fetch-in-effect
  3. Event handlers — user action = handler, not flag→effect relay
  4. `useMountEffect` — mount-only external sync; the one escape hatch (`@/hooks/use-mount-effect`)
  5. Key remounting — `<Component key={id} />` for clean state reset
  Per-project: ESLint `no-restricted-syntax` + `no-restricted-imports` to hard-ban useEffect.

## Tools
Read `~/Repos/zacczakk/metronome/configs/instructions/TOOLS.md` before using `sessions`, GitHub MCP, Palantir MCP, or MCPorter.
On PATH: `trash`, `metronome`, `committer`, `docs-list`, `sessions`, `agent-browser`, `qmd`, `obsidian`, `gh`, `mcporter`, `palantir`, `bird`, `markitdown`.
Full catalog: `~/Repos/zacczakk/metronome/configs/instructions/TOOLS.md`. Read when you need flags, subcommands, or usage patterns for any tool above.
