# Architecture

**Analysis Date:** 2026-02-19

## Pattern Overview

**Overall:** Document-driven configuration management with agent-as-engine execution

This repo has no runtime application or sync engine. It stores canonical AI coding assistant configurations and uses a structured playbook (`SYNC.md`) that AI agents read and execute interactively. The "architecture" is a content management system where the AI agent itself is the build tool.

**Key Characteristics:**
- No build step, no sync engine, no compiled output
- Canonical source → playbook → agent reads playbook → agent transforms and writes to system dirs
- All four target CLIs (Claude Code, OpenCode, Gemini CLI, Codex) consume the same canonical sources rendered into CLI-specific formats
- Secrets injected at push boundary, redacted at pull boundary
- Every write requires interactive user confirmation

## Layers

**Ground Truth Layer:**
- Purpose: Define agent behavior rules and operating constraints
- Location: `AGENTS.md`
- Contains: Agent protocol, core principles, language/stack notes, git rules, permissions, tool catalog
- Depends on: Nothing
- Used by: All CLIs at runtime (prepended to instruction addendums), all commands and agents via `READ ~/Repos/acsync/AGENTS.md` directive

**Sync Playbook Layer:**
- Purpose: Document format transformations, merge rules, per-CLI quirks, secret management
- Location: `SYNC.md`
- Contains: System paths per CLI, format specs for commands/agents/skills/MCP/settings, subset merge rules, secret injection/redaction logic
- Depends on: Nothing (pure specification)
- Used by: `/zz-sync-agent-configs` command (the agent reads this as its authoritative reference)

**Canonical Source Layer:**
- Purpose: Single source of truth for all CLI artifacts
- Location: `configs/`
- Contains: Commands (`.md`), agents (`.md`), skills (directories), MCP definitions (`.json`), settings (`.json`), instruction addendums (`.md`)
- Depends on: Nothing
- Used by: Sync playbook transforms these into CLI-specific formats

**Helper Scripts Layer:**
- Purpose: Standalone tools shared across repos
- Location: `scripts/`
- Contains: `committer` (bash git helper), `generate-docs.py` (docs catalog), `browser-tools.ts` (Chrome DevTools CLI)
- Depends on: `commander`, `puppeteer-core` (browser-tools only)
- Used by: Agents at runtime, synced to other repos via `/zz-sync-agent-helpers`

**Documentation Layer:**
- Purpose: Operational docs, execution plans, design decisions, runbooks
- Location: `docs/`
- Contains: Architecture, overview, subagent model, tool catalog, release checklist, plans, runbooks
- Depends on: Nothing
- Used by: Agents (via front-matter `read_when` hints), humans

**Secrets Layer:**
- Purpose: Hold API keys and tokens outside version control
- Location: `.env` (gitignored)
- Contains: `TAVILY_API_KEY`, `CONTEXT7_API_KEY`, `CORP_BEDROCK_API_KEY`, `FOUNDRY_TOKEN`
- Depends on: Nothing
- Used by: Sync push (injection) and pull (redaction)

## Data Flow

**Push Flow (Repo → System):**

1. Agent reads `SYNC.md` (playbook)
2. Agent loads `.env` and validates all 4 secret vars
3. For each CLI (Claude, OpenCode, Gemini, Codex):
   a. Read canonical sources from `configs/`
   b. Transform to CLI-specific format per SYNC.md specs
   c. Inject secrets (replace `${VAR}` with real values)
   d. Expand `~` paths to absolute paths
   e. Diff against current system files
   f. Show diff → user confirms → backup → write

**Pull Flow (System → Repo):**

1. Agent reads system files from each CLI's directories
2. Reverse-transforms to canonical format
3. Redacts secrets (replace real values with `${VAR}` placeholders)
4. Collapses absolute paths to `~`
5. Diffs against canonical repo sources
6. Show diff → user confirms → write to repo

**Check Flow (Drift Detection):**

1. Render canonical → CLI format (same as push step 3)
2. Compare rendered output against system files
3. Report diffs per CLI per category (read-only, no writes)

**Instruction Concatenation Flow:**

1. Read `AGENTS.md` (ground truth)
2. Read CLI addendum from `configs/instructions/{cli}.md`
3. Concatenate with double newline separator
4. Write to CLI system instruction file (e.g., `~/.claude/CLAUDE.md`)

