# Skill Registry

Source of truth for skill origins, upstream sources, and sync strategy.
Machine-readable companion: `registry.json` (consumed by `scripts/sync-upstream-skills.ts`).

## Sync Strategies

- **auto** — nightly workflow pulls upstream changes, overwrites local copy
- **manual** — nightly workflow flags upstream diffs in summary report, does not overwrite

## Remote: anthropics/skills (9)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| doc-coauthoring | doc-coauthoring | doc-coauthoring | No | auto |
| docx | docx | docx | No | auto |
| frontend-design | frontend-design | frontend-design | Minor (attribution) | auto |
| mcp-builder | mcp-builder | mcp-builder | No | auto |
| pdf | pdf | pdf | No | auto |
| pptx | pptx | pptx | No | auto |
| skill-creator | skill-creator | skill-creator | No | auto |
| webapp-testing | webapp-testing | webapp-testing | Yes (agent-browser section) | manual |
| xlsx | xlsx | xlsx | No | auto |

## Remote: vercel-labs/agent-skills (2)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| react-best-practices | react-best-practices | vercel-react-best-practices | No | auto |
| web-design-guidelines | web-design-guidelines | web-design-guidelines | No | auto |

## Remote: kepano/obsidian-skills (5)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| obsidian-cli | obsidian-cli | obsidian-cli | No | auto |
| defuddle | defuddle | obsidian-defuddle | Renamed | auto |
| obsidian-markdown | obsidian-markdown | obsidian-markdown | No | auto |
| json-canvas | json-canvas | obsidian-json-canvas | Renamed | auto |
| obsidian-bases | obsidian-bases | obsidian-bases | No | auto |

## Remote: obra/superpowers (14)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| brainstorming | brainstorming | brainstorming | No | auto |
| dispatching-parallel-agents | dispatching-parallel-agents | dispatching-parallel-agents | No | auto |
| executing-plans | executing-plans | executing-plans | No | auto |
| finishing-a-development-branch | finishing-a-development-branch | finishing-a-development-branch | No | auto |
| receiving-code-review | receiving-code-review | receiving-code-review | No | auto |
| requesting-code-review | requesting-code-review | requesting-code-review | No | auto |
| subagent-driven-development | subagent-driven-development | subagent-driven-development | No | auto |
| systematic-debugging | systematic-debugging | systematic-debugging | No | auto |
| test-driven-development | test-driven-development | test-driven-development | No | auto |
| using-git-worktrees | using-git-worktrees | using-git-worktrees | No | auto |
| using-superpowers | using-superpowers | using-superpowers | No | auto |
| verification-before-completion | verification-before-completion | verification-before-completion | No | auto |
| writing-plans | writing-plans | writing-plans | No | auto |
| writing-skills | writing-skills | writing-skills | No | auto |

## Remote: jakubkrehel/make-interfaces-feel-better (1)

| Skill | Upstream Name | Local Name | Customized | Sync |
|-------|--------------|------------|------------|------|
| make-interfaces-feel-better | make-interfaces-feel-better | make-interfaces-feel-better | No | manual |

## Custom (6)

| Skill | Description |
|-------|-------------|
| memory-retrieval | Retrieval routing across Knowledge, Memory, qmd, and sessions with sessions last |
| obsidian-vault-conventions | Vault layout, lifecycle, naming conventions |
| release | Release orchestration: version bumps, changelog, docs, CI gates, PII scan, tagging |
| session-notes | Atomic session note capture templates |
| screenshot-workflow | Screenshot asset pipeline (macOS) |
