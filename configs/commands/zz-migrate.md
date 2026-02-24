---
description: Step-by-step dependency migration. Spawns zz-migrator agent.
argument-hint: <dependency> [target-version]
allowed-tools: [Read, Glob, Grep, Edit, Write, Bash, mcp__*]
---

# /zz-migrate — Dependency Migration

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Step-by-step migration of a dependency to a target version.
Spawns a zz-migrator subagent that reads changelogs, identifies breaking changes,
and applies the migration.

## Arguments

`$ARGUMENTS` = `<dependency> [target-version]`

- First word: dependency name (required)
- Second word: target version (optional, defaults to "latest")

Examples:
- `/zz-migrate react 19` — migrate React to v19
- `/zz-migrate next` — migrate Next.js to latest
- `/zz-migrate ruff 0.8` — migrate ruff to 0.8.x

If no arguments provided, prompt:
> "Which dependency should I migrate? Usage: `/zz-migrate <dependency> [target-version]`"

## Procedure

### 1. Parse arguments and detect current version

Parse dependency name and target version from `$ARGUMENTS`.

Detect current version from the appropriate manifest:
- `package.json` → Node dependencies
- `pyproject.toml` → Python dependencies
- `Cargo.toml` → Rust dependencies
- `Package.swift` → Swift dependencies
- `go.mod` → Go dependencies

If dependency not found in any manifest, warn user and stop.

### 2. Resolve target version

If target version is "latest" or omitted:
- Check the registry for the latest stable version
- Use MCP tools or web search to find the current latest

### 3. Spawn zz-migrator agent

Spawn a subagent (see docs/subagent.md) with:
- Dependency name
- Current version
- Target version
- Project type and manifest location

The zz-migrator agent should:
1. Read the changelog/migration guide for the target version (use MCP/web)
2. Identify breaking changes between current and target versions
3. Find all usages of the dependency in the codebase
4. Apply migration steps one by one
5. Update the manifest version
6. Run install (`npm install`, `uv sync`, `cargo update`, etc.)
7. Run the gate (lint/types/tests/build) to verify nothing broke

### 4. Present results

```
Migration: react 18.2.0 → 19.0.0

  Breaking changes applied:
    1. Removed legacy context API usage (3 files)
    2. Updated forwardRef → ref prop (12 components)
    3. Replaced ReactDOM.render → createRoot (1 file)

  Gate: PASS (lint ✓, types ✓, tests ✓, build ✓)

  Files modified: 16
```

If the gate fails after migration, the agent should attempt to fix issues.
If it can't resolve them, report what's broken and suggest manual steps.
