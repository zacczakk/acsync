---
summary: Domain map of the agents repo — modules, layers, dependency direction.
read_when:
  - First time navigating repo structure
  - Adding new config targets or scripts
---

# Architecture

## Layers

- **AGENTS.md** — Ground truth for agent behavior. Index, not encyclopedia.
- **SYNC.md** — Sync playbook: format specs, merge rules, per-CLI transforms.
- **configs/common/** — Canonical source for all CLI artifacts.
  - `commands/` — Slash commands (17 .md files)
  - `agents/` — Subagent definitions (8 .md files)
  - `skills/` — Skill bundles (2 directories)
  - `mcp/` — MCP server definitions (6 .json files)
  - `settings/` — Per-CLI settings (claude, opencode)
  - `instructions/` — Per-CLI instruction addenda (4 .md files)
- **scripts/** — Helper tools (committer, generate-docs, browser-tools)
- **docs/** — Operational documentation, plans, design decisions
- **backups/** — Pre-sync backups (gitignored)

## Data Flow

```
configs/common/  ──→  /zz-sync-agent-configs push  ──→  ~/.claude/
                                                         ~/.config/opencode/
                                                         ~/.gemini/
                                                         ~/.codex/
```

## Dependency Direction

- CLI configs depend on `configs/common/` (never the reverse)
- `SYNC.md` is the contract between the repo and the sync command
- `AGENTS.md` is consumed by all CLIs at runtime (injected as instructions)
- `scripts/` are standalone; no imports between them
