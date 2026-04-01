# Tools

CLI tools on `$PATH`. Sources: `~/Repos/zacczakk/metronome/scripts/` and `~/Repos/zacczakk/metronome/bin/mcp-cli/`.

## metronome

Agent Config Sync CLI. Canonical configs sync to AI CLI targets (`claude`, `opencode`, `gemini`, `codex`).

- **Source:** `~/Repos/zacczakk/metronome/src/cli/`
- **Canonical configs:** `~/Repos/zacczakk/metronome/configs/` (commands, agents, mcp, instructions, skills, settings, plugins)
- **Installed via:** `bun link` (available on PATH as `metronome`)

### Subcommands

| Command | Purpose |
|---------|---------|
| `metronome check` | Drift detection (read-only). Exit 0=clean, 2=drift. |
| `metronome push` | Render canonical and write to targets. Atomic writes + backup/rollback. |
| `metronome pull` | Reverse-sync from target back to canonical. |
| `metronome diff` | Unified text diff of all drift. |
| `metronome render` | Render single item to target format (debug). |
| `metronome helpers` | Copy helper scripts to a target repo's `scripts/`. |

### Common flags
- `-t, --target <name>` — Scope to target (repeatable): `claude`, `opencode`, `gemini`, `codex`
- `--type <name>` — Scope to config type (repeatable): `commands`, `agents`, `mcps`, `instructions`, `skills`, `settings`, `plugins`
- `--pretty` / `--json` — Output format
- `--dry-run` — Preview without writing (push/pull)
- `--force` — Skip confirmation (push) or overwrite existing (pull)
- `--delete` — Skip delete confirmation (push only)
- `-s, --source <target>` — Required for pull: `all`, `claude`, `opencode`, `gemini`, `codex`
- `--name <name>` + `--type <type>` — Required for render

### Quick ref
```bash
metronome check --json                       # What's drifted?
metronome diff                               # Detailed changes
metronome push --force --delete              # Sync everything
metronome push -t opencode --type commands   # Narrow scope
metronome pull -s claude --dry-run           # Preview reverse sync
metronome render --type command --name gate  # Debug single item
metronome helpers -p ~/Repos/my-project      # Copy helpers to repo
metronome helpers -p . --force               # Overwrite without prompt
```

## committer

Safe git commit helper. Stages only listed paths — never `git add .`.

- **Source:** `~/Repos/zacczakk/metronome/scripts/committer`
- **Usage:** `committer "commit message" file1 file2 ...`

```bash
committer "fix: update config" src/app.ts README.md
committer "feat(08-01): add TOOLS.md" configs/instructions/TOOLS.md
```

## ask-model

Cross-model consultation. Query Claude (Anthropic), Codex (OpenAI), or Gemini (Google) non-interactively from any agent session. Supports blocking and async modes with timeout protection.

- **Source:** `~/Repos/zacczakk/metronome/scripts/ask-model`
- **Usage:** `ask-model [flags] <claude|codex|gemini> "your question"`
- **Output:** Model answer to stdout (blocking) or to file (async).

### Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `--async` | off | Run in background; requires `--output` |
| `--output, -o FILE` | — | Write answer to file |
| `--model, -m NAME` | engine default | Override model (e.g. `opus`, `gpt-5.3-codex`, `gemini-3.1-pro-preview`) |
| `--timeout SECS` | 120 | Max wait; env `ASK_MODEL_TIMEOUT` also works |

### Engines

| Engine | CLI | Auth | Notes |
|--------|-----|------|-------|
| `claude` | `claude -p` | `ANTHROPIC_API_KEY` (env var is set) | `--no-session-persistence` applied automatically. Cleanest output. |
| `codex` | `codex exec` | ChatGPT login | `--ephemeral --skip-git-repo-check` applied automatically |
| `gemini` | `gemini -p` | Google OAuth | AI Pro subscription |

