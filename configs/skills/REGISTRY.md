# Skill Registry

Source of truth for skill origins, upstream sources, and sync strategy.
Machine-readable companion: `registry.json` (consumed by `scripts/sync-upstream-skills.ts`).

## Sync Strategies

- **auto** — nightly workflow pulls upstream changes, overwrites local copy
- **manual** — nightly workflow flags upstream diffs in summary report, does not overwrite

## Remote: anthropics/skills (6)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| docx | docx | docx | No | auto |
| frontend-design | frontend-design | frontend-design | Minor (attribution) | auto |
| mcp-builder | mcp-builder | mcp-builder | No | auto |
| pdf | pdf | pdf | No | auto |
| pptx | pptx | pptx | No | auto |
| xlsx | xlsx | xlsx | No | auto |

## Remote: vercel-labs/agent-skills (2)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| react-best-practices | react-best-practices | vercel-react-best-practices | Yes (AGENTS.md blocked) | manual |
| web-design-guidelines | web-design-guidelines | web-design-guidelines | No | auto |

## Remote: kepano/obsidian-skills (5)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| obsidian-cli | obsidian-cli | obsidian-cli | Yes (app-safety guard) | manual |
| defuddle | defuddle | obsidian-defuddle | Renamed | auto |
| obsidian-markdown | obsidian-markdown | obsidian-markdown | No | auto |
| json-canvas | json-canvas | obsidian-json-canvas | Renamed | auto |
| obsidian-bases | obsidian-bases | obsidian-bases | No | auto |

## Remote: obra/superpowers (6)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| brainstorming | brainstorming | brainstorming | No | auto |
| executing-plans | executing-plans | executing-plans | Yes (removed skill references) | manual |
| subagent-driven-development | subagent-driven-development | subagent-driven-development | Yes (local verify/TDD routing) | manual |
| using-superpowers | using-superpowers | using-superpowers | Yes (diagnosing-bugs routing) | manual |
| verification-before-completion | verification-before-completion | verification-before-completion | No | auto |
| writing-plans | writing-plans | writing-plans | Yes (worktree consent guard) | manual |

## Remote: mattpocock/skills (2)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| diagnosing-bugs | diagnosing-bugs | diagnosing-bugs | Yes (removed unavailable architecture skill handoff) | manual |
| tdd | tdd | tdd | Yes (removed unavailable code-review handoff) | manual |

## Remote: cursor/plugins (1)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| thermo-nuclear-code-quality-review | thermo-nuclear-code-quality-review | thermo-nuclear-code-quality-review | No | manual |

## Remote: jakubkrehel/make-interfaces-feel-better (1)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| make-interfaces-feel-better | make-interfaces-feel-better | make-interfaces-feel-better | No | manual |

## Project-Local Skills (not synced globally)

`oe-*` skills from `organization/project` are project-specific. Add them locally per project as needed — not tracked here.

## Custom (9)

| Skill | Description |
|-------|-------------|
| agent-brief | Durable implementation brief for autonomous agent handoff |
| design-critique | UI hierarchy, cognitive load, and anti-slop review |
| grill-with-docs | Requirements and implementation stress-testing against project docs |
| interface-design | Public interface and hard-to-change boundary design |
| memory-retrieval | Retrieval routing across Knowledge, Memory, qmd, and sessions with sessions last |
| obsidian-vault-conventions | Vault layout, lifecycle, naming conventions |
| release | Release orchestration: version bumps, changelog, docs, CI gates, PII scan, tagging |
| session-notes | Atomic session note capture templates |
| screenshot-workflow | Screenshot asset pipeline (macOS) |
