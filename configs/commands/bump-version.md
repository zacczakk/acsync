---
description: >-
  Bump version (major|minor|patch), update all version strings, commit,
  tag, push, and create a GitHub release. Usage: /bump-version patch
agent: release
---

# Bump Version

Bump the project version, commit all changes, push to remote, tag, and create a GitHub release.

User input: $ARGUMENTS

## Steps

### 1. Parse arguments

- Accept exactly one argument: `major`, `minor`, or `patch`.
- If missing or invalid: reply with usage and stop.

### 2. Detect project type and read current version

Detect the project type by checking which file exists at the project root (first match wins):

| File | Project type | Version location |
|------|-------------|-----------------|
| `package.json` | Node / Bun | `"version": "X.Y.Z"` |
| `pyproject.toml` | Python | `[project] version = "X.Y.Z"` |
| `Cargo.toml` | Rust | `[package] version = "X.Y.Z"` |

If none found: stop, ask the user which file holds the version.

- Read the current version from the detected file.
- Compute the next version by bumping the requested component (semver).
- Print: `Bumping: v{current} → v{next}`

### 3. Pre-release checks

Before touching any files, verify the release is safe:

1. **Clean working tree** — `git status --porcelain` must be empty. If dirty: stop, show status, ask user to resolve.
2. **On main/master** — must be on the primary branch. If not: warn and confirm before proceeding.
3. **Up to date with remote** — `git fetch origin && git status` must not show "behind". If behind: stop, ask user to pull first.
4. **Tag doesn't exist** — `git tag -l "v{next}"` must be empty. If tag exists: stop, report conflict.
5. **Docs and README are current** — review `docs/`, `README.md`, and `docs/changelog.md` for staleness. If any doc references outdated behavior, stale version numbers, or is missing coverage for recent changes: stop, list what needs updating, and ask user to fix before releasing. Do not skip this step.
6. **Tests pass** — run the project's test suite. If tests fail: stop, report failures.
7. **Build succeeds** — run the project's build command. If build fails: stop, report errors.
8. **No personal information disclosed** — scan all tracked files (excluding lockfiles and `.git/`) for leaked personal information. Look for:
   - Real names, usernames, or handles (outside CONTRIBUTORS/AUTHORS files)
   - Absolute home-directory paths (e.g., `/Users/…`, `/home/…`, `C:\Users\…`)
   - Machine-specific paths or hostnames
   - API keys, tokens, passwords, or secrets (even if placeholders look real)
   - Email addresses (outside CONTRIBUTORS/AUTHORS files)
   - Private IP addresses or internal URLs
   If any are found: stop, list each occurrence with file and line number, and ask the user to fix before releasing. Do not skip this step.

### 4. Update version strings

1. **Update the canonical version file** detected in step 2.
2. **Scan for other occurrences** of the old version string across the repo, excluding: `.git/`, `node_modules/`, `__pycache__/`, `dist/`, `build/`, `target/`, lockfiles (`bun.lockb`, `package-lock.json`, `uv.lock`, `Cargo.lock`, `poetry.lock`).
3. For each match: determine if it's a release version reference or something unrelated (e.g., a dependency pin, a schema/format version, a changelog entry). Update release version references. Leave unrelated matches alone. If ambiguous: show the match and ask.

### 5. Commit

```bash
committer "chore: bump version to vX.Y.Z" <all files modified in step 4>
```

### 6. Create annotated tag

```bash
git tag -a "vX.Y.Z" -m "vX.Y.Z"
```

### 7. Push

```bash
git push origin main
git push origin "vX.Y.Z"
```

If push fails (permissions, hooks, etc.): stop and report. Do not force-push.

### 8. Create GitHub release

```bash
gh release create "vX.Y.Z" --title "vX.Y.Z" --generate-notes
```

Use `--generate-notes` to auto-generate release notes from commits since the last tag.

### 9. Report

Print a summary:

```
Released vX.Y.Z
  Tag:     vX.Y.Z
  Commit:  {short hash}
  Release: {gh release URL}
```

## Rules

- Never force-push. If push is rejected, stop and report.
- Never skip the docs/README check. Stale docs = blocked release.
- Never skip tests or build. Failures = blocked release.
- Only bump release version references. Leave dependency pins, schema/format versions, and changelog entries untouched.
- If anything fails mid-flow (after commit but before push/release), report what succeeded and what's pending so the user can recover.
- Use Conventional Commits format for the bump commit.
