# Codebase Concerns

**Analysis Date:** 2026-02-19

## Tech Debt

**AGENTS.md contains stale sync learnings log (65 lines)**
- Issue: Lines 199–264 of `AGENTS.md` contain a one-time sync session log from 2026-02-18, with specific file counts, backup paths, and "next steps." This is operational history, not ground-truth rules. It bloats every system prompt since AGENTS.md is injected into all 4 CLIs.
- Files: `AGENTS.md` (lines 199–264)
- Impact: ~65 lines of context consumed in every agent session across all CLIs. These lines have zero decision-making value for future sessions—they describe what happened once, not what to do.
- Fix approach: Move the "Agent Config Sync — Learnings" section to `docs/design/sync-v2-learnings.md`. Keep only actionable rules (e.g., "re-apply GSD patch after updates") in AGENTS.md.

**browser-tools.ts exceeds 500 LOC limit (1,045 lines)**
- Issue: `scripts/browser-tools.ts` is 1,045 lines — more than double the repo's own `<~500 LOC` rule from AGENTS.md. It contains 10+ CLI subcommands, DOM picker injection, readability extraction, Chrome process enumeration, and content scraping all in one file.
- Files: `scripts/browser-tools.ts`
- Impact: Hard to navigate, test, or modify individual commands. A change to the `pick` command requires scrolling through 1,000+ lines of unrelated code.
- Fix approach: Extract into modules: `browser-tools/commands/` with one file per subcommand (start, nav, eval, screenshot, pick, console, search, content, cookies, inspect, kill) and a shared `browser-tools/lib/` for `connectBrowser`, `getActivePage`, `extractReadableContent`, `describeChromeSessions`, etc.

**No TypeScript configuration or type checking**
- Issue: No `tsconfig.json` exists. The `scripts/browser-tools.ts` file uses 9 explicit `any` types (lines 471, 496, 500, 824, 849, 854, 855, 879) and 20+ `as` type assertions. The repo's own AGENTS.md rule says "do not use `any` or `as`."
- Files: `scripts/browser-tools.ts`, project root (missing `tsconfig.json`)
- Impact: No compile-time type safety. Type errors only surface at runtime. The `any` types in `ensureReadability(page: any)` and `extractReadableContent(page: any)` lose all Puppeteer type information.
- Fix approach: Add `tsconfig.json` with `strict: true`. Replace `page: any` with `import type { Page } from 'puppeteer-core'`. The `window as any` casts for Readability/Turndown are acceptable (runtime-injected scripts) but should use a declared `WindowWithReadability` interface.

**No linting, formatting, or CI pipeline**
- Issue: No `.eslintrc`, `biome.json`, `.prettierrc`, or `.github/workflows/` directory. No automated quality checks of any kind.
- Files: Project root (all missing)
- Impact: Code style is enforced only by agent convention. Human contributors have no guardrails. No automated verification that configs are valid JSON, that markdown frontmatter parses correctly, or that scripts compile.
- Fix approach: Add `biome.json` for linting/formatting. Add a minimal GitHub Actions workflow that: (1) validates all JSON in `configs/`, (2) runs `python scripts/generate-docs.py` and checks exit code, (3) runs `bun build scripts/browser-tools.ts` to verify compilation.

**package.json is minimal — no scripts, no metadata**
- Issue: `package.json` has only `dependencies`. No `name`, `version`, `scripts`, `type`, or `engines` fields.
- Files: `package.json`
- Impact: No `npm run` commands. No lockfile pinning strategy (bun.lock is gitignored). No declared Node.js version requirement. Makes onboarding harder.
- Fix approach: Add `"name"`, `"private": true`, `"type": "module"`, `"engines"`, and scripts for `build`, `check`, `lint`.

## Known Bugs

**`foundry-mcp.json` uses `${FOUNDRY_HOST}` in args but doesn't declare it in `env_vars`**
- Symptoms: If `FOUNDRY_HOST` is missing from `.env`, the sync push will inject the literal string `${FOUNDRY_HOST}` into the CLI config instead of a real URL. The `env_vars` validation (SYNC.md section 4) only checks `FOUNDRY_TOKEN`.
- Files: `configs/mcp/foundry-mcp.json` (line 5)
- Trigger: Run sync push without `FOUNDRY_HOST` in `.env`.
- Workaround: Manually ensure `FOUNDRY_HOST` is always set. But the validation step won't catch its absence.

