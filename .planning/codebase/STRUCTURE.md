# Codebase Structure

**Analysis Date:** 2026-02-19

## Directory Layout

```
agents/
├── AGENTS.md                          # Ground truth agent operating system
├── SYNC.md                            # Sync playbook (777 lines, format specs + merge rules)
├── README.md                          # Setup guide and quick start
├── SECURITY.md                        # Security policy
├── LICENSE                            # License file
├── package.json                       # Node deps (commander, puppeteer-core)
├── .env                               # Secrets (gitignored)
├── .env.example                       # Secret template
├── .gitignore                         # Ignores: .env, backups/, bin/, node_modules/
│
├── configs/
│   └── common/
│       ├── commands/                  # 18 slash commands (zz-*.md)
│       ├── agents/                    # 8 subagent definitions (zz-*.md)
│       ├── instructions/              # 4 CLI-specific instruction addendums
│       ├── mcp/                       # 7 MCP server definitions (.json)
│       ├── settings/                  # 2 CLI settings (claude.json, opencode.json)
│       └── skills/                    # 2 skill directories
│           ├── web-design-guidelines/
│           └── vercel-react-best-practices/
│
├── scripts/
│   ├── committer                      # Bash git commit helper (112 lines)
│   ├── generate-docs.py               # Python docs catalog generator (113 lines)
│   └── browser-tools.ts               # TypeScript Chrome DevTools CLI
│
├── docs/
│   ├── architecture.md                # Domain map (with front-matter)
│   ├── overview.md                    # System overview (with front-matter)
│   ├── subagent.md                    # Subagent/command rendering contract
│   ├── tools.md                       # MCP servers and local helpers catalog
│   ├── tavily-reference.md            # Tavily MCP configuration reference
│   ├── CHANGELOG.md                   # Release changelog
│   ├── RELEASING.md                   # Release checklist
│   ├── design/                        # Design decisions (empty, .gitkeep)
│   ├── generated/                     # Auto-generated docs (empty, .gitkeep)
│   ├── references/                    # Vendored external docs (empty, .gitkeep)
│   ├── runbooks/
│   │   └── mcp-incident.md            # MCP outage/auth failure runbook
│   └── plans/
│       ├── STATE.md                   # Active plan pointer
│       ├── DECISIONS.md               # Cross-plan decision log
│       ├── active/                    # In-progress execution plans
│       └── completed/                 # Archived completed plans
│
├── bin/                               # Compiled binaries (gitignored)
│   └── browser-tools                  # Compiled browser-tools.ts
│
├── backups/                           # Pre-sync backups (gitignored)
│   └── <timestamp>/
│       ├── claude/
│       ├── opencode/
│       ├── gemini/
│       └── codex/
│
├── node_modules/                      # Dependencies (gitignored)
└── .planning/                         # GSD planning artifacts
    └── codebase/                      # Codebase analysis documents
```

## Directory Purposes

**`configs/common/commands/`:**
- Purpose: Canonical slash command definitions for all 4 CLIs
- Contains: 18 markdown files, each with YAML frontmatter (`description`, `argument-hint`, `allowed-tools`) + instruction body
- Key files: `zz-sync-agent-configs.md` (primary sync command), `zz-gate.md` (CI gate), `zz-plan.md` (planning)
- Naming: All prefixed `zz-` to namespace under the `zz` group

**`configs/common/agents/`:**
- Purpose: Canonical subagent definitions for all 4 CLIs
- Contains: 8 markdown files with frontmatter (`name`, `description`, `allowed-tools`) + role instructions
- Key files: `zz-planner.md` (task planning), `zz-verifier.md` (verification), `zz-reviewer.md` (code review)
- Naming: All prefixed `zz-`

**`configs/common/instructions/`:**
- Purpose: CLI-specific instruction addendums concatenated with AGENTS.md during push
- Contains: 4 markdown files, one per CLI
- Key files: `claude.md` (proxy workarounds, SSL), `opencode.md` (naming quirks, provider env vars)

