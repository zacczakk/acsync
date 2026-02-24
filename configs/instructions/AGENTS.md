# Agent Operating System (Ground Truth)

zacczakk owns this. Work style: telegraph; noun-phrases ok; drop grammar; min tokens.

## Agent Protocol
- Contact: @zacczakk on GitHub.
- Model preference: latest only. OK: Anthropic Opus 4.6 / Sonnet 4.5 (Sonnet 3.5 = old; avoid), OpenAI GPT-5.3, xAI Grok-4.1 Fast, Google Gemini 3 Flash.
- Workspace: `~/Repos`. Missing repo: clone `https://github.com/zacczakk/<repo>.git`.
- 3rd-party/OSS (non-zacczakk): clone under `~/Repos/oss`.
- Files: repo or `~/Repos/acsync`.
- PRs: use `gh pr view/diff` (no URLs).
- "Make a note" => edit `AGENTS.md` and/or active plan in `docs/plans/` (shortcut; not a blocker).
- No `./runner`. Guardrails: use `trash` for deletes.
- Need upstream file: stage in `/tmp/`, then cherry-pick; never overwrite tracked.
- Bugs: add regression test when it fits.
- Keep files <~500 LOC; split/refactor as needed.
- Commits: Conventional Commits (`feat|fix|refactor|build|ci|chore|docs|style|perf|test`).
- Subagents: read `docs/subagent.md`.
- Editor: `code <path>`.
- CI: `gh run list/view` (rerun/fix til green).
- Prefer end-to-end verify; if blocked, say what's missing.
- New deps: quick health check (recent releases/commits, adoption).
- Web: search early; prefer 2025–2026 sources. Claude: Tavily MCP; others: WebFetch + Tavily search tool.
- WebFetch: blocked in Claude Code (corporate proxy); works fine in OpenCode. Use Tavily for search regardless (better structured results).
- Style: telegraph. Drop filler/grammar. Min tokens (global AGENTS + replies).
- **No breadcrumbs**. Delete/move code = no residual comments. No `// moved to X`. Just remove.
- Fix root cause, not bandaids.
- Idiomatic, simple, maintainable. Simplest intuitive solution wins.
- Leave repos better than found. Fix code smells.
- Kill dead code. Unused params/helpers: delete + update callers.
- **Search before pivoting**. Stuck? Search official docs first. No direction change unless asked.

## Core Principles
1. **Plan first**: Non-trivial: plan + align before executing.
2. **Verify before done**: Tests > manual checks > "looks right". If you cannot run tests, say why.
3. **Fix root cause**: No band-aids. Hacky? Stop + ask.
4. **Small, reviewable changes**: Small diffs; explicit steps.
5. **Compound knowledge**: Mistakes: add rule here or docs/plans/active/{slug}/PLAN.md. No repeats.

## Flow & Runtime
- Enter plan mode for non-trivial tasks.
- Update active plan in `docs/plans/`: goals, steps, verification.
- Ask for missing info before executing.
- New rules/pitfalls: update here or active plan in `docs/plans/`.
- GSD upkeep: run `npx get-shit-done-cc@latest --all --global` often (before major work / weekly).
- GSD patch: `model_overrides` in `gsd-tools.js` (3 edits: `loadConfig`, `cmdResolveModel`, `resolveModelInternal`). Re-apply after GSD updates. Config: `"model_overrides": { "agent-type": "opus" }` in `.planning/config.json`.
- One task per session.
- Use parallel sessions for independent tasks; label each session and keep scopes separate.
- Use repo's package manager/runtime; no swaps w/o approval.
- Use Codex background for long jobs; tmux only for interactive/persistent (debugger/server).
- Use slash commands to enforce zz-plan/zz-verify/zz-handoff discipline.
- Use subagents for deep work (planning, research, verification, refactor).
- Prefer deterministic formatting hooks when available to avoid CI churn.
- Hangs >5 min: stop, capture logs, ask user.
- New dep: research health + fit; confirm w/ user.
- Repo helpers (`scripts/`): keep byte-identical across repos; use `/zz-sync-agent-helpers` to distribute.
- When taking on new work, follow this order:
  1. Think architecture.
  2. Research: official docs, blogs, papers.
  3. Review codebase.
  4. Compare research vs codebase; pick best fit.
  5. Implement or ask about tradeoffs.

