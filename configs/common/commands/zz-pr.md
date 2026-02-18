---
description: Create or update a PR with auto-generated description.
argument-hint: [title]
allowed-tools: [Read, Glob, Grep, Bash]
---

# /zz-pr — Create or Update a Pull Request

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Create or update a GitHub PR with an auto-generated description derived from
commit history, task checklists, and CI status.

## Procedure

### Step 1: Detect base branch

```bash
git branch -r | grep -E 'origin/(main|master)$' | head -1 | sed 's|origin/||'
```

Use `main` if both exist. Fail if neither exists.

### Step 2: Gather commit history

```bash
git log {base}..HEAD --oneline --no-merges
```

If no commits ahead of base: warn user "nothing to PR" and stop.

### Step 3: Auto-generate PR description

Build the description from commit messages:

```markdown
## Summary
<!-- Categorize commits -->

### Features
- feat: add widget support (abc1234)

### Fixes
- fix: resolve null pointer in parser (def5678)

### Other
- refactor: simplify auth flow (ghi9012)

## Changes
- List of key changes derived from diffs

## Checklist
<!-- If docs/plans/*/PLAN.md files exist -->
- [x] Completed item from task checklist
- [ ] Remaining item from task checklist

## Linked Issues
<!-- Extract #NNN patterns from commit messages -->
Closes #42, relates to #58
```

### Step 4: Check CI status

```bash
gh run list -L1 --json conclusion,status,name
```

- CI green → include "CI: passing" in description
- CI red → warn user: "CI is currently failing — PR will be created but may need fixes"
- CI pending → note it in description

### Step 5: Create or update PR

Check if a PR already exists for this branch:

```bash
gh pr view --json number,url 2>/dev/null
```

**If PR exists:** update the description:
```bash
gh pr edit {number} --body "{description}"
```

**If no PR:** create one:
```bash
gh pr create --title "{title}" --body "{description}"
```

Title resolution (in order of preference):
1. `$ARGUMENTS` if provided
2. Derive from branch name (e.g., `feat/add-widget` → "Add widget")
3. First commit message summary

### Step 6: Return result

Output the PR URL and a brief summary:

```
PR #42: Add widget support
https://github.com/org/repo/pull/42

  3 commits (2 feat, 1 fix)
  CI: passing
  Tasks: 5/6 checklist items complete
```
