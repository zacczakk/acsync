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

## markitdown

Local document/media -> markdown for agents. Good for PDF, DOCX, PPTX, XLSX, HTML, images, audio.

- **Install:** `uv tool install --python 3.12 'markitdown[all]'`
- **Use for:** local document inspection, ingestion prep, quick text extraction for agent context.
- **Avoid for:** high-fidelity publishing conversion; output optimized for LLM/text analysis.
- **Safety:** runs with current process privileges. Prefer local files you trust.

```bash
markitdown file.pdf > file.md
markitdown file.docx -o file.md
markitdown --list-plugins
```

## peekaboo

macOS desktop automation + MCP. Use for native apps, dialogs, menus, windows, screenshots, AX tree, input control.

- **Install:** `brew install steipete/tap/peekaboo`
- **MCP:** `peekaboo mcp`
- **Use for:** Obsidian, Finder, system dialogs, native app automation beyond browser.
- **Avoid for:** browser-only flows. Prefer `agent-browser` there.
- **Permissions:** Screen Recording + Accessibility required.

```bash
peekaboo --version
peekaboo permissions status
peekaboo list apps
peekaboo mcp
```

## agent-browser

Browser automation CLI. Auto-connects to Chrome. Rust/CDP.

- **Install:** `brew install agent-browser` or `npm install -g agent-browser`
- **Skill:** `load_agent_browser_skill`
- **Preset env:** `NATIVE=1`, `AUTO_CONNECT=1`
- **Fallback:** headless Chromium. No SSO.
- Reuse live sessions. Attach > restart.
- Skill says kill/reset? Ignore. Concrete failure only.
- Never stop/reset proactively. Chrome restart: one attach call, then `batch`.
- `chat` for intent tasks. `batch` for deterministic sequences.

```bash
agent-browser open <url>
agent-browser snapshot -i                        # interactive @refs
agent-browser click @e2
agent-browser fill @e3 "text"
agent-browser get text @e1
agent-browser screenshot
agent-browser screenshot --annotate              # labeled for vision models
agent-browser find role button click --name Submit
agent-browser keyboard type "text"               # no selector
agent-browser chat "do X"                        # AI single-shot (needs AI_GATEWAY_API_KEY)
agent-browser batch "open <url>" "snapshot -i"   # multi-step
agent-browser tab / close
agent-browser --session-name myapp open <url>    # persist state
agent-browser auth save my-app --url <url>
agent-browser auth login my-app
agent-browser profiles
agent-browser doctor [--fix]                     # diagnose/repair
```