## Screenshots ("use a screenshot")
- Pick newest PNG in `~/Desktop` or `~/Downloads`.
- Verify it's the right UI (ignore filename).
- Size: `sips -g pixelWidth -g pixelHeight <file>` (prefer 2×).
- Optimize: `imageoptim <file>` (install: `brew install imageoptim-cli`).
- Replace asset; keep dimensions; commit; run gate; verify CI.

## Docs
- System of record: `docs/` in each repo. AGENTS.md = index, not encyclopedia.
- Progressive disclosure: AGENTS.md points to deeper docs; agent loads on demand.
- Repo knowledge > chat knowledge. Slack/thread decision? Encode in docs/ or it doesn't exist.
- Staleness: dead links / stale refs = bugs. Run `/groom-docs` periodically.
- Front-matter: run `python scripts/generate-docs.py`; honor `read_when` hints.
- Search Context7 MCP for library documentation.

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
- `active/{slug}/CONTEXT.md` — discovery context from `/zz-discuss`.
- `completed/{slug}/` — archived plans; move here when done.
- `STATE.md` — active plan pointer (managed by `/zz-plan`).
- `DECISIONS.md` — cross-plan decision log (managed by `/zz-decide`).
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
- Before handoff: run full gate (lint/typecheck/tests/docs).
- CI red: `gh run list/view`, rerun, fix, push, repeat til green.
- Keep it observable (logs, panes, tails, MCP/browser tools).
- Release: read `docs/RELEASING.md` (or find best checklist if missing).
- Definition of done by task type:
  - Bug fix: regression test + existing suite green + CI green.
  - Feature: tests + docs updated + CI green.
  - Refactor: behavior unchanged + tests pass + CI green.
  - Docs: render/preview if available + links valid.
- No mocks; unit or e2e. Mocks invent fake behaviors, hide real bugs.
- Test rigorously. New contributor can't break things; nothing slips by.

## Git
- Safe by default: `git status/diff/log`. Push only when user asks.
- `git checkout` ok for PR review / explicit request.
- Branch changes require user consent.
- Destructive ops forbidden unless explicit (`reset --hard`, `clean`, `restore`, `rm`, …).
- Remotes under `~/Repos`: prefer HTTPS; flip SSH->HTTPS before pull/push.
- Commit helper on PATH: `committer` (bash). Prefer it; if repo has `./scripts/committer`, use that.
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
- Python: use `ruff`, `uv`, and `pyproject.toml`. no `pip` venvs, poetry, or `requirements.txt` unless asked; strong types, type hints everywhere, explicit models instead of loose dicts or strings.

## Permissions and Safety
- Do not read or commit secrets. Use placeholders and `.env` for local values.

## Critical Thinking
- Unsure: read more code; if still stuck, ask w/ short options.
- Conflicts: call out; pick safer path.
- Unrecognized changes: assume other agent; keep going; focus your changes. If it causes issues, stop + ask user.
- Leave progress notes in thread.

## Tools
Read `~/Repos/acsync/configs/instructions/TOOLS.md` for the full tool catalog.

Quick reference:
- `acsync` — Config sync CLI. `acsync check --pretty`, `acsync push --force --delete`.
- `committer` — Safe git commit: `committer "message" file1 file2 ...`
- `trash` — Move files to Trash: `trash <path>`
- `gh` — GitHub CLI for PRs/CI. `gh pr view`, `gh issue view`.

## Frontend Aesthetics
Avoid "AI slop" UI. Be opinionated + distinctive.