### Examples
```bash
# Blocking (default) — answer printed to stdout
ask-model claude "what is the idiomatic way to handle errors in Go?"
ask-model codex "review this approach to caching: LRU with TTL expiry"
ask-model gemini "compare WAL vs rollback journal in SQLite"

# Specific model
ask-model -m opus claude "deep architectural review of this approach"
ask-model -m gpt-5.3-codex codex "explain coroutines vs goroutines"
ask-model -m gemini-3.1-pro-preview gemini "compare WAL vs rollback journal in SQLite"

# Capture output in a variable (agent use)
answer=$(ask-model claude "explain the tradeoffs of WAL mode in SQLite")

# Async — returns PID, writes answer to file when done
pid=$(ask-model --async -o /tmp/answer.txt gemini "long analysis question")
# ... do other work ...
wait "$pid" && cat /tmp/answer.txt

# Custom timeout
ask-model --timeout 60 codex "quick question"
```

### Direct CLI usage (without wrapper)
```bash
# Claude non-interactive (model: opus)
claude -p --no-session-persistence --model opus "your question"

# Codex non-interactive (model: gpt-5.3-codex)
codex exec --ephemeral --skip-git-repo-check --model gpt-5.3-codex "your question"

# Gemini non-interactive (model: gemini-3.1-pro-preview)
gemini -m gemini-3.1-pro-preview -p "your question"

# Gemini JSON output
gemini -p "your question" --output-format json
```

## trash

macOS system command to delete file. Required for safe deletes. Never is `rm`.

```bash
trash path/to/file
trash path/to/directory
```

## docs-list

Lists `docs/` catalog and enforces front-matter compliance.

- **Source:** `~/Repos/zacczakk/metronome/scripts/docs-list.ts`
- **Usage:** `docs-list` (or `bun scripts/docs-list.ts`)
- **Rebuild:** `bun build scripts/docs-list.ts --compile --outfile bin/docs-list`
- **Run:** After adding/modifying docs; honors `read_when` hints in front-matter.

## agent-browser

Browser automation CLI. Auto-connects to running Chrome (SSO, cookies, extensions preserved). Rust/CDP.

- **Install:** `npm --prefix /opt/homebrew install -g agent-browser@latest`
- **Skill:** `load_agent_browser_skill`
- **Env vars (pre-set):** `NATIVE=1` (Rust/CDP engine, bypasses Node.js/Playwright), `AUTO_CONNECT=1` (attaches to running Chrome, not a fresh Chromium)
- **Fallback:** If Chrome not running, launches own headless Chromium (no SSO).

```bash
agent-browser open <url>              # Navigate (in user's Chrome)
agent-browser snapshot -i             # Interactive elements with @refs
agent-browser click @e2               # Click by ref
agent-browser fill @e3 "text"         # Fill input
agent-browser get text @e1            # Extract text
agent-browser screenshot              # Capture viewport
agent-browser tab                     # List open tabs
agent-browser close                   # Close current tab when done
```

**Tab cleanup:** close what you opened; never close tabs you didn't open.
**Never kill, restart, or relaunch Chrome.** User's personal tabs must survive agent sessions.

| Task | Tool |
|---|---|
| Browse, click, fill, interact | `agent-browser` (auto-connects to Chrome) |
| Authenticated pages (SSO/cookies) | `agent-browser` (inherits Chrome session) |
| Safari/WebKit testing | `agent-browser --native` (WebDriver) |
| Debug running Chrome | `chrome-devtools-mcp` (MCP, 29 tools) |
| Complex test suites w/ assertions | `webapp-testing` skill (Python Playwright) |

## gh

GitHub CLI for PRs, issues, CI, and releases.

- Given a GitHub URL or `/pull/N`: use `gh`, not web search.
- Prefer `gh pr view/diff` over URL fetching.

```bash
gh issue view <url> --comments -R owner/repo
gh pr view <url> --comments --files -R owner/repo
gh pr create --title "title" --body "body"
gh run list --limit 5
gh run view <id>
```

## tmux

Terminal multiplexer. Use only for persistence/interaction (debugger, server).

```bash
tmux new -d -s codex-shell        # Create detached session
tmux attach -t codex-shell        # Attach to session
tmux list-sessions                # List active sessions
tmux kill-session -t codex-shell  # Kill session
```

## mcporter

MCP client/CLI. All canonical servers registered in `~/.mcporter/mcporter.json`.