Never close browser tabs. `agent-browser close` = session/connection only, not tabs. No access: run `agent-browser close`, tell user to grant Chrome access, wait for confirmation, then resume with ONE `agent-browser` call — no chaining. Never kill Chrome. Consent manual per restart. Viewport: `1800x1169` (Phil's logical resolution). Never use 1920x1080 — overflows screen.

**Daemon + Chrome attach pattern.** If daemon is already running when you call `open --headed`, the `--headed` flag is silently ignored and the daemon tries to attach to Chrome. If Chrome hasn't granted remote-debugging access yet, this triggers a permission prompt in Chrome. A second stale prompt may appear and be unresponsive — this is a known Chrome bug when the daemon reconnects mid-session. Fix: use `--auto-connect` instead of `--headed` when a daemon session already exists. `--auto-connect` skips the headed/daemon dance and attaches directly. Pattern:
```bash
# correct: daemon already running
agent-browser open <url> --auto-connect

# first launch only (no daemon)
agent-browser close; agent-browser open <url> --headed
```
If you hit 403 or the stale-prompt deadlock: `agent-browser close`, then reopen with `--headed` for a clean first-launch consent flow.

| Task | Tool |
|---|---|
| Browse/click/fill/extract | `agent-browser` |
| Intent-driven task | `agent-browser chat` |
| Multi-step sequence | `agent-browser batch` |
| SSO/authenticated pages | `agent-browser` (inherits Chrome session) |
| Safari/WebKit | `agent-browser --native` |
| Test suites w/ assertions | `webapp-testing` skill |
| Diagnose install | `agent-browser doctor` |

## curl.md

URL → markdown extractor for agents. Good fallback when WebFetch/Defuddle return clutter or fail.

- **Install CLI:** `npm i -g curl.md` or `bun i -g curl.md`
- **OpenCode plugin:** `opencode plugin -g @curl.md/opencode`
- **Auth:** optional. `/curl_md_login` in OpenCode or `curl.md auth login`; `CURLMD_API_KEY` for non-interactive use.
- **No install path:** `curl https://curl.md/<url>` works, rate-limited.
- **Use for:** public docs, articles, static pages.
- **Avoid for:** GitHub repos/README fetches; hosted eval returned upstream `404`. Use `gh`, raw URLs, or WebFetch instead.
- **Default:** fallback, not primary. Defuddle/WebFetch first unless they are noisy/broken.

```bash
curl https://curl.md/https://example.com/docs
curl.md https://example.com/docs
md https://example.com/docs
opencode plugin -g @curl.md/opencode
```

OpenCode plugin overrides built-in `webfetch` by default. Footgun. If installed globally, prefer explicit tool only:

```json
{
  "plugin": [
    ["@curl.md/opencode", { "webfetch": false }]
  ]
}
```

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

## az

Azure CLI for Azure resources and Azure DevOps workflows.

- Use for Azure-hosted infra inspection and Azure DevOps repos, PRs, pipelines, and releases.
- Start with `az account show` to confirm tenant/subscription context.
- Be explicit with `--organization`, `--project`, `--subscription`, and resource group flags when context is ambiguous.
- For GitHub-native repos, prefer `gh`. For Azure DevOps-native repos/pipelines, prefer `az`.

```bash
az account show
az group list
az resource list
az webapp list
az functionapp list
az repos list --organization <url> --project <name>
az repos show --repository <name> --organization <url> --project <name>
az repos pr list --organization <url> --project <name> --repository <name>
az repos pr show --id <pr-id> --organization <url> --project <name>
az pipelines list --organization <url> --project <name>
az pipelines runs list --organization <url> --project <name>
az pipelines runs show --id <run-id> --organization <url> --project <name>
```

## tmux

Terminal multiplexer. Use only for persistence/interaction (debugger, server).

```bash
tmux new -d -s codex-shell        # Create detached session
tmux attach -t codex-shell        # Attach to session
tmux list-sessions                # List active sessions
tmux kill-session -t codex-shell  # Kill session
```

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

### `rtk proxy` — unfiltered passthrough

Runs a command **without compression** but still tracks usage. Use when rtk's filter drops output you need (failure details, stack traces, verbose logs).

```bash
rtk proxy pytest tests/                     # Full pytest output, untruncated
rtk proxy pytest tests/ -v --tb=long        # Verbose + long tracebacks
rtk proxy -u pytest tests/                  # Ultra-compact ASCII icons
rtk proxy --skip-env pytest tests/          # Skip SKIP_ENV_VALIDATION injection
```

**Flags:**

| Flag | Purpose |
|------|---------|
| `-v` / `-vv` / `-vvv` | Verbosity (rtk-level, not the child command) |
| `-u, --ultra-compact` | ASCII icons + inline format (Level 2 compression) |
| `--skip-env` | Set `SKIP_ENV_VALIDATION=1` for child (useful for Next.js, tsc, lint) |

**When to use `rtk proxy` vs `rtk pytest`:**
- `rtk pytest` — compressed summary; good for CI / green runs
- `rtk proxy pytest` — full raw output; use when failures are truncated or details are missing

### `rtk pytest` — compressed test runner

```bash
rtk pytest tests/                      # Failures + summary only
rtk pytest tests/ -v                   # With test names
rtk pytest tests/foo.py::test_bar      # Single test
```

### Config tuning

```toml
# ~/Library/Application Support/rtk/config.toml (macOS)
[hooks]
exclude_commands = ["curl"]  # Skip rewriting — curl passes through raw
```

### Rewritten command families

git, gh, cargo, go, npm, pnpm, bun, pytest, ruff, mypy, pip, uv, tsc, eslint, prettier, playwright, prisma, docker, kubectl, curl, cat, rg, grep, ls, tree, find, diff, head, aws, psql.

## Supply Chain Defense

Baseline hygiene against freshly-published malicious packages (e.g. March 2026 axios compromise). All three layers are configured globally.

### Bun — `~/.bunfig.toml`

```toml
[install]
minimumReleaseAge = 604800   # 7 days in seconds
```

- Applies to `bun install`, `bun add`, `bun remove`. Does **not** affect `bun run` or `--frozen-lockfile` CI.
- Global config merged with local `./bunfig.toml` (local overrides). Affects new resolution only — existing `bun.lock` entries are untouched.
- Bun does **not** honor npm's `min-release-age` — must use this native setting.
- To exempt a package: add `minimumReleaseAgeExcludes = ["pkg-name"]` in the repo-local `bunfig.toml`.

### npm — `~/.npmrc`

```ini
min-release-age=7
```

- Belt-and-suspenders for any plain `npm` contexts. Ignored by Bun.

### uv (Python) — per repo `pyproject.toml`

```toml
[tool.uv]
exclude-newer = "7 days"
```

- No global uv config equivalent — must be set per repo.
- **New Python repos: add this to `pyproject.toml` before first `uv sync`.**
- To exempt a specific package: use `[tool.uv.exclude-newer-package]` overrides.

## MCP Servers

Canonical definitions in `configs/mcp/*.json`. Rendered to each CLI via `metronome push`.

| Server | Native MCP | Binary (on PATH) | Notes |
|--------|-----------|------------------|-------|
| `context7` | All CLIs | `context7` | HTTP; library docs |
| `tavily` | Claude, OpenCode, Gemini | `tavily` | `TAVILY_API_KEY`, `provider_ENV=dev`; extract is approved-domain only |
| `palantir-mcp` | Claude, OpenCode | `palantir` | Tux-managed launcher; secrets stay out of editor config |
| `shadcn` | OpenCode | `shadcn` | shadcn/ui |
| `sequential-thinking` | — | `sequential-thinking` | Reasoning; native MCP disabled |