Do:
- Typography: pick a real font; avoid Inter/Roboto/Arial/system defaults.
- Theme: commit to a palette; use CSS vars; bold accents > timid gradients.
- Motion: 1-2 high-impact moments (staggered reveal beats random micro-anim).
- Background: add depth (gradients/patterns), not flat default.

Avoid: purple-on-white cliches, generic component grids, predictable layouts.

## Agent Config Sync -- Learnings (2026-02-18)

Completed first full sync push across all 4 CLIs. Key findings:

### Path Migration (`.tasks/` -> `docs/plans/`)
- All slash commands updated to reference new planning structure
- `TASK.md` -> `PLAN.md` throughout
- `.tasks/DECISIONS.md` -> `docs/plans/DECISIONS.md`
- `.tasks/STATE.md` -> `docs/plans/STATE.md`
- `.tasks/{slug}/CONTEXT.md` -> `docs/plans/active/{slug}/CONTEXT.md`
- Affected commands: decide, discuss, gate, handoff, pickup, plan, pr, research, verify

### New Command: `/groom-docs`
- Added documentation quality scanner
- Checks: dead links, stale references, front-matter compliance, code drift
- Output: severity-ranked table (ERROR/WARN/INFO)
- Offers batch fixes with user consent
- Run periodically (weekly or before releases)

### Format Transformations Work As Specified
- **Claude**: Strip `zz-` prefix, nest under `zz/` subdirectory
- **OpenCode**: Frontmatter rebuild with `allowed-tools` -> `tools` map
- **Gemini**: TOML conversion with triple-quoted prompt strings
- **Codex**: Flat markdown with heading + description

### Settings Deep-Merge Preserved User Additions
- Claude: Kept user-added `Read(//Users/.../articles/**)` permission
- OpenCode: Preserved unmanaged keys (`$schema`, `model`, `hooks`)
- Path expansion (`~` -> absolute) worked correctly

### Non-Canonical Items Left Untouched
- Claude: `ralph-tui-*` skills (3) preserved
- GSD files/directories skipped correctly

### MCP Configs Already In Sync
- All 6 canonical MCP servers matched system state
- Secret injection logic validated (not needed this run)

### Backup System Worked
- Created `backups/2026-02-18T182618/` with CLI subdirs
- Backed up 10 Claude commands, 3 agents, 1 instruction file
- Backed up 17 OpenCode commands, 8 agents, 2 settings files
- Backed up 17 Gemini commands, 8 agents, 1 instruction file
- Backed up 17 Codex commands, 8 agents, 1 instruction file
- Total: 96 files backed up before first write

### Sync Stats
- **Commands**: 65 files updated (11 Claude, 18 OpenCode, 18 Gemini, 18 Codex)
- **Agents**: 27 files updated (3 Claude, 8 OpenCode, 8 Gemini, 8 Codex)
- **Instructions**: 4 files updated (all CLIs)
- **Settings**: 1 file updated (OpenCode only)
- **MCP**: 0 files updated (already in sync)
- **Skills**: 0 files updated (already in sync)

### Documentation Structure Evolution
Canonical AGENTS.md now has expanded `## Docs` section:
- Progressive disclosure strategy documented
- Four structured subdirectories: `architecture.md`, `design/`, `plans/`, `references/`
- `docs/plans/` replaces legacy `.tasks/` approach
- Front-matter enforcement via `scripts/generate-docs.py`
- Staleness = tracked refs vs actual code changes

### Next Steps
- Run `/zz-sync-agent-configs check` to verify drift is zero
- Add sync frequency to workflow (suggest: before major work / after merging PRs)
- Consider automating sync as pre-commit hook or CI check

## CLI-Specific Notes

### Claude Code

## Paths
- Canonical rules: `~/Repos/acsync/AGENTS.md`
- Canonical commands: `~/Repos/acsync/configs/commands`
- Canonical subagents: `~/Repos/acsync/configs/agents`
- Claude commands (rendered): `~/.claude/commands/zz/`
- Claude subagents (rendered): `~/.claude/agents/`
- Helper scripts: `~/Repos/acsync/scripts`

