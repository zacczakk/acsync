---
name: release
description: >-
  Use when preparing, running, or automating a release. Covers version bumps,
  changelog, release notes, docs freshness, CI/build gates, PII scanning for
  public repos, migration notes, asset verification, and GitHub release creation.
  Invoke when the user mentions releasing, shipping a version, cutting a release,
  tagging, bumping a version, writing release notes, or updating a changelog —
  even if they don't explicitly say "release."
---

# Release

## Overview

Orchestrate a safe, complete release. Every gate exists because skipping it has
burned someone — stale docs, leaked secrets, broken installs, missing changelogs.

**Core principle:** A release is a contract with users. Ship it clean or don't ship it.

**Announce at start:** "Using the release skill to guide this release."

## Step 0: Determine Version Bump

If the user hasn't specified major, minor, or patch, ask immediately:

```
What kind of release is this?

1. Patch  — bug fixes, no new features, no breaking changes
2. Minor  — new features, backward-compatible
3. Major  — breaking changes (requires migration notes)
```

Don't proceed until you have an answer. If the diff makes it obvious (e.g., only
a typo fix → patch), state your assessment and confirm: "This looks like a patch.
Correct?"

## Step 1: Pre-flight Checks

Run these in parallel where possible. Every check must pass before proceeding.

### 1a. Git Hygiene

- Clean working tree (`git status` — no uncommitted changes)
- On the correct branch (main/master, or a release branch)
- Up to date with remote (`git fetch && git status` — no behind commits)
- No merge conflicts pending

### 1b. Build & Test Gate

Run the full verification suite — not partial, not cached:

```
lint → typecheck → test suite → build
```

All four must pass. If any fail, stop and report. Don't proceed with "it'll
probably be fine."

### 1c. CI Status

```bash
gh run list --limit 5
```

Latest CI run on the release branch must be green. If it's pending, wait. If
it's red, stop and fix.

### 1d. Dependency Check

Quick scan for known issues:

```bash
# npm/bun projects
npm audit --audit-level=high 2>/dev/null || bun pm audit 2>/dev/null

# Python projects
pip-audit 2>/dev/null || safety check 2>/dev/null
```

Report vulnerabilities at high/critical severity. Don't block on low/moderate
unless the user asks, but surface them.

### 1e. Public Repo: PII & Secrets Scan

**Only for public repositories.** Check visibility:

```bash
gh repo view --json isPrivate --jq '.isPrivate'
```

If public, scan for leaks before release:

- **Secrets:** Look for hardcoded API keys, tokens, passwords, connection strings
  in tracked files. Check `.env` isn't committed. Check for common patterns:
  `API_KEY=`, `SECRET=`, `password`, `token`, base64-encoded credentials.
- **Personal info:** Grep for email addresses, phone numbers, internal URLs,
  internal hostnames, employee names in code comments or configs.
- **File check:** Ensure `.gitignore` covers `.env`, `*.pem`, `*.key`,
  credentials files.

If anything surfaces, stop and report. Never release with exposed secrets.

## Step 2: Docs Freshness

Delegate to `@docs` subagent. If `@docs` is unavailable, do the audit inline:

1. Review `git diff` since last release tag
2. Map changed behavior to affected docs
3. Verify README, setup guides, API docs, migration notes are current
4. Flag stale docs, dead links, missing examples

**Gate:** Docs must be current before proceeding. If `@docs` reports gaps, fix
them first.

## Step 3: Changelog

### If changelog exists

- Read existing format and follow it exactly
- Add entries for all user-visible changes since the last release
- Group by category: Added, Changed, Fixed, Removed, Deprecated, Security
- Each entry explains user impact, not implementation details

### If no changelog exists

