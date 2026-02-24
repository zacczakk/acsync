# agents

Single source of truth for AI coding assistant configurations.
Agent-driven sync across Claude Code, OpenCode, Gemini CLI, and Codex.

## First-Time Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/zacczakk/agents.git
   cd agents
   ```

2. Copy `.env.example` to `.env` and fill in secrets:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Bootstrap sync**: Since slash commands aren't installed yet, manually copy one command to your CLI:

   **For Claude Code:**
   ```bash
   mkdir -p ~/.claude/commands/zz
    cp configs/commands/zz-sync-agent-configs.md \
      ~/.claude/commands/zz/sync-agent-configs.md
   ```

   **For OpenCode:**
   ```bash
   mkdir -p ~/.config/opencode/command
    cp configs/commands/zz-sync-agent-configs.md \
      ~/.config/opencode/command/zz-sync-agent-configs.md
   ```

4. Restart your CLI, then run `/zz-sync-agent-configs push` to install everything else.

## Quick Start

After setup, from any of the four CLIs, run:

```
/zz-sync-agent-configs push    # repo -> system
/zz-sync-agent-configs pull    # system -> repo
/zz-sync-agent-configs check   # drift detection
```

The agent reads `SYNC.md` (the playbook), computes diffs, and walks you
through every change interactively.

## Directory Layout

```
AGENTS.md                    Agent operating system (ground truth)
SYNC.md                      Sync playbook (format specs, merge rules)
.env                         Secrets (gitignored)

configs/
  commands/*.md              17 slash commands
  agents/*.md                8 agent definitions
  skills/                    2 skill directories
  mcp/*.json                 6 MCP server definitions
  settings/*.json            2 settings definitions (claude, opencode)
  instructions/*.md          4 per-CLI instruction addendums

scripts/
  committer                  Git commit helper
  generate-docs.py           Docs catalog generator
  browser-tools.ts           Chrome DevTools CLI

docs/                        Operational docs
backups/                     Pre-sync backups (gitignored)
```

## How It Works

No sync engine. No build step. The playbook (`SYNC.md`) documents:

- System paths per CLI
- Format transformations (Markdown, TOML, JSON per CLI)
- MCP server rendering (4 different shapes)
- Secret injection/redaction
- Subset merge rules (which JSON keys to touch, which to preserve)
- Per-CLI specialties (OpenCode providers, Claude proxy workarounds, etc.)

The `/zz-sync-agent-configs` slash command reads the playbook and executes it
interactively. Every write is preceded by a diff and requires confirmation.

## Helper Scripts

To sync helper scripts into another repo:

```
/zz-sync-agent-helpers
```

Copies `committer`, `generate-docs.py`, and `browser-tools.ts` from this
repo into the current working repo's `scripts/` directory. Diff + confirm
per file.

## Secrets

Copy `.env.example` to `.env` and fill in:

```
TAVILY_API_KEY=
CONTEXT7_API_KEY=
UPTIMIZE_BEDROCK_API_KEY=
PALANTIR_FOUNDRY_TOKEN=
```

Secrets are injected during push and redacted during pull. Never committed.

## Docs

Run `python scripts/generate-docs.py` for the full docs catalog.

| Doc | When to Read |
|-----|-------------|
| `SYNC.md` | Before any sync operation |
| `docs/overview.md` | First time in the repo |
| `docs/subagent.md` | Writing new commands or agents |
| `docs/tools.md` | Understanding available tools |
| `docs/tavily-reference.md` | Configuring Tavily MCP |
| `docs/runbooks/mcp-incident.md` | MCP server outage |