## Web Access
WebFetch blocked (corporate proxy). Use Tavily MCP
(`mcp__tavily_*`) for web lookups.

## SSL Certificates
SSL_CERT_FILE + NODE_EXTRA_CA_CERTS -> `~/.claude/cacert.pem`.
Set in `~/.claude/settings.json` under `env` key.

## MCPorter
Non-native MCP servers via `mcporter call`. See `## Tools` in AGENTS.md.

## Config Management
- Global configs are managed in `~/Repos/acsync`.
- Use `/zz:sync-agent-configs` to sync configs across CLIs.
- Keep secrets in `.env`; never commit them.

### OpenCode

## Paths
- Canonical rules: `~/Repos/acsync/AGENTS.md`
- Canonical commands: `~/Repos/acsync/configs/commands`
- Canonical subagents: `~/Repos/acsync/configs/agents`
- OpenCode commands (rendered): `~/.config/opencode/command/`
- OpenCode subagents (rendered): `~/.config/opencode/agents/`
- OpenCode skills (rendered): `~/.config/opencode/skill/`
- Helper scripts: `~/Repos/acsync/scripts`

## Naming Quirks
- Singular directories: `command/`, `skill/` (not `commands/`, `skills/`).
- MCP env key: `environment` (not `env`).
- MCP transport types: `local`/`remote` (not `stdio`/`http`).
- MCP command: always an array (not string + args).
- Provider env vars: `{env:VAR_NAME}` syntax (OpenCode resolves at startup).

## Web Access
- WebFetch works (no proxy block unlike Claude Code).
- Use WebFetch for specific URLs; Tavily search tool for broad queries.
- No native Tavily MCP (Claude-only); use the search tool directly.

## Config Management
- Global configs are managed in `~/Repos/acsync`.
- Use `/zz-sync-agent-configs` to sync configs across CLIs.
- Keep secrets in `.env`; never commit them.

### Gemini

## Paths
- Canonical rules: `~/Repos/acsync/AGENTS.md`
- Canonical commands: `~/Repos/acsync/configs/commands`
- Canonical subagents: `~/Repos/acsync/configs/agents`
- Gemini commands (rendered): `~/.gemini/commands`
- Gemini subagents (rendered): `~/.gemini/agents`
- Helper scripts: `~/Repos/acsync/scripts`

## Notes
- Subagents: `experimental.enableAgents = true` in `~/.gemini/settings.json`.
- Context: `AGENTS.md` canonical; `GEMINI.md` fallback (`context.fileName = ["AGENTS.md", "GEMINI.md"]`).
- Missing local context: import `@~/Repos/acsync/AGENTS.md`.

## Config Management
- Global configs are managed in `~/Repos/acsync`.
- Use `/zz-sync-agent-configs` to sync configs across CLIs.
- Keep secrets in `.env`; never commit them.

### Codex

## Paths
- Canonical rules: `~/Repos/acsync/AGENTS.md`
- Canonical commands: `~/Repos/acsync/configs/commands`
- Canonical subagents: `~/Repos/acsync/configs/agents`
- Canonical skills: `~/Repos/acsync/configs/skills`
- Codex prompts (rendered): `~/.codex/prompts`
- Codex skills (rendered): `~/.codex/skills`
- Helper scripts: `~/Repos/acsync/scripts`

## Helpers and Sync Discipline
- Repo helper scripts live in `scripts/` (committer, generate-docs, browser-tools).
- If helpers are synced to other repos, keep them byte-identical.
- Use `/zz-sync-agent-helpers` to manage helper drift.

## Config Management
- Global configs are managed in `~/Repos/acsync`.
- Use `/zz-sync-agent-configs` to sync configs across CLIs.
- Keep secrets in `.env`; never commit them.