**`configs/common/mcp/`:**
- Purpose: MCP server definitions in canonical JSON schema
- Contains: 7 JSON files defining transport, command, args, env, secrets, per-CLI exclusions
- Key files: `tavily.json` (web search, stdio), `context7.json` (docs retrieval, HTTP), `foundry-mcp.json` (data platform access, stdio)

**`configs/common/settings/`:**
- Purpose: CLI-specific settings (permissions, providers, env)
- Contains: `claude.json` (permissions + env), `opencode.json` (providers + permissions + model + plugin)

**`configs/common/skills/`:**
- Purpose: Skill bundles copied verbatim to all CLIs
- Contains: 2 skill directories with `SKILL.md` entry points
- `web-design-guidelines/`: Single SKILL.md fetching external guidelines
- `vercel-react-best-practices/`: SKILL.md + AGENTS.md + 45 rule files in `rules/` subdirectory

**`scripts/`:**
- Purpose: Standalone helper tools, byte-identical copies synced to other repos
- Contains: 3 scripts in 3 languages (bash, python, typescript)
- `committer`: Safe git commit helper — unstages everything, stages only listed paths, validates file existence
- `generate-docs.py`: Walks `docs/`, parses YAML frontmatter, prints catalog with summary + `read_when` hints
- `browser-tools.ts`: Chrome DevTools CLI using puppeteer-core + commander; subcommands: `start`, `nav`, `eval`, `screenshot`, `pick`, `cookies`, `inspect`, `kill`

**`docs/`:**
- Purpose: Operational documentation with structured front-matter
- Contains: Markdown files with `summary` and `read_when` YAML front-matter
- Subdirectories follow progressive disclosure: `design/`, `generated/`, `references/`, `runbooks/`, `plans/`

**`docs/plans/`:**
- Purpose: Execution plan tracking (replaces legacy `.tasks/` structure)
- `STATE.md`: Pointer to currently active plan slug
- `DECISIONS.md`: Cross-plan decision log
- `active/`: In-progress plans, each as `{slug}/PLAN.md` + optional `CONTEXT.md`
- `completed/`: Archived plans moved here after completion

**`backups/`:**
- Purpose: Pre-sync backups of system files (gitignored)
- Contains: Timestamped directories with per-CLI subdirectories
- Created automatically during push operations before any system file is modified

## Key File Locations

**Entry Points:**
- `AGENTS.md`: Ground truth agent operating system — injected into all CLI instruction files
- `SYNC.md`: Sync playbook — authoritative reference for all config transformations
- `configs/common/commands/zz-sync-agent-configs.md`: Primary sync command

**Configuration:**
- `package.json`: Node dependencies (commander, puppeteer-core)
- `.env`: Secret values (gitignored, 4 required keys)
- `.env.example`: Secret template showing required keys
- `.gitignore`: Excludes `.env`, `backups/`, `bin/`, `node_modules/`, `__pycache__/`, `.DS_Store`, `bun.lock*`

**Core Logic:**
- `SYNC.md`: All transformation logic, merge rules, per-CLI specs (777 lines)
- `configs/common/commands/zz-sync-agent-configs.md`: Sync command procedure
- `scripts/committer`: Git commit safety wrapper

**Documentation:**
- `docs/overview.md`: System overview, design decisions, architecture summary
- `docs/architecture.md`: Domain map with layers and data flow
- `docs/subagent.md`: Subagent model and cross-CLI rendering contract
- `docs/tools.md`: MCP servers and local helpers catalog

**Testing:**
- No test files — this repo has no sync engine code; the playbook is a document, not code

## Naming Conventions

**Files:**
- Commands and agents: `zz-{name}.md` (kebab-case with `zz-` prefix)
- MCP definitions: `{server-name}.json` (kebab-case)
- Settings: `{cli-name}.json` (lowercase)
- Instructions: `{cli-name}.md` (lowercase)
- Scripts: lowercase, no extension (bash), `.py` (python), `.ts` (typescript)
- Docs: `kebab-case.md` or `UPPERCASE.md` for special files (CHANGELOG, RELEASING)

