---
description: >-
  Scan current repo and create/update a project note in Memory vault (e.g.,
  /obs-analyze)
---

# Analyze — Scan Repo, Hydrate Memory

Analyze the current codebase and create a project note in `Memory/projects/`.

User input: $ARGUMENTS

## Steps

### Phase 1: Discovery

1. **Detect repo metadata:**
   ```bash
   git remote get-url origin 2>/dev/null
   git rev-parse --show-toplevel 2>/dev/null
   git branch --show-current
   basename $(git rev-parse --show-toplevel 2>/dev/null) 2>/dev/null || basename $(pwd)
   ```

2. **Scan for knowledge sources** — read each if found:

   | Category | Files to scan |
   |---|---|
   | Agent configs | `AGENTS.md`, `CLAUDE.md`, `.claude/CLAUDE.md`, `.cursorrules`, `.windsurfrules` |
   | Documentation | `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `docs/architecture.md` |
   | Project metadata | `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `setup.py`, `Gemfile`, `pom.xml` |
   | Build/CI | `Makefile`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/*.yml` |
   | Config | `tsconfig.json`, `.eslintrc.*`, `jest.config.*`, `biome.json` |

3. **Scan directory tree** (top 2 levels of source directories, excluding hidden/vendor/node_modules/dist).

4. **Detect language/framework** from file extensions + package manifests.

### Phase 2: Synthesis

Using discovered content, extract:

- **Architecture summary**: entry points, layer organization, build system
- **Key components**: major functional modules — each top-level source directory or logical grouping
- **Patterns**: coding conventions, error handling, testing approaches (from agent configs, README)
- **Key dependencies**: from package manifests (top 10 most important, not exhaustive)

### Phase 3: Write

1. **Check idempotency:**
   - `obsidian vault=Memory files folder=projects` — check if `{repo-name}.md` exists.
   - If exists, read it. If it's already populated (has ## Architecture section with real content), **skip and report** — don't overwrite manual work.
   - If exists but is a skeleton (no real content beyond headings), **replace**.
   - If doesn't exist, **create**.

2. **Write the project note** directly to filesystem (backtick safety):
   ```
   Write to: ~/Vaults/Memory/projects/{repo-name}.md
   ```

   Format:
   ```markdown
   ---
   type: project
   tags: []
   created: YYYY-MM-DD
   related: []
   depends-on: []
   repo: {git remote url}
   language: {detected}
   framework: {detected}
   status: active
   ---

   # {Project Name}

   {One-line description from README or package.json}

   ## Architecture

   {Real description: entry points, layers, build system}

   ## Key Components

   | Component | Purpose | Key Files |
   |---|---|---|
   | {name} | {purpose} | `{paths}` |

   ## Patterns

   - {Convention or pattern discovered from agent configs / README}

   ## Key Dependencies

   - {dep} — {what it's used for}
   ```

3. **Link to existing Memory notes:**
   - Search Memory vault for notes that reference this repo or its technologies.
   - Add found notes to the `related:` frontmatter array.

### Phase 4: Report

```
Analyzed: {repo-name}
  Sources read: {N} knowledge files
  Created: projects/{repo-name}.md
  Language: {detected}
  Components: {N}
  Patterns: {N}
  Related notes: {N} linked
```

## Rules

- Write via filesystem (absolute path `~/Vaults/Memory/projects/`), not `obsidian create` — backticks in content are eaten by the shell.
- Frontmatter required. Extra fields beyond base schema: `repo`, `language`, `framework`, `status`.
- Idempotent — never overwrite populated notes. Skip and report.
- Be concise — bullet points over prose. Future agents should orient in 60 seconds.
- Include `[[wikilinks]]` to related Memory notes (tools, patterns) where relevant.
- Don't duplicate repo-internal docs. Reference them: "See README.md for full setup."