**SYNC.md secret table is incomplete**
- Symptoms: `SYNC.md` section 4 ("Secret Variables") lists 4 vars: `TAVILY_API_KEY`, `CONTEXT7_API_KEY`, `CORP_BEDROCK_API_KEY`, `FOUNDRY_TOKEN`. But `.env.example` also has `FOUNDRY_HOST` and `CORP_BASE_URL`, which are used in `foundry-mcp.json` args and `opencode.json` settings respectively. The agent performing sync may not validate these.
- Files: `SYNC.md` (section 4), `.env.example`, `configs/mcp/foundry-mcp.json`, `configs/settings/opencode.json`
- Trigger: Agent follows SYNC.md literally and only validates the 4 documented vars.
- Workaround: None — requires updating SYNC.md.

## Security Considerations

**CDN-loaded scripts in browser-tools (supply chain risk)**
- Risk: `ensureReadability()` at line 830–846 injects scripts from `unpkg.com` into the browsed page at runtime: `@mozilla/readability@0.4.4`, `turndown@7.1.2`, `turndown-plugin-gfm@1.0.2`. If unpkg is compromised or a package is hijacked, arbitrary code runs in the browser context with full page access.
- Files: `scripts/browser-tools.ts` (lines 830–846)
- Current mitigation: Version-pinned URLs (not `@latest`). Best-effort error handling.
- Recommendations: (1) Bundle these libraries locally instead of CDN-loading. (2) Add Subresource Integrity (SRI) hashes if CDN loading is kept. (3) Consider vendoring into `scripts/vendor/`.

**Shell injection surface in browser-tools**
- Risk: `execSync` is called with string interpolation in several places: `mkdir -p "${profileDir}"` (line 79), `rsync -a --delete "${source}" "${profileDir}/"` (line 82). While `profileDir` comes from a CLI option with a default, a malicious value could inject shell commands.
- Files: `scripts/browser-tools.ts` (lines 79, 82)
- Current mitigation: Default value is hardcoded. Only used interactively by agents/humans, not as a service.
- Recommendations: Use `execFileSync` with argument arrays instead of `execSync` with string interpolation.

**`committer --force` deletes git lock files**
- Risk: The `--force` flag on the `committer` script (lines 92–104) will delete `.git/index.lock` if a commit fails due to a stale lock. This is generally safe but could corrupt an in-progress git operation if another process legitimately holds the lock.
- Files: `scripts/committer` (lines 92–104)
- Current mitigation: Flag must be explicitly passed. Lock path is parsed from the git error message (not blindly guessed).
- Recommendations: Add a staleness check (e.g., lock file age > 30s) before deleting.

**`killall 'Google Chrome'` is overly broad**
- Risk: The `start --kill-existing` option (line 73) kills ALL Chrome processes, not just the one with the debugging port. This could terminate user Chrome sessions with unsaved work.
- Files: `scripts/browser-tools.ts` (line 73)
- Current mitigation: `--kill-existing` is opt-in (default: false).
- Recommendations: Use `process.kill()` targeting only PIDs that have `--remote-debugging-port` (use the existing `listDevtoolsChromes()` function instead of `killall`).

## Performance Bottlenecks

**AGENTS.md injected into every session across all 4 CLIs**
- Problem: AGENTS.md (264 lines) is concatenated with CLI addendums and injected as system instructions. With the sync learnings section, this is ~500+ tokens of operational history consuming context window in every session.
- Files: `AGENTS.md`, `configs/instructions/*.md`
- Cause: The "Agent Config Sync — Learnings" section (65 lines) is historical, not prescriptive.
- Improvement path: Move historical content to `docs/`. Keep AGENTS.md lean with only rules and conventions.

**Sync is fully agent-driven with no programmatic shortcuts**
- Problem: Every sync operation requires the agent to read SYNC.md (777 lines), read all canonical sources, compute diffs mentally, and transform formats. This is expensive in tokens and time.
- Files: `SYNC.md`, `configs/commands/zz-sync-agent-configs.md`
- Cause: Design decision to use "agent as sync engine" (documented in `docs/overview.md`).
- Improvement path: Not necessarily a bug — it's a deliberate tradeoff (no code to maintain). But consider a lightweight validation script that checks JSON validity and env var presence without needing the full agent workflow.

## Fragile Areas

**SYNC.md is the entire sync contract — no tests, no validation**
- Files: `SYNC.md`
- Why fragile: The 777-line playbook is the only specification for how configs are transformed and synced. If a section is ambiguous or contradictory, the agent may produce incorrect output. There's no way to verify the agent interpreted the spec correctly except manual inspection.
- Safe modification: Change one section at a time. Run `/zz-sync-agent-configs check` after each change to verify the agent still produces correct diffs.
- Test coverage: Zero. No tests exist anywhere in this repo.

**MCP config format transformations across 4 CLIs**
- Files: `configs/mcp/*.json`, `SYNC.md` (sections 2.5, 3)
- Why fragile: Each MCP server definition must be correctly transformed into 4 different formats (Claude JSON, OpenCode JSON, Gemini JSON, Codex TOML). A single format mistake breaks MCP connectivity for that CLI. The `disabled_for` filtering and Codex HTTP-only rule add conditional logic.
- Safe modification: After changing any MCP definition, run sync check against all 4 CLIs.
- Test coverage: Zero.