**Directories:**
- `configs/common/{category}/`: Plural category names for collections
- `docs/{category}/`: Lowercase plural for doc subdirectories
- `backups/<ISO-timestamp>/<cli>/`: Timestamp + CLI name for backup organization
- Skills: `{skill-name}/` with `SKILL.md` entry point, optional `rules/` subdirectory

**Frontmatter Fields (commands):**
- `description`: One-line purpose
- `argument-hint`: Expected arguments (e.g., `[push|pull|check]`)
- `allowed-tools`: Array of tool names (e.g., `[Read, Glob, Grep, Bash]`)

**Frontmatter Fields (agents):**
- `name`: Agent identifier (matches filename)
- `description`: Role description
- `allowed-tools`: Array of tool names

**Frontmatter Fields (docs):**
- `summary`: One-line description
- `read_when`: Array of trigger conditions

## Where to Add New Code

**New Slash Command:**
- Create: `configs/common/commands/zz-{name}.md`
- Include frontmatter: `description`, `argument-hint` (optional), `allowed-tools`
- Start body with: `READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE.`
- Push to CLIs: Run `/zz-sync-agent-configs push`
- Current count: 18 commands

**New Subagent:**
- Create: `configs/common/agents/zz-{name}.md`
- Include frontmatter: `name`, `description`, `allowed-tools`
- Start body with: `READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).`
- Push to CLIs: Run `/zz-sync-agent-configs push`
- Current count: 8 agents

**New MCP Server:**
- Create: `configs/common/mcp/{server-name}.json`
- Use canonical schema: `description`, `transport`, `command`/`url`, `args`/`headers`, `env_vars`, `env`, optional `disabled_for`
- Add secret vars to `.env.example` and `.env`
- Update `docs/tools.md` with new server entry
- Update SYNC.md section 4 secret table if new secrets needed
- Push to CLIs: Run `/zz-sync-agent-configs push`
- Current count: 7 MCP definitions

**New Skill:**
- Create: `configs/common/skills/{skill-name}/SKILL.md`
- Include frontmatter: `name`, `description`, optional `argument-hint`, optional `metadata`
- Add rule files in `rules/` subdirectory if complex
- Push to CLIs: Run `/zz-sync-agent-configs push`
- Current count: 2 skills

**New CLI Settings:**
- Edit: `configs/common/settings/{cli}.json`
- Only claude.json and opencode.json exist; Gemini and Codex managed via MCP only
- Update SYNC.md section 5 if new managed keys are added

**New Documentation:**
- Create: `docs/{name}.md` with front-matter (`summary`, `read_when`)
- Add to `README.md` docs table if broadly relevant
- Run `python scripts/generate-docs.py` to verify front-matter compliance

**New Runbook:**
- Create: `docs/runbooks/{incident-type}.md` with front-matter
- Current count: 1 (mcp-incident.md)

**New Helper Script:**
- Add to `scripts/`
- Update `docs/tools.md`
- Update `AGENTS.md` tools section
- Scripts are synced to other repos via `/zz-sync-agent-helpers`

## Special Directories

**`backups/`:**
- Purpose: Pre-sync backups of system files
- Generated: Yes (by sync push operations)
- Committed: No (gitignored)

**`bin/`:**
- Purpose: Compiled binaries (browser-tools)
- Generated: Yes (`bun build scripts/browser-tools.ts --compile --target bun --outfile bin/browser-tools`)
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: npm/bun dependencies
- Generated: Yes (by `bun install` or `npm install`)
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: GSD codebase analysis and planning artifacts
- Generated: Yes (by GSD tooling)
- Committed: Varies — `codebase/` may be committed for reference

**`docs/generated/`:**
- Purpose: Auto-generated docs (DB schemas, API docs, type inventories)
- Generated: Yes (placeholder, currently empty with `.gitkeep`)
- Committed: `.gitkeep` only

**`docs/design/`:**
- Purpose: Design decision records
- Generated: No (hand-authored)
- Committed: Yes (currently empty with `.gitkeep`)

**`docs/references/`:**
- Purpose: Vendored external documentation
- Generated: No (hand-curated)
- Committed: Yes (currently empty with `.gitkeep`)

---

*Structure analysis: 2026-02-19*