- Create `CHANGELOG.md` at repo root
- Use [Keep a Changelog](https://keepachangelog.com/) format
- Backfill the current release; don't attempt to reconstruct full history

### Quality bar

- Bad: "Updated utils.ts" / "Refactored auth module"
- Good: "Fixed login failing silently when session expires" / "Added CSV export
  for usage reports"

## Step 4: Migration & Breaking Changes

**Major releases require this. Minor/patch: skip unless something changed that
could break existing usage.**

If breaking changes exist:

1. Document every breaking change with before/after examples
2. Provide an upgrade path — step-by-step instructions
3. Add migration notes to both the changelog and release notes
4. If the repo has a `MIGRATION.md` or `UPGRADING.md`, update it

## Step 5: Version Bump

Update version in all relevant files. Common locations:

- `package.json` / `pyproject.toml` / `Cargo.toml` / `version.swift`
- Lock files (regenerate, don't hand-edit)
- Version constants in source code (`__version__`, `VERSION`)

Commit the version bump with `committer`:
```
chore: bump version to <X.Y.Z>
```

## Step 6: Asset Verification

Verify built artifacts are correct and complete:

```bash
# npm: check package contents
npm pack --dry-run

# Python: build and check
uv build && twine check dist/*

# General: verify the build output exists and looks right
ls -la dist/ build/ out/
```

If the project produces binaries, installers, or Docker images — verify they
build successfully. Don't trust that "the build step passed" means the artifact
is correct; inspect it.

## Step 7: Tag & Release

### Tag Strategy

Semver tags, always prefixed with `v`:

```bash
git tag -a v<X.Y.Z> -m "Release v<X.Y.Z>"
git push origin v<X.Y.Z>
```

### Release Branch Strategy

- **Patch/Minor:** Tag on main. No release branch needed.
- **Major:** Optionally create a release branch (`release/vX`) before tagging,
  so hotfixes to the previous major can land on `release/v(X-1)` without
  backport gymnastics. Ask the user if they want a release branch for majors.

### GitHub Release

```bash
gh release create v<X.Y.Z> --title "v<X.Y.Z>" --notes-file <release-notes-file>
```

Or with inline notes using a heredoc. Attach built artifacts if the project
produces distributable files.

## Step 8: Release Notes

Release notes are the public face of the release. They deserve real effort.

### Structure

```markdown
## v<X.Y.Z>

<One-sentence summary of the theme or most important change.>

### Highlights
- <Most impactful change, explained for users>
- <Second most impactful>

### Breaking Changes (major only)
- <What broke, why, and how to migrate>

### Added
- <New features>

### Changed
- <Behavior changes>

### Fixed
- <Bug fixes>

### Contributors
- @handle — <what they contributed>
```

### Quality bar

- Write for users, not developers. "What changed for me?" not "What files were
  touched."
- Lead with impact. The most important change goes first.
- Credit contributors. Check `git log` for external contributors.
- Link to issues/PRs where helpful.

## Step 9: Post-Release

1. Verify the GitHub release is live and correct
2. Verify CI ran on the tag (if tag-triggered CI exists)
3. Report: tag created, release URL, any follow-up items

## Common Mistakes

**Releasing with stale docs**
- Problem: Users read outdated setup instructions, file issues
- Fix: `@docs` audit is a hard gate, not a nice-to-have

**Changelog entries that describe code, not impact**
- Problem: "Refactored UserService" tells users nothing
- Fix: Describe what changed for them: "Fixed intermittent logout on mobile"

**Skipping the build gate**
- Problem: Tagged a broken build; users install garbage
- Fix: Full lint → typecheck → test → build. Every time.

**Forgetting version files**
- Problem: `package.json` says 1.2.0 but `--version` flag says 1.1.0
- Fix: Search for all version references before committing

**Releasing secrets in a public repo**
- Problem: API key in a config file ships to the world
- Fix: PII/secrets scan is mandatory for public repos

## Red Flags — STOP

**Never:**
- Release with failing tests or red CI
- Release without checking docs freshness
- Release a public repo without a secrets scan
- Tag before the version bump commit
- Force-push a release tag
- Skip changelog for user-visible changes

**Always:**
- Confirm version bump type before starting
- Run full build/test gate
- Update changelog with user-facing descriptions
- Verify built artifacts
- Credit contributors in release notes

## Integration

**Delegates to:**
- `@docs` — docs freshness audit (Step 2)
- `@release` agent — can handle execution of Steps 5-8 if dispatched

**Called after:**
- `finishing-a-development-branch` — when the user chooses to release
- `executing-plans` / `subagent-driven-development` — milestone releases

**Pairs with:**
- `verification-before-completion` — the build/test gate is this skill's application of that principle
- `requesting-code-review` — review before release, not after