**Secret injection/redaction boundary**
- Files: `.env`, `SYNC.md` (section 4), all `configs/mcp/*.json`, `configs/settings/opencode.json`
- Why fragile: Push replaces `${VAR}` with real values. Pull replaces real values back to `${VAR}`. The `FOUNDRY_TOKEN` alias (`FOUNDRY_TOKEN` in `.env` → `FOUNDRY_TOKEN` in config) must be handled correctly. If the agent misapplies the alias, secrets leak into the repo or configs break.
- Safe modification: Always verify with `git diff` after a pull that no real secrets appear in committed files.
- Test coverage: Zero.

## Scaling Limits

**Number of CLIs**
- Current capacity: 4 CLIs (Claude, OpenCode, Gemini, Codex)
- Limit: Adding a 5th CLI requires updating SYNC.md with new format specs, adding a new instructions file, and updating the sync command. Each CLI adds ~100 lines to SYNC.md.
- Scaling path: The current approach scales linearly but acceptably for small numbers of CLIs. Beyond ~6, consider a template engine.

**Number of MCP servers**
- Current capacity: 7 MCP servers
- Limit: Each server definition must be manually transformed per CLI. Agent token consumption grows linearly with server count.
- Scaling path: Fine for current scale. A validation script would help catch errors as count grows.

## Dependencies at Risk

**puppeteer-core (^24.37.3)**
- Risk: Major version bumps may break the CDP protocol interactions in `browser-tools.ts`. The `page.target().createCDPSession()` API and `Page.captureScreenshot` CDP call are Chrome-version-sensitive.
- Impact: `screenshot`, `content`, and `search` commands break.
- Migration plan: Pin to exact version. Test after Chrome updates.

**unpkg.com CDN availability**
- Risk: `browser-tools.ts` depends on unpkg.com being accessible at runtime for `content` and `search --content` commands. Corporate proxies, network outages, or unpkg deprecation break these features.
- Impact: `extractReadableContent()` silently falls back to raw `textContent`, losing markdown formatting.
- Migration plan: Bundle Readability + Turndown locally.

## Missing Critical Features

**Zero test coverage**
- Problem: No test files exist in the entire repository. No test framework configured. No test scripts in `package.json`.
- Blocks: Cannot verify that `scripts/generate-docs.py` correctly parses frontmatter, that `scripts/committer` handles edge cases, or that JSON configs are valid.
- Priority: High for `generate-docs.py` (parses YAML-like frontmatter with a hand-rolled parser that could silently misparse). Medium for `committer`. Low for `browser-tools.ts` (interactive tool, hard to unit test).

**No JSON schema validation for MCP configs**
- Problem: The 7 MCP config files in `configs/mcp/` have no schema validation. A typo (`"transprot"` instead of `"transport"`) would silently pass through sync and break MCP connectivity.
- Blocks: Silent config errors that only surface when an agent tries to use the MCP server.

**No automated drift detection**
- Problem: Drift between canonical configs and CLI system files is only detected when a human runs `/zz-sync-agent-configs check`. There's no scheduled check, pre-commit hook, or CI step.
- Blocks: Configs can drift silently for days/weeks.

## Test Coverage Gaps

**scripts/generate-docs.py — hand-rolled YAML parser**
- What's not tested: The `parse_doc_frontmatter()` function (lines 12–60) implements a custom YAML-subset parser that handles `summary:`, `read_when:`, inline arrays, and multi-line lists. Edge cases like quoted colons in values, multi-line summary strings, or nested YAML would silently misparse.
- Files: `scripts/generate-docs.py`
- Risk: A doc with unusual frontmatter could pass without error but produce wrong catalog output. The `generate-docs.py` script is part of the release checklist (`docs/RELEASING.md`).
- Priority: High — this is a validation gate with no validation of its own.

**scripts/committer — git edge cases**
- What's not tested: Lock file detection/removal, deletion staging (lines 69–79), glob-disabled behavior, empty-message rejection.
- Files: `scripts/committer`
- Risk: Medium — the script is used constantly by agents. A regression in deletion handling could cause silent data loss.
- Priority: Medium.

**MCP config correctness**
- What's not tested: Whether all 7 MCP JSON files parse correctly, have required fields, and reference valid env vars.
- Files: `configs/mcp/*.json`
- Risk: A broken MCP config disables an MCP server for one or more CLIs. Only discovered when an agent tries to use that server.
- Priority: High — easy to implement (JSON parse + field check).

---

*Concerns audit: 2026-02-19*