- **Config:** `~/.mcporter/mcporter.json` (system-level, no imports)
- **Binaries:** `bin/` on PATH (Bun-compiled standalone CLIs per server)
- **Daemon:** chrome-devtools has `lifecycle: keep-alive`; auto-starts on first call.

### Access methods (fastest first)

| Method | When | Speed |
|---|---|---|
| `<name> <tool> --flag val` | Standalone binary on PATH, baked-in schemas | Fastest (~0.3s discovery) |
| `mcporter call <server>.<tool>` | Ad-hoc calls from any agent | ~800ms overhead vs binary |
| `mcporter config list` | List registered servers (no connection) | 77ms |
| `mcporter list <server>` | Tool signatures for one server | 2-3s (connects) |

**Never run bare `mcporter list`** — connects to all servers including editor imports. Slow.

### Quick ref
```bash
# Discovery (fast, no connections)
mcporter config list

# Tool signatures (single server)
mcporter list <server>

# Call via standalone binary (fastest, --flag syntax, on PATH)
context7 resolve-library-id --query "react hooks" --library-name react

# Call via mcporter (ad-hoc, key=value syntax)
mcporter call context7.resolve-library-id query="react hooks" libraryName=react

# Call with JSON output (always valid JSON)
mcporter call context7.resolve-library-id --output json query="react hooks" libraryName=react

# Keep string args literal (no numeric coercion)
mcporter call palantir-mcp.some-tool --raw-strings id="00123"
# Or disable all coercion
mcporter call palantir-mcp.some-tool --no-coerce id="00123"

# Daemon (chrome-devtools)
mcporter daemon status
mcporter daemon stop
```

### Servers

| Server | Transport | Binary (on PATH) | Notes |
|---|---|---|---|
| `context7` | HTTP | `context7` | Library docs |
| `tavily` | stdio | `tavily` | Web search (`TAVILY_API_KEY`) |
| `chrome-devtools` | stdio/daemon | `chrome-devtools` | Daemon keep-alive; `--autoConnect --no-usage-statistics` |
| `palantir-mcp` | stdio | `palantir` | Foundry (`FOUNDRY_TOKEN`) |
| `shadcn` | stdio | `shadcn` | shadcn/ui |
| `sequential-thinking` | stdio | `sequential-thinking` | Reasoning |

## obsidian

CLI for Obsidian vault operations. **Required for all vault reads/writes** — no raw file I/O.

- **Vaults:** `Knowledge` (personal notes, projects, docs) and `Memory` (agent operational memory).
- **Location:** `~/Vaults/` (symlinks to iCloud vaults).
- **Rule:** Specify vault in every call: `vault=Knowledge` or `vault=Memory`.
- **Full guide:** `~/Vaults/AGENTS.md`

### Subcommands

| Command | Purpose |
|---------|---------|
| `obsidian vault=V files [folder=F]` | List files (optionally scoped to folder) |
| `obsidian vault=V read path="..."` | Read note content |
| `obsidian vault=V search query="..."` | Search vault |
| `obsidian vault=V search:context query="..."` | Search with surrounding context |
| `obsidian vault=V create path="..." content="..."` | Create note |
| `obsidian vault=V append path="..." content="..."` | Append to note |
| `obsidian vault=V move path="..." to="folder"` | Move note (Knowledge only) |
| `obsidian vault=V delete path="..."` | Delete note |
| `obsidian vault=V task path="..." line=N done` | Mark task complete (Knowledge only) |
| `obsidian vault=V tasks [todo] [path="..."]` | List tasks (Knowledge only) |

### Quick ref
```bash
# Knowledge vault
obsidian vault=Knowledge files folder=01_inbox
obsidian vault=Knowledge read path="02_backlog/note.md"
obsidian vault=Knowledge search query="term"
obsidian vault=Knowledge create path="02_backlog/item.md" content="..."
obsidian vault=Knowledge task path="02_backlog/item.md" line=3 done
obsidian vault=Knowledge move path="03_active/project.md" to="04_archive"

# Memory vault
obsidian vault=Memory files
obsidian vault=Memory search:context query="topic"
obsidian vault=Memory create path="descriptive-name.md" content="..."
```

## qmd

