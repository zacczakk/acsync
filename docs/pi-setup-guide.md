---
summary: Hypercomplete setup guide for onboarding Pi (earendil-works coding agent) as a metronome-managed harness, at capability parity with the OpenCode config.
read_when:
  - Onboarding or configuring the Pi coding agent
  - Adding Pi as a metronome sync target
  - Choosing Pi extensions, themes, or migrating MCP/skills from OpenCode
created: 2026-07-09
---

# Pi Setup Guide

Hypercomplete guide to running **Pi** (`@earendil-works/pi-coding-agent`, binary `pi`)
as a metronome-managed harness, at or above the capability of the current OpenCode
config. Every config key, path, and package name here is verified against primary
sources (repo source, official docs, npm) as of 2026-07-09. Unverified items are
flagged `[UNVERIFIED]`.

> Pi is Mario Zechner's minimal terminal coding agent (~68k★, MIT). Canonical repo
> `github.com/earendil-works/pi` (formerly `badlogic/pi-mono`). It is a **programmable
> platform**, not a configurable product: you extend it with in-process TypeScript
> rather than toggling settings. Design ethos: 4 tools (read/write/edit/bash),
> sub-1k-token system prompt, **no native MCP** (skills + CLIs over MCP), no built-in
> subagents/plan-mode/permission-popups — all added via extensions when you need them.

Companion scaffolding under `configs/pi/` is a planned follow-up (not yet on disk —
see §0 prerequisite). This doc is the "why and how" and stands on its own as reference;
the scaffolding will be the ready-to-`cp` "what".

---

## 0. TL;DR — the 10-minute setup

> ⚠️ **PREREQUISITE — scaffolding not yet created.** The `configs/pi/` files this
> TL;DR copies (`settings.json`, `AGENTS.md`, `APPEND_SYSTEM.md`, `mcp.json`,
> `themes/north.json`) **do not exist yet** — they are a planned deliverable, not
> on disk. Steps 2 and 4 will fail until the scaffolding is built (tracked as a
> follow-up). Until then, treat §0 as the target shape and author each
> `~/.pi/agent/` file by hand using the verified schemas in §3–§8. The rest of the
> guide (§1–§12) is reference material that stands on its own.

```bash
# 1. Install (Node >= 22.19.0; pi runs on Node even when installed via bun)
bun add -g --ignore-scripts @earendil-works/pi-coding-agent
pi --version

# 2. Seed config from metronome scaffolding  [requires configs/pi/ — see prerequisite]
mkdir -p ~/.pi/agent
cp ~/Repos/zacczakk/metronome/configs/pi/settings.json      ~/.pi/agent/settings.json
cp ~/Repos/zacczakk/metronome/configs/pi/AGENTS.md          ~/.pi/agent/AGENTS.md
cp ~/Repos/zacczakk/metronome/configs/pi/APPEND_SYSTEM.md   ~/.pi/agent/APPEND_SYSTEM.md
cp ~/Repos/zacczakk/metronome/configs/pi/mcp.json           ~/.pi/agent/mcp.json
mkdir -p ~/.pi/agent/themes && cp ~/Repos/zacczakk/metronome/configs/pi/themes/north.json ~/.pi/agent/themes/north.json

# 3. Auth (pick your provider; stores to ~/.pi/agent/auth.json 0600)
pi   # then /login  → choose Anthropic / Copilot / etc.
#   or: export ANTHROPIC_API_KEY=sk-ant-...

# 4. Portable skills (agentskills.io spec — same as OpenCode/Claude Code)
#    Loop preserves each skill's <name>/ directory (do NOT use `cp configs/skills/*/`,
#    which flattens the skill-name layer and errors on no-match in zsh). See §7.
mkdir -p ~/.pi/agent/skills
for d in ~/Repos/zacczakk/metronome/configs/skills/*/; do cp -R "$d" ~/.pi/agent/skills/; done

# 5. Core extensions (leanest power-user set)
pi install npm:pi-mcp-adapter          # MCP bridge, lazy proxy
pi install npm:pi-web-access           # multi-backend web search (Parallel default; Tavily/Brave/Exa/OpenAI) + fetch
pi install npm:pi-subagents            # subagent delegation
pi install npm:@narumitw/pi-chrome-devtools
pi install npm:@narumitw/pi-statusline
pi install npm:@narumitw/pi-lsp        # fills the one real gap vs OpenCode