**State Management:**
- No runtime state — repo is stateless between sync operations
- Plan tracking via `docs/plans/STATE.md` (pointer to active plan)
- Decision log via `docs/plans/DECISIONS.md`
- Backups stored in `backups/<timestamp>/<cli>/` (gitignored)

## Key Abstractions

**Canonical Config:**
- Purpose: CLI-agnostic representation of a configuration artifact
- Examples: `configs/commands/zz-gate.md`, `configs/mcp/tavily.json`
- Pattern: YAML frontmatter + markdown body (commands/agents), JSON schema (MCP/settings)

**Format Transformation:**
- Purpose: Convert canonical format to CLI-specific format
- Examples: Markdown → TOML for Gemini commands, frontmatter `allowed-tools` → OpenCode `tools` map
- Pattern: Documented in SYNC.md sections 2.1–2.5; four distinct renderers (Claude, OpenCode, Gemini, Codex)

**Subset Merge:**
- Purpose: Modify only managed keys in a system config file, preserving user-owned keys
- Examples: Claude `~/.claude.json` manages only `mcpServers`; OpenCode manages `provider`, `plugin`, `permission`, `model`, `instructions`
- Pattern: Read → modify managed keys → write back; deep-merge for `permissions`/`permission`, wholesale replace for others

**Secret Placeholder:**
- Purpose: Keep secrets out of version control
- Examples: `${TAVILY_API_KEY}` in canonical, real value in system files
- Pattern: `${VAR}` in repo files, inject on push, redact on pull
- Exception: OpenCode `{env:VAR_NAME}` syntax is NOT a secret placeholder — it's a runtime reference, leave as-is

**Exclusion Rules:**
- Purpose: Protect GSD-managed and non-canonical files during sync
- Pattern: Skip files/dirs with `gsd-` prefix, `gsd/` dirs, `.sync-manifest.json`, `.gsd-file-manifest.json`, `.DS_Store`

## Entry Points

**`/zz-sync-agent-configs` (primary):**
- Location: `configs/commands/zz-sync-agent-configs.md`
- Triggers: User invokes slash command with `push`, `pull`, or `check` argument
- Responsibilities: Full config sync across all 4 CLIs; reads SYNC.md as authoritative reference

**`/zz-sync-agent-helpers`:**
- Location: `configs/commands/zz-sync-agent-helpers.md`
- Triggers: User invokes from another repo
- Responsibilities: Copy `committer`, `generate-docs.py`, `browser-tools.ts` to target repo's `scripts/`

**`scripts/generate-docs.py`:**
- Location: `scripts/generate-docs.py`
- Triggers: Manual run or `/groom-docs`
- Responsibilities: Walk `docs/`, parse YAML frontmatter, print catalog with summary + read_when hints

**`scripts/committer`:**
- Location: `scripts/committer`
- Triggers: Agent or human runs `committer "message" file1 file2 ...`
- Responsibilities: Safe git commit — unstages everything, stages only listed files, commits

**`scripts/browser-tools.ts` / `bin/browser-tools`:**
- Location: `scripts/browser-tools.ts` (source), `bin/browser-tools` (compiled, gitignored)
- Triggers: Agent runs CLI subcommands (`start`, `nav`, `eval`, `screenshot`, `pick`, `cookies`, `inspect`, `kill`)
- Responsibilities: Chrome DevTools protocol interaction via puppeteer-core

## Error Handling

**Strategy:** Fail-fast with clear messaging; validation before write

**Patterns:**
- Secret validation: Check all 4 env vars present and non-empty before any push operation
- File existence: `committer` verifies each file exists (or is a tracked deletion) before staging
- Playbook missing: Sync command stops immediately if `SYNC.md` not found
- MCP filtering: Silently skip stdio servers for Codex (HTTP-only); warn on disabled servers needed by skills

## Cross-Cutting Concerns

**Logging:** No structured logging — agents produce human-readable output during sync operations

**Validation:**
- Front-matter compliance enforced by `scripts/generate-docs.py`
- Secret presence validated before push
- Drift detection via `/zz-sync-agent-configs check`
- Docs quality scanned by `/groom-docs`

**Authentication:** Not applicable — secrets are API keys for third-party MCP servers, not auth for this repo

**Backup:** Pre-sync backups written to `backups/<timestamp>/<cli>/` before any system file modification

---

*Architecture analysis: 2026-02-19*
