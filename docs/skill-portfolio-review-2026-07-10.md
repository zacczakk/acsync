---
summary: July 2026 audit and implementation record for reducing metronome's global skill portfolio from 45 to 36 skills.
read_when:
  - Reducing the global skill portfolio
  - Replacing or removing Superpowers skills
  - Adding Matt Pocock skills
---

# Skill Portfolio Review

## Recommendation

Current result: **36 global skills**, down from 45. Eleven skills were removed and two narrow Matt Pocock replacements added. Do not install Matt Pocock's full collection.

## Cut First

| Candidate | Action | Why |
|---|---|---|
| `using-superpowers` | Delete | Universal 1% trigger rule causes GPT-5.6 models to load process skills before routine work. Duplicates native skill routing. |
| `writing-skills` | Deleted | 689-line duplicate of `skill-creator`, with conflicting authoring guidance. |
| `webapp-testing` | Deleted | Stale browser workflow conflicts with canonical live-Chrome `agent-browser` policy. |
| `release` | Delete | Duplicates the `release` subagent and release commands. |
| `verification-before-completion` | Move core rule to `AGENTS.md`, delete | Canonical build/test rules and `verify` agent already enforce evidence before claims. |
| `systematic-debugging` | Replaced by `diagnosing-bugs` | Matt's narrower feedback-loop workflow. |
| `test-driven-development` | Replaced by `tdd` | Explicit test-first trigger instead of mandatory process. |
| `requesting-code-review` | Deleted | Duplicated review agents and `/autoreview`. |
| `receiving-code-review` | Deleted | Useful principle, wrong form. |
| `finishing-a-development-branch` | Deleted | Conflicted with explicit-consent git policy. |
| `using-git-worktrees` | Deleted | Branch/worktree changes require consent. |
| `dispatching-parallel-agents` | Deleted | Canonical instructions already require delegation and parallelism. |
| `executing-plans` | Delete | Thin wrapper around execution agents and other skills. |
| `subagent-driven-development` | Move useful mechanics to `execute`, delete | 418-line controller runtime disguised as reusable knowledge. |

Also deleted by user decision: `doc-coauthoring` and `skill-creator`. Registry entries were removed, preventing nightly resurrection.

## Reduce Or Merge

| Candidate | Action |
|---|---|
| `brainstorming` | Delete, or narrow to novel/ambiguous one-way-door design only. Never trigger for routine feature work. |
| `writing-plans` | Explicit plan requests and substantial multi-step work only; remove forced tiny steps and commit choreography. |
| `design-critique` + `web-design-guidelines` | Merge into explicit review commands; avoid two auto-triggering review skills. |
| `make-interfaces-feel-better` | Restrict to micro-interactions and visual polish. Exclude new UI and audits. |
| `frontend-design` | Keep; restrict to new UI or substantial visual redesign. |
| `memory-retrieval` | Prefer short canonical instructions; delete skill if retrieval remains reliable without invocation. |
| `obsidian-vault-conventions` | Thin router to `~/Vaults/AGENTS.md`; stop duplicating the vault guide. |
| `session-notes` | Keep; reduce templates and align required `parent`/`summary` fields. |
| `obsidian-defuddle` | Restrict to explicit clean extraction or noisy fetch fallback. |
| `vercel-react-best-practices` | Restrict to performance work or deep React review, not every React edit. |
| `thermo-nuclear-code-quality-review` | Keep explicit-only; reduce repeated rubric text. |

## Keep

- `agent-brief`
- `grill-with-docs`
- `interface-design`, with optional rather than mandatory multi-agent comparison
- `docx`, `pdf`, `pptx`, `xlsx`
- `obsidian-markdown`, `obsidian-bases`, `obsidian-json-canvas`
- App-safe, explicit-only `obsidian-cli`
- `mcp-builder`
- `screenshot-workflow`, without implicit commit/push behavior

## Matt Pocock

Authoritative source: `mattpocock/skills`, MIT, actively maintained as of 2026-07-10.

Do **not** install the full 21-skill plugin. Its tracker/spec/ticket workflow would replace Superpowers bloat with a different workflow regime.

Evaluate only:

1. `diagnosing-bugs` replaces `systematic-debugging`.
2. `tdd` replaces mandatory Superpowers TDD.
3. `codebase-design`, `domain-modeling`, or `wayfinder` remain candidates only after a concrete gap appears.

Avoid unchanged: `setup-matt-pocock-skills`, `triage`, `to-spec`, `to-tickets`, and `implement`. They assume Matt's tracker and documentation conventions.

## Obsidian Incident

Root cause: routine vault retrieval invoked `/Applications/Obsidian.app/Contents/MacOS/obsidian` in parallel. That executable is the Electron GUI binary, not a safe headless reader. Parallel calls produced `SingletonLock` failures and extra app initialization.

Policy now: filesystem tools and `rg` for exact retrieval, `qmd` for semantic Memory retrieval, `sessions` for history. The Obsidian CLI is explicit app/plugin/theme automation only, serialized, with no retries or restart behavior.

## Portfolio Hygiene

- Remove empty retired skill directories after confirming no sync logic depends on directory presence.
- Generate `docs/skills.md` counts from `configs/skills/*/SKILL.md`; its previous 37-skill catalog had drifted from 45 active skills.
- Keep customized upstream skills on manual sync. Auto-sync currently overwrites entire directories.
- Run skill-trigger evals before adopting Matt-derived replacements. Compare invocation correctness, redundant loads, question count, and missed verification safeguards.