# 6. Go
pi
```

Everything below is the detail behind these steps.

---

## 1. What Pi is (and how it differs from OpenCode)

| Axis | Pi | OpenCode |
|---|---|---|
| Model | Programmable platform (runtime-level control) | Configurable product (config-level control) |
| Built-in tools | 4 (read/write/edit/bash) + 3 opt-in (grep/find/ls) | 12+ (LSP, web, MCP, todos, permissions) |
| System prompt | < 1,000 tokens | tens of thousands |
| MCP | **Not native** — via `pi-mcp-adapter` extension | Native (stdio + remote) |
| LSP | Not native — `@narumitw/pi-lsp` or `oh-my-pi` | Native, 40+ languages |
| Extensions | In-process TypeScript, 25+ typed events, per-turn system-prompt injection | Module plugins, ~20 events |
| Sessions | Tree (local JSONL, branchable) | Linear (SQLite, server-side, shareable) |
| Skills | agentskills.io spec (portable) | agentskills.io spec (portable) |
| Model switch mid-session | Native (`/model`) | Limited |
| Clients | Terminal + RPC | Terminal + desktop + VS Code + mobile + web |

**Benchmark reality:** Pi + Claude Opus 4.5 was reported at **#2 on TerminalBench
(Oct 2025)** `[UNVERIFIED — historical snapshot; the leaderboard has since grown and
no current Pi-specific score is published]` with no compaction, MCP, subagents, or
plan mode — the point being that the minimalism is not an inherent performance
liability. Expect *competitive*, not *#1*, out of the box: leaderboard-topping scores
come from heavily tuned harnesses, and harness tuning alone moves SWE-bench up to
16 points on the same model — which is exactly why this guide invests in tuning.

**The migration truth:** this is a paradigm shift, not a feature downgrade. Your
`AGENTS.md` content ports directly. Your skills port directly. Your MCP servers and
OpenCode plugins do **not** — they get rebuilt (skills/CLIs) or rewired
(`pi-mcp-adapter`) or rewritten (TS extensions). Budget for that; see §12.

---

## 2. Install & identity

```bash
# Recommended (Bun-first house default)
bun add -g --ignore-scripts @earendil-works/pi-coding-agent
# Alternatives
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
curl -fsSL https://pi.dev/install.sh | sh
```

- **Binary:** `pi`. **Runtime:** Node ≥ 22.19.0 — `pi` runs on Node regardless of
  installer; `bun add -g` is the installer, not the runtime.
- `--ignore-scripts` disables dependency lifecycle scripts at install (both `bun add`
  and `npm install` honor it). Pi requires no install scripts for a normal global
  install; keep the flag for supply-chain hygiene (§9 notes Pi later fetches unsigned
  `fd`/`rg` at *runtime* — a separate concern the flag does not cover).
- **Namespace:** `@earendil-works/*` is canonical. `@mariozechner/*` is deprecated but
  still resolves — do not use it in new configs.
- **Package management** (Pi's own unified system — extensions/skills/prompts/themes):
  ```bash
  pi install npm:<pkg>[@version]      # from npm
  pi install git:github.com/u/r[@ref] # from git
  pi -e npm:<pkg>                     # ephemeral try, no install
  pi list ; pi update --all ; pi remove npm:<pkg> ; pi config
  /reload                             # hot-reload extensions/skills/prompts, no restart
  ```
- **Telemetry off:** `PI_TELEMETRY=0`,
  `PI_OFFLINE=1` (disables all startup network ops), `PI_SKIP_VERSION_CHECK=1`, or
  `enableInstallTelemetry: false` in settings.

---

## 3. Configuration model

Global dir `~/.pi/agent/` (override `PI_CODING_AGENT_DIR`). Project dir `.pi/`.
Project settings **deep-merge over** global.

| File | Purpose |
|---|---|
| `settings.json` | Main config (model, UI, compaction, retry, resources) |
| `auth.json` | Credentials, `0600`, **priority over env vars** |
| `AGENTS.md` | Project/global context, concatenated into system prompt |
| `APPEND_SYSTEM.md` | Appended to the system prompt after `AGENTS.md` (positionally later) |
| `SYSTEM.md` | **Fully replaces** the default system prompt (use with care) |
| `models.json` | Custom model/provider definitions |
| `mcp.json` | MCP servers (consumed by `pi-mcp-adapter`) |
| `trust.json` | Saved project-trust decisions |
| `themes/*.json` | Custom themes |
| `prompts/*.md` | Prompt templates → `/slash` commands |
| `skills/<name>/SKILL.md` | Skills (agentskills.io) |
| `extensions/*.ts` | Auto-discovered local extensions |

### settings.json — verified key reference

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",          // off|minimal|low|medium|high|xhigh
  "hideThinkingBlock": false,
  "theme": "north",
  "quietStartup": false,
  "editorPaddingX": 0,                        // 0-3
  "outputPad": 1,                             // 0 or 1
  "autocompleteMaxVisible": 5,               // 3-20
  "enabledModels": ["claude-*", "gpt-5*"],   // filter model picker
  "warnings": { "anthropicExtraUsage": true },
  "compaction": { "enabled": true, "reserveTokens": 16384, "keepRecentTokens": 20000 },
  "retry": { "enabled": true, "maxRetries": 3 },
  "defaultProjectTrust": "ask",              // ask|always|never
  "enableSkillCommands": true,               // register skills as /skill:name
  "enableInstallTelemetry": false,
  "packages": [],                            // npm/git packages to load
  "extensions": [], "skills": [], "prompts": [], "themes": []  // local paths/dirs
}
```

### auth.json + providers (verified `auth.json` keys)

Credential resolution: **runtime override → `auth.json` → env var → fallback resolver.**
`/login` writes `auth.json`. Provider→env→auth-key table (**partial** — Pi supports
~20 providers; full table at [`pi.dev/docs/latest/providers`](https://pi.dev/docs/latest/providers),
also includes `deepseek`, `mistral`, `groq`, `cerebras`, `xai`, `nvidia`, `zai`,
`huggingface`, `cloudflare-workers-ai`, `opencode`, etc.):

| Provider | Env var | `auth.json` key |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` / `ANTHROPIC_OAUTH_TOKEN` | `anthropic` |
| OpenAI | `OPENAI_API_KEY` | `openai` |
| Azure OpenAI (Responses) | `AZURE_OPENAI_API_KEY` (+ `AZURE_OPENAI_BASE_URL`, `_API_VERSION`, `_DEPLOYMENT_NAME_MAP`) | `azure-openai-responses` |
| Google Gemini | `GEMINI_API_KEY` | `google` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` / `GH_TOKEN` | (OAuth via `/login`) |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | `vercel-ai-gateway` |
| Cloudflare AI Gateway | `CLOUDFLARE_API_KEY` (+ `_ACCOUNT_ID`, `_GATEWAY_ID`) | `cloudflare-ai-gateway` |

**OAuth subscription providers** (via `/login`, no API key): Anthropic Claude
Pro/Max, OpenAI Codex (ChatGPT Plus/Pro), GitHub Copilot, Google Cloud Code Assist.

### Custom providers (Bedrock / Azure / OpenAI-compatible gateways)

AWS Bedrock and Azure OpenAI are supported via native env vars (above) — no custom
model file needed for standard deployments. For another OpenAI-compatible gateway,
define models in `models.json`:

```json
[
  {
    "id": "gpt-5.1", "name": "GPT-5.1 (Gateway)",
    "api": "openai-completions", "provider": "custom-openai",
    "baseUrl": "https://<gateway>/openai", "reasoning": true, "input": ["text"],
    "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
    "contextWindow": 400000, "maxTokens": 128000
  }
]
```

`api` ∈ `openai-completions | openai-responses | anthropic-messages | google-generative-ai`.
For dynamic/proxy providers (e.g. the Cursor gRPC fork analog), register at startup in
an extension: `pi.registerProvider("name", { baseUrl, apiKey: "$ENV", api, models })`.
You can also override just the `baseUrl` of a built-in provider — useful for pointing
`anthropic` at a compatible proxy.

### The instruction stack (this is how you carry your agent identity)

Pi gives you two instruction layers that map cleanly onto the metronome files:

- `~/.pi/agent/AGENTS.md` — operating rules, tool choices, workflow (the bulk of
  `configs/instructions/AGENTS.md`). Concatenated with parent-dir and cwd `AGENTS.md`.
- `~/.pi/agent/APPEND_SYSTEM.md` — behavioral rules appended to the system prompt
  *after* `AGENTS.md`. This is where SOUL/IDENTITY voice + hard constraints go
  (telegraphic voice, no-slop, en-dash preference, "confirm before destructive").

> Note: Pi docs describe `APPEND_SYSTEM.md` as "append to the default prompt without
> replacing it" — they make **no formal precedence guarantee** over `AGENTS.md`. In
> practice, later-in-prompt content tends to carry slightly more weight with current
> models, so it's a reasonable place for hard rules — but don't rely on it as a
> guaranteed override. `[UNVERIFIED — inference, not a documented contract]`

---

## 4. CLI & modes

```bash
pi                         # interactive TUI
pi -p "prompt"             # print mode (non-interactive, stdout)
echo "prompt" | pi -p      # pipe
pi --mode rpc             # headless JSON-over-stdio (for embedding/metronome tooling)

# session
pi -c                      # continue most recent
pi -r                      # browse sessions
pi --session <id> | --fork <id> | --name "x" | --no-session

# context / prompt
pi --skill <path>          # load a skill (repeatable)
pi --no-skills | --no-context-files/-nc
pi --system-prompt "..." | --append-system-prompt "..."
pi @file.md "prompt"       # inline a file; images supported (-p @shot.png "...")

# model / trust / theme
pi --list-models | --approve/-a | --no-approve/-na | --theme <path> | --no-themes

# extensions
pi -e ext.ts -e npm:@foo/bar   # stack extensions ad-hoc
```

Editor: `@` fuzzy file search, `Tab` complete, `Shift+Enter` multiline, `Ctrl+V`
paste image, `!cmd` (shell → model sees it), `!!cmd` (shell, hidden), `Ctrl+G`
external editor.

Sessions are **trees** in `~/.pi/agent/sessions/` (JSONL). `/tree` navigate, `/fork`,
`/clone`, `/compact`. Muscle-memory note: this replaces OpenCode's linear model —
branching is a feature, remote portability is the tradeoff.

---

## 5. Which plugins (extensions) to use

Pi packages bundle extensions + skills + prompts + themes. Discover at
[`pi.dev/packages`](https://pi.dev/packages) and the community thread
[discussions/3373](https://github.com/earendil-works/pi/discussions/3373).
**Extensions execute code at install — review source for third-party packages.**

### Tier 1 — foundational (install first)

> Star counts below are approximate point-in-time snapshots (2026-07), not live
> figures — treat as rough popularity signal, not exact.

| Package | Why | Install |
|---|---|---|
| `pi-mcp-adapter` (nicobailon, ~975★) | MCP bridge. One ~200-token proxy tool, lazy connect. `imports:` auto-migrates existing host configs (`claude-code`, `cursor`, `claude-desktop`, `vscode`, `windsurf`, `codex`). | `pi install npm:pi-mcp-adapter` |
| `pi-web-access` (nicobailon, ~769★) | Multi-backend web search (Parallel default; Tavily/Brave/Exa/OpenAI selectable, `TAVILY_API_KEY` for the Tavily backend), URL extract, YouTube, PDF, GitHub clone. Replaces the Tavily MCP with zero MCP overhead. | `pi install npm:pi-web-access` |
| `pi-subagents` (nicobailon, ~2,468★) | Async subagent delegation: scout/researcher/planner/worker/reviewer/oracle, best-of-N, fleet view. Your 11 OpenCode subagents map here. | `pi install npm:pi-subagents` |
| `@narumitw/pi-chrome-devtools` | Native CDP (tabs, navigate, eval JS, screenshots). Replaces the chrome-devtools MCP. | `pi install npm:@narumitw/pi-chrome-devtools` |
| `@narumitw/pi-lsp` | Language-agnostic LSP diagnostics + code actions. **Fills the one real gap vs OpenCode.** | `pi install npm:@narumitw/pi-lsp` |
| `pi-subdir-context` | Auto-loads `AGENTS.md` from subdirectories (monorepos). | `pi install npm:pi-subdir-context` |

### Tier 2 — ergonomics

| Package | Why |
|---|---|
| `@narumitw/pi-statusline` | Rich footer: model, git, ctx%, tokens, cost, clock. Presets `tokyo-night` (powerline `░▒▓`) / `classic` via `PI_STATUSLINE_PRESET`. |
| `@narumitw/pi-plan-mode` | Codex-style read-only planning mode (OpenCode plan-mode analog). |
| `@narumitw/pi-retry` | Auto-retry on transient provider errors. |
| `@narumitw/pi-goal` | `/goal` loop until verifiably done. |
| `@narumitw/pi-btw` | `/btw` side-question without polluting main context. |
| `pi-smart-compact` | Verification-oriented deterministic compaction. |
| `@narumitw/pi-caffeinate` | Prevents sleep during long autonomous runs. |

### Tier 3 — power workflows (per-project)

| Package | Why |
|---|---|
| `pi-autoresearch` (davebcn87, 7,160★) | Autonomous edit→measure→keep/revert optimization loop. `.auto/{prompt.md,measure.sh,checks.sh}`. Already in your vault backlog. |
| `open-gsd/gsd-pi` (847★) | Meta-prompting + spec-driven long runs (`gsd:plan-phase/execute-phase/verify-work`). GSD-2's current home. |
| `injaneity/pi-computer-use` (620★) | macOS + Windows desktop GUI automation, AX-first + vision fallback. Needs Accessibility + Screen Recording. Your `peekaboo` analog inside the agent loop. |
| `pi-generative-ui` (Michaelliv) | Terminal generative UI via Glimpse (native macOS WKWebView) + morphdom streaming. In your vault already. |
| `hjanuschka/pi-multi-pass` (427★) | Multiple OAuth subscription accounts per provider with preset rotation. |

### The distro alternative: `oh-my-pi`

`can1357/oh-my-pi` (16,838★) is a **batteries-included Pi distribution**, not an
extension: hash-anchored edits (content-hash, no position drift — the hashline concept
from your `oh-my-opencode` note), LSP on every write, DAP debugger, watchdog model,
subagents from isolated worktrees, Hindsight memory, 40+ providers. **Likely
incompatible with mixing individual extensions.** Choose *either* cherry-picked
extensions (this guide's default, better fit for metronome management) *or* oh-my-pi
(faster to power, less controllable). Recommendation: **cherry-pick** — it keeps the
config declarative and metronome-syncable.

### Reference bundles worth reading (not installing wholesale)

- `mitsupi` (`mitsuhiko/agent-stuff`) — Armin Ronacher's personal skills/extensions/
  themes/commands. Best reference implementation of a power-user Pi setup.
- `@narumitw/*` monorepo (`narumiruna/pi-extensions`) — 16 composable extensions.

---

## 6. Customizing visual appearance

Pi's TUI is truecolor (24-bit, 256 fallback). Two built-in themes only: `dark`,
`light`. You theme via a **JSON** file (not TS).

### Theme file — verified format

- **Location** (priority): built-in → `~/.pi/agent/themes/*.json` → `.pi/themes/*.json`
  (after trust) → package `themes/` → settings `themes[]` → `--theme <path>`.
- **Select:** `"theme": "<name>"` in settings, or `/settings`, or `pi --theme <path>`.
  (No `/theme` command exists.)
- **Schema** (`theme-schema.json`, draft-07): `{ name (unique, no "/"), colors{…51
  tokens, all required}, $schema?, vars?, export? }`. Color value = `#RRGGBB` | integer
  `0-255` (256-palette index) | `""` (terminal default) | a `vars` key name.
- **Hot-reload:** edits to the active theme file apply immediately.

**All 51 tokens** (verbatim from source — build a theme by filling every one):

```
Core (11):   accent border borderAccent borderMuted success error warning
             muted dim text thinkingText
Backgrounds (11): selectedBg userMessageBg userMessageText customMessageBg
             customMessageText customMessageLabel toolPendingBg toolSuccessBg
             toolErrorBg toolTitle toolOutput
Markdown (10): mdHeading mdLink mdLinkUrl mdCode mdCodeBlock mdCodeBlockBorder
             mdQuote mdQuoteBorder mdHr mdListBullet
Diffs (3):   toolDiffAdded toolDiffRemoved toolDiffContext
Syntax (9):  syntaxComment syntaxKeyword syntaxFunction syntaxVariable
             syntaxString syntaxNumber syntaxType syntaxOperator syntaxPunctuation
Thinking borders (6): thinkingOff thinkingMinimal thinkingLow thinkingMedium
             thinkingHigh thinkingXhigh
Bash (1):    bashMode
```

A ready-to-use **`north`** theme (Nord palette, matches your OpenCode theme) is part of
the planned `configs/pi/themes/north.json` scaffolding (see §0 prerequisite). Once built,
drop it at `~/.pi/agent/themes/north.json` and set `"theme": "north"`. The full 51-token
palette to build it from is enumerated above.

> Pro tip from the docs: *"pi can create themes. Ask it to build one for your setup."*
> Pi will author a valid 51-token theme on request — good for a quick palette variant.

### TUI layout & appearance settings

| Setting | Effect |
|---|---|
| `quietStartup: true` | Hide the startup header/splash |
| `editorPaddingX` / `outputPad` | Editor & message horizontal padding |
| `markdown.codeBlockIndent` | Code-block indentation `[UNVERIFIED — not in official settings docs; confirm before use]` |
| `hideThinkingBlock` | Suppress thinking blocks |
| `autocompleteMaxVisible` | Autocomplete dropdown height |

### The rainbow-logo analog

There is no published "rainbow logo" plugin like your OpenCode `oc-plugin-rainbow`.
The official `rainbow-editor.ts` example (in the repo `examples/extensions/`) animates
a rainbow shimmer on a word in the input editor using ANSI 24-bit RGB — the closest
analog. For a startup banner, build a tiny extension that calls
`ctx.ui.setWidget("header", …)` on `session_start` with ANSI escapes (same technique).
A starter extension (`north-splash.ts`) is part of the planned `configs/pi/` scaffolding
(see §0 prerequisite — not yet on disk).

### Generative / rich terminal UI (build your own widgets)

Extensions get a full UI API — this is where Pi's "programmable platform" nature pays
off. Key surface:

```typescript
ctx.ui.setStatus(id, text)                       // persistent footer status
ctx.ui.setWidget(id, string[] | (tui,theme)=>Component, { placement })  // above/below editor
ctx.ui.setFooter((tui,theme)=>Component)         // replace footer entirely
ctx.ui.setWorkingIndicator({ frames, intervalMs })  // custom spinner
ctx.ui.custom(factory, { overlay: true })        // full overlay component
ctx.ui.select | confirm | input | editor | notify
ctx.ui.theme.fg(token, text) | bg | bold | italic
pi.registerMessageRenderer(type, renderer)       // custom message rendering
pi.registerEntryRenderer(type, renderer)         // TUI-only entries
// syntax highlighting in custom renderers:
import { highlightCode, getLanguageFromPath } from "@earendil-works/pi-coding-agent";
```

TUI primitives from `@earendil-works/pi-tui`: `Text Box Container Spacer Markdown
Image SelectList SettingsList BorderedLoader`. For the full generative-UI (HTML-in-
terminal) pattern, `pi-web-access`/`pi-generative-ui` + Glimpse is the vault-noted route.

### Fonts

No Pi-specific font requirement. `@narumitw/pi-statusline`'s `tokyo-night` preset uses
powerline block glyphs (`░▒▓`) which render in any modern terminal; its segment labels
are emoji, not Nerd-Font codepoints, so **no Nerd Font is required**. On WezTerm/Ghostty,
set the Kitty keyboard protocol for `Shift+Enter` (see `pi.dev/docs/latest/terminal-setup`
or the repo `docs/terminal-setup.md`).

---

## 7. Skills — port them directly

Pi implements the **agentskills.io** spec — the *same* `SKILL.md` format as OpenCode
and Claude Code. Your ~47 metronome skills are **directly portable**.

- Copy `configs/skills/<name>/` → `~/.pi/agent/skills/<name>/`.
- Discovery order: `~/.pi/agent/skills/`, `~/.agents/skills/`, `.pi/skills/` (after
  trust), `.agents/skills/` up to git root, package skills, settings `skills[]`, `--skill`.
- Progressive disclosure: only `name`+`description` enter the prompt; full body is
  read on demand. `/skill:name` force-loads.

**Caveat:** skills that call harness-specific syntax (OpenCode slash commands, Claude
Code `@`-mentions, `TodoWrite`) won't be fully portable. metronome already ships a Pi
action-mapping at
[`configs/skills/using-superpowers/references/pi-tools.md`](../configs/skills/using-superpowers/references/pi-tools.md)
— subagent actions → `pi-subagents`, todo actions → `TODO.md`/task extension. Audit
each skill's tool references before relying on it.

---

## 8. MCP — the anti-MCP harness, pragmatically

Pi ships zero MCP by design (Mario: each server burns 10k+ tokens before you type).
Two migration paths, use both:

1. **Replace with native extensions where they exist** (zero MCP overhead):
   - Tavily MCP → `pi-web-access`
   - chrome-devtools MCP → `@narumitw/pi-chrome-devtools`
2. **Bridge the rest** via `pi-mcp-adapter` (`~/.pi/agent/mcp.json`):
   - context7, sequential-thinking, context-mode → keep as MCP, proxied lazily.

`pi-mcp-adapter` reads `~/.config/mcp/mcp.json`, `~/.pi/agent/mcp.json`, `.mcp.json`,
`.pi/mcp.json`, and can `imports:["claude-code","cursor","vscode",…]` your existing
host configs. Run `pi-mcp-adapter init` to auto-detect and import. Per-server:
`directTools: true|["tool"]` promotes hot tools to direct (150-300 tok/tool);
`lifecycle: lazy|eager|keep-alive`. (An `mcp.json` scaffold is part of the planned
`configs/pi/` deliverable — see §0 prerequisite.)

`context-mode` is also available as a native Pi package (`pi install npm:context-mode`)
— prefer that over the MCP form if you want the `ctx_*` sandbox tools in Pi.

---

## 9. Security posture

Per the agent-safehouse analysis (Pi v0.52.9): **no built-in sandbox — `bash` runs
with full user permissions, unrestricted filesystem/network, and Pi auto-downloads
`fd`/`rg` from GitHub over HTTPS without signature verification.** Extensions can
register arbitrary tools and run code at install time (trust-at-install model).

Mitigations, in order of preference:
- `defaultProjectTrust: "ask"` (scaffold default) — never auto-trust unknown repos.
- Opt-in sandbox extension for tool isolation. The safehouse report references
  `@anthropic-ai/sandbox-runtime`; the confirmed-installable community route is
  `carderne/pi-sandbox` (`pi install npm:pi-sandbox`). `[verify install path before relying on it]`
- Container isolation (Docker) or `rivet agent-os` (WASM/V8 isolates; supports Pi) for
  untrusted work — your vault already tracks rivet as the sandbox runtime.
- Pin extension versions; review third-party source.
- For a gateway using a private certificate authority, set `NODE_EXTRA_CA_CERTS` to
  your organization's CA bundle before `pi install` or provider calls. Diagnose TLS
  failures as certificate or proxy configuration issues before disabling verification.

---

## 10. Recommended workflows (evidence-based)

- **Keep global `AGENTS.md` lean, `APPEND_SYSTEM.md` for hard rules.** Per-project
  `AGENTS.md` for stack conventions — write it *before* complex tasks.
- **Skills on-demand, not preloaded** — zero context cost until invoked. Lean context
  is Pi's edge; don't refill it with a bloated system prompt.
- **Subagents:** `pi-subagents` for delegation; tmux-panes for full-observability
  parallel work (Mario's own preference). Don't fabricate `Task` calls if the extension
  isn't installed.
- **Sessions:** short and deliberate; review before moving on. `/compact` when context
  fills. Use `/tree` to branch instead of restarting.
- **Model selection:** Sonnet-class for day-to-day, Opus-class for hard problems;
  `defaultThinkingLevel` per task; switch mid-session with `/model`. Cross-provider
  thinking-trace handoff is best-effort — don't rely on continuity across providers.
- **The slop guard:** Pi's minimalism helps, but the discipline is yours — never hand
  over a branch and walk away. (Mario, "Building Pi in a World of Slop".)

---

## 11. Integrating Pi into metronome (the sync-engine side)

metronome is a CLI-agnostic sync engine with per-CLI adapters
(`src/adapters/{claude-code,opencode,antigravity,codex}.ts`). Onboarding Pi as a
**managed target** mirrors the antigravity onboarding precedent
([`docs/…antigravity-cli-metronome-adapter`](../../Vaults/Knowledge/06_docs/antigravity-cli-metronome-adapter.md)):

1. **Canonical source:** `configs/pi/` (planned scaffolding) holds Pi's global config.
2. **Wire the target into the type system** — writing the adapter class alone will NOT
   compile. Four files must change together (TypeScript exhaustiveness will enforce this):
   - `src/types.ts` → add `'pi'` to the `TargetName` union.
   - `src/adapters/pi.ts` → new `PiAdapter extends BaseAdapter`.
   - `src/adapters/path-resolver.ts` → add a `case 'pi':` to **every** `switch(this.target)`
     block (`rawBaseDir`, `rawCommandsDir`, `rawAgentsDir`, `rawMCPConfigPath`,
     `rawSettingsPath`, `rawInstructionsPath`, `rawSkillsDir`, `rawPluginsDir`,
     `rawHooksPath`).
   - `src/cli/canonical.ts` → add `'pi'` to `ALL_TARGETS` and a `case 'pi': return new PiAdapter(homeDir)`
     to `createAdapter`.
3. **Path layout** (model on the antigravity/codex adapters):
   | Artifact | Pi path |
   |---|---|
   | Settings | `~/.pi/agent/settings.json` |
   | MCP | `~/.pi/agent/mcp.json` |
   | Instructions | `~/.pi/agent/AGENTS.md` (+ `APPEND_SYSTEM.md`) |
   | Skills | `~/.pi/agent/skills/<name>/SKILL.md` |
   | Commands | `~/.pi/agent/prompts/*.md` (prompt templates) |
   | Themes | `~/.pi/agent/themes/*.json` |
   | Extensions | `~/.pi/agent/extensions/*.ts` |
4. **Capabilities** — `AdapterCapabilities` has **8 required boolean fields**; declare all:
   ```ts
   { commands: true,  // prompt templates
     agents: false,   // Pi has no metronome-style agents; uses skills + pi-subagents
     mcp: true,       // via pi-mcp-adapter mcp.json (note: field is `mcp`, not `mcps`)
     instructions: true,  // AGENTS.md (+ APPEND_SYSTEM.md)
     skills: true,    // agentskills.io SKILL.md
     settings: true,  // settings.json
     plugins: false,  // Pi extensions are TS; manage separately if at all
     hooks: false }   // no metronome-managed hook surface
   ```
5. **Data flow & run:** `configs/pi/` → `metronome push --target pi` → `~/.pi/agent/`.
   Verify with `metronome diff --target pi` first (read-only), then `metronome check`.
6. **Tests:** fixtures under `test/fixtures/pi/` + `test/fixtures/seeds/pi/`, isolated
   home via `homeDir` (same pattern as every other adapter — no real `~/.pi` touched).
   Regenerate goldens with `bun test/generate-golden.ts` after adding the target to the
   generator's adapter list.

Until the adapter lands, hand-author each `~/.pi/agent/` file per §3–§8 (the §0 `cp`
flow needs the `configs/pi/` scaffolding, which is a separate follow-up).

---

## 12. Migration checklist (OpenCode → Pi)

- [ ] Install Pi, confirm `pi --version`, disable telemetry.
- [ ] If required, set `NODE_EXTRA_CA_CERTS` to the trusted CA bundle before installs or provider calls.
- [ ] Author `~/.pi/agent/` config by hand per §3–§8 (or `cp` from `configs/pi/` once
      that scaffolding exists — currently a follow-up deliverable, see §0).
- [ ] `/login` your primary provider (or export env keys); add `models.json` for a
      custom gateway if needed. Note: `auth.json` is written only by `/login`/env — it is
      **not** metronome-synced and `metronome push` will not touch it.
- [ ] Port `AGENTS.md` + `APPEND_SYSTEM.md` (SOUL/voice).
- [ ] Copy skills (loop-copy preserving `<name>/` dirs, §7); audit each for
      harness-specific syntax (see `pi-tools.md`).
- [ ] Install Tier-1 extensions; `pi-mcp-adapter init` to import existing MCP config.
- [ ] Replace Tavily/chrome-devtools MCP with `pi-web-access`/`@narumitw/pi-chrome-devtools`.
- [ ] Install `@narumitw/pi-lsp` (the one real gap) + statusline.
- [ ] Drop `themes/north.json`, set `"theme": "north"`.
- [ ] Rebuild OpenCode plugins as Pi extensions where still needed (read-guard →
      `tool_call` block; notify → `session_*`).
- [ ] Convert the 13 commands to prompt templates in `prompts/`.
- [ ] Decide subagent strategy (`pi-subagents` vs tmux).
- [ ] Security pass: `defaultProjectTrust: ask`, sandbox strategy for untrusted repos.
- [ ] Write the metronome Pi adapter (§11: `pi.ts` + `types.ts` + `path-resolver.ts` +
      `canonical.ts`) to bring Pi under `metronome push --target pi`.

**Known gaps you accept:** native LSP (mitigated by `@narumitw/pi-lsp`), desktop/
VS Code/mobile clients, native GitHub-PR integration, built-in plan mode (mitigated by
`@narumitw/pi-plan-mode`). **What you gain:** per-turn system-prompt control, tighter
token budget, deeper extension composability, mid-session model switching, a hackable
harness that can extend itself.

---

## Sources

Verified against primary sources 2026-07-09:

- Repo: `github.com/earendil-works/pi` — README, `docs/{settings,themes,extensions,
  providers,skills,compaction}.md`, `src/…/theme/theme-schema.json` + `dark.json`.
- Official: `pi.dev`, `pi.dev/docs/latest`, `pi.dev/packages`.
- Extensions: `pi-mcp-adapter`, `pi-web-access`, `pi-subagents`, `pi-autoresearch`,
  `@narumitw/*`, `oh-my-pi`, `gsd-pi` (repos + npm).
- Voices: mariozechner.at (design posts), Armin Ronacher (lucumr.pocoo.org), Nader
  Dabit (nader.substack.com), Pragmatic Engineer, deepakness.com/blog/pi-agent-setup.
- Security: agent-safehouse.dev/docs/agent-investigations/pi.
- Vault priors: `07_knowledge/{pi-prompt-template-model,pi-computer-use,pi-autoresearch,
  generative-ui-terminal,oh-my-opencode-analysis,rivet-agent-os}.md`.

`[UNVERIFIED]` items flagged in-context: historical TerminalBench #2 ranking (§1);
`APPEND_SYSTEM.md` precedence-over-`AGENTS.md` (§3 — inference, not a documented
contract); `markdown.codeBlockIndent` settings key (§6); `pi-sandbox`/
`@anthropic-ai/sandbox-runtime` exact install path (§9); extension star counts are
approximate snapshots (§5). Stress-tested against primary sources 2026-07-09; two
review passes (fact-check + filesystem/consistency audit).