Local hybrid search over indexed markdown collections. Runs entirely on-device (Metal GPU). Installed via npm (`npm i -g @tobilu/qmd`) — **not bun** (Bun's SQLite lacks extension loading for sqlite-vec).

- **Index:** `~/.cache/qmd/index.sqlite`
- **Collections:** `memory` → `~/Vaults/Memory/**/*.md`, `sessions` → exported session files
- **Models:** embedding (embeddinggemma-300M), reranking (Qwen3-0.6B), query expansion (1.7B) — all local GGUF.

### Key commands

| Command | Purpose |
|---------|---------|
| `qmd query "..."` | Hybrid search w/ query expansion + reranking (best quality) |
| `qmd search "..."` | BM25 keyword search (fast, no LLM) |
| `qmd vsearch "..."` | Vector similarity search (no reranking) |
| `qmd query "..." -c memory` | Scope to memory collection |
| `qmd query "..." --full` | Return full documents instead of snippets |
| `qmd query "..." --files` | Return file paths + scores only |
| `qmd get qmd://memory/path/to/file.md` | Read a specific indexed document |
| `qmd multi-get "pattern"` | Batch fetch via glob or comma-separated list |
| `qmd ls memory` | List files in collection |
| `qmd update` | Re-index all collections |
| `qmd embed` | Rebuild vector embeddings |
| `qmd context add qmd://memory/ "..."` | Attach human-written summary to a collection/path |
| `qmd status` | Index + collection health |
| `qmd cleanup` | Clear caches, vacuum DB |

### Search flags

| Flag | Purpose |
|------|---------|
| `-n <num>` | Number of results (default: 5) |
| `--all` | Return all matches (pair with `--min-score`) |
| `--full` | Full document content |
| `--files` | File paths + scores (default: 20 results) |
| `--json` / `--md` / `--xml` / `--csv` | Output format |
| `-c <name>` | Filter to collection |
| `--min-score <num>` | Minimum similarity threshold |
| `--line-numbers` | Add line numbers to output |
| `-C <n>` | Max candidates to rerank (default: 40, lower = faster) |
| `--explain` | Include retrieval score traces |

### Structured query syntax (v2.0)

Single-line queries auto-expand. For control, use typed lines:
```bash
# Auto-expand (default — recommended for most queries)
qmd query "how does auth work" -c memory

# Typed query document (explicit control over search strategy)
qmd query $'lex: CAP theorem\nvec: consistency' -c memory

# Hyde-only (hypothetical document embedding)
qmd query $'hyde: The auth system uses JWT tokens stored in...' -c memory
```

### Quick ref
```bash
# Semantic search (recommended — uses query expansion + reranking)
qmd query "claude code adapter settings" -c memory

# Keyword search (fast, no GPU)
qmd search "collapseHomePaths" -c memory

# Full document retrieval
qmd query "metronome pull" --full -c memory

# File paths only (good for discovery)
qmd query "mcp transport" --files -c memory

# Read specific file from index
qmd get qmd://memory/projects/metronome-claude-code-adapter-fixes.md

# Batch fetch multiple files
qmd multi-get "qmd://memory/tools/*"

# Re-index after adding new notes
qmd update && qmd embed
```

### When to use qmd vs obsidian search

| Use case | Tool |
|----------|------|
| Semantic/fuzzy recall ("things related to X") | `qmd query` |
| Exact keyword match in vault | `obsidian vault=Memory search query="..."` |
| Read/write/create notes | `obsidian` CLI |
| Discovery before deep read | `qmd query --files` then `obsidian read` |

## sessions

Search, browse, and export coding session history from OpenCode and Claude Code. Three-layer search: Memory vault (curated notes) → FTS5 (keyword precision) → qmd (semantic recall).

- **Source:** `~/Repos/zacczakk/metronome/scripts/sessions`
- **Vault:** `~/Vaults/Sessions/` (iCloud-backed symlink, Obsidian-visible)
- **Sources:** OpenCode (`~/.local/share/opencode/opencode.db`), Claude Code (`~/.claude/projects/`)
- **Indexes:** FTS5 DB + export state at `~/.local/share/sessions/` (machine-local)
- **qmd collection:** `sessions` (2,172 files, semantic + BM25)

### Subcommands

| Command | Purpose | Needs export? |
|---------|---------|:---:|
| `sessions list` | List sessions (newest first) | No — queries source DBs live |
| `sessions read <session_id>` | Read full session transcript | No — queries source DBs live |
| `sessions stats` | Session counts, message/part totals, index size | No |
| `sessions export` | Incremental export to vault (markdown + frontmatter) | — |
| `sessions search "query"` | FTS5 keyword search with Porter stemming | Yes |
| `sessions find "query"` | Semantic search via qmd (query expansion + reranking) | Yes |
| `sessions index` | Rebuild qmd collection (re-register + embed) | Yes |

### Flags

| Flag | Commands | Purpose |
|------|----------|---------|
| `--source opencode\|claude` | list, export, search | Filter by source |
| `--since YYYY-MM-DD` | list, export | Date filter |
| `--limit N` | list, search, find | Max results |
| `--project NAME` | list | Filter by project name |
| `--role user\|assistant` | search, read | Filter by message role |
| `--context N` | search | Context lines around matches |
| `--keyword` | find | Use BM25 instead of semantic |
| `--force` | export | Re-export all (ignore watermark) |
| `--no-index` | export | Skip qmd re-indexing after export |
| `--no-embed` | index | Skip embedding generation |
| `--no-tools` | read | Hide tool call blocks |

### Search strategy

1. **Memory vault first** — curated notes (`qmd query "..." -c memory`)
2. **sessions search** — keyword precision with FTS5 Porter stemming
3. **sessions find** — semantic recall via qmd reranking (slower, fuzzier)

### Quick ref
```bash
# Recent sessions
sessions list --limit 10
sessions list --source opencode --project metronome

# Keyword search (fast, precise)
sessions search "iCloud migration"
sessions search "TypeScript adapter" --source opencode --limit 5

# Semantic search (fuzzy recall)
sessions find "how did we handle plugin sync"
sessions find "error handling pattern" --keyword  # BM25 fallback

# Read specific session
sessions read ses_3190fbc8bffeVmNFzrofY3bdMd

# Export new sessions + rebuild index
sessions export
sessions export --force --source claude

# Stats
sessions stats
```

### When to use sessions vs qmd vs obsidian

| Use case | Tool |
|----------|------|
| Curated knowledge/patterns | `qmd query -c memory` or `obsidian vault=Memory search` |
| "Did we do X before?" / past session recall | `sessions search` or `sessions find` |
| Full session transcript | `sessions read <id>` |
| Broad semantic discovery across sessions | `sessions find` |
| Exact keyword in session history | `sessions search` |

## bird

Twitter/X CLI for posting, replying, reading tweets.

- **Location:** `~/Projects/bird/bird`

### Commands

```bash
bird tweet "<text>"                    # Post a tweet
bird reply <tweet-id-or-url> "<text>"  # Reply to a tweet
bird read <tweet-id-or-url>            # Fetch tweet content
bird replies <tweet-id-or-url>         # List replies to a tweet
bird thread <tweet-id-or-url>          # Show full conversation thread
bird search "<query>" [-n count]       # Search tweets
bird mentions [-n count]               # Find tweets mentioning @clawdbot
bird whoami                            # Show logged-in account
bird check                             # Show credential sources
```

## rtk

Token compression proxy. Intercepts bash commands and compresses output before it reaches the LLM context window. 60–90% token reduction on git, build, test, and search output. <10ms overhead.

- **Install:** `brew install rtk`
- **Config:** `~/Library/Application Support/rtk/config.toml` (macOS)
- **Telemetry:** Disabled via config.toml (`[telemetry] enabled = false`).
- **Hook (Claude Code):** `~/.claude/hooks/rtk-rewrite.sh` — PreToolUse hook rewrites `git status` → `rtk git status` transparently. Owned by `rtk init`, registered by metronome.
- **Hook (OpenCode):** `configs/plugins/rtk.ts` — plugin deployed by `metronome push`.
- **Limitation:** Only intercepts bash tool calls. Native Read/Grep/Glob tools are not compressed.

### Commands

| Command | Purpose |
|---------|---------|
| `rtk gain` | Show token savings summary |
| `rtk gain --history` | Historical savings |
| `rtk graph` | Visual savings graph |
| `rtk discover` | Find commands not yet compressed |
| `rtk init --show` | Show current hook configuration |
| `rtk rewrite "<cmd>"` | Test rewrite logic for a command |

### Config tuning

```toml
# ~/Library/Application Support/rtk/config.toml (macOS)
[hooks]
exclude_commands = ["some-command"]  # Skip rewriting for specific commands
```

### Rewritten command families

git, gh, cargo, go, npm, pnpm, bun, pytest, ruff, mypy, pip, uv, tsc, eslint, prettier, playwright, prisma, docker, kubectl, curl, cat, rg, grep, ls, tree, find, diff, head, aws, psql.

## coderabbit

AI code review CLI. Reviews diffs (committed, uncommitted, or both) and returns line-level findings. Free tier: 3 reviews/hr.

- **Install:** `brew install coderabbit` (or `curl -fsSL https://cli.coderabbit.ai/install.sh | sh`)
- **Alias:** `cr` (short for `coderabbit`)
- **Auth:** `cr auth login` (OAuth via GitHub). Status: `cr auth status`.
- **Version:** 0.4.0
- **Context flag:** Always pass `-c ~/Repos/zacczakk/metronome/configs/instructions/AGENTS.md` so the reviewer knows project conventions.
- **Scope:** Diff-based only (committed, uncommitted, or both). No full-repo scan mode.

### Subcommands

| Command | Purpose |
|---------|---------|
| `cr review` | Run code review (default subcommand) |
| `cr auth login` | Authenticate via OAuth |
| `cr auth status` | Show auth status |
| `cr auth org` | Switch organization |
| `cr update` | Update CLI to latest |

### Review flags

| Flag | Purpose |
|------|---------|
| `-t, --type <type>` | Scope: `all` (default), `committed`, `uncommitted` |
| `-c, --config <files...>` | Pass instruction files (AGENTS.md, coderabbit.yaml, etc.) |
| `--base <branch>` | Base branch for comparison (default: current branch default) |
| `--base-commit <commit>` | Base commit on current branch |
| `--agent` | Structured JSONL output for agent consumption (preferred for agents) |
| `--prompt-only` | Minimal plain text optimized for AI agents |
| `--plain` | Detailed plain text output (non-interactive) |
| `--interactive` | Full TUI with browsable findings |
| `--cwd <path>` | Working directory (must be git repo) |
| `--no-color` | Disable colored output |
| `--api-key <key>` | Override auth with agentic API key |

### Agent usage pattern

```bash
# Standard agent review (structured JSONL, always pass -c)
cr --agent -c ~/Repos/zacczakk/metronome/configs/instructions/AGENTS.md

# Uncommitted changes only
cr --agent -t uncommitted -c ~/Repos/zacczakk/metronome/configs/instructions/AGENTS.md

# Branch diff against main
cr --agent --base main -c ~/Repos/zacczakk/metronome/configs/instructions/AGENTS.md

# Plain text variant (human-readable)
cr --plain -c ~/Repos/zacczakk/metronome/configs/instructions/AGENTS.md
```

### Review loop pattern

1. Implement changes
2. `cr --agent -c ~/Repos/zacczakk/metronome/configs/instructions/AGENTS.md` — get findings
3. Fix critical issues (skip nits unless asked)
4. Re-run once to verify — if clean, done
5. Max 2 iterations unless user says otherwise

## MCP Servers

Canonical definitions in `configs/mcp/*.json`. Rendered to each CLI via `metronome push`.
All servers also registered in `~/.mcporter/mcporter.json` and compiled to `bin/` (on PATH).

| Server | Native MCP | Binary (on PATH) | Notes |
|--------|-----------|------------------|-------|
| `context7` | All CLIs | `context7` | HTTP; library docs |
| `tavily` | Claude, OpenCode, Gemini | `tavily` | `TAVILY_API_KEY` |
| `chrome-devtools` | All CLIs | `chrome-devtools` | Daemon keep-alive; `--autoConnect --no-usage-statistics` |
| `palantir-mcp` | — | `palantir` | `FOUNDRY_TOKEN` |
| `shadcn` | OpenCode | `shadcn` | shadcn/ui |
| `sequential-thinking` | — | `sequential-thinking` | Reasoning; native MCP disabled |

