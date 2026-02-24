---
summary: Domain map of the agents repo — modules, layers, dependency direction.
read_when:
  - First time navigating repo structure
  - Adding new config targets or scripts
---

# Architecture

## Layers

- **configs/** — Canonical source for all CLI artifacts.
  - `commands/` — Slash commands (8 .md files)
  - `agents/` — Subagent definitions (currently empty)
  - `skills/` — Skill bundles (2 directories)
  - `mcp/` — MCP server definitions (3 .json files)
  - `settings/` — Per-CLI settings (claude, opencode)
  - `instructions/AGENTS.md` — Unified agent operating system (ground truth)
  - `instructions/TOOLS.md` — Tool-use reference
- **scripts/** — Helper tools (committer, generate-docs, browser-tools)
- **docs/** — Operational documentation, plans, design decisions
- **backups/** — Pre-sync backups (gitignored)

## Data Flow

```
configs/  ──→  /zz-sync-agent-configs push  ──→  ~/.claude/
                                                         ~/.config/opencode/
                                                         ~/.gemini/
                                                         ~/.codex/
```

## Dependency Direction

- CLI configs depend on `configs/` (never the reverse)
- `src/adapters/` implement per-CLI format transforms (spec: `docs/design/sync-spec.md`)
- `configs/instructions/AGENTS.md` is consumed by all CLIs at runtime (injected as instructions)
- `scripts/` are standalone; no imports between them
