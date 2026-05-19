# Memory Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new custom `memory-retrieval` skill that routes retrieval to Knowledge vs Memory by information type, keeps sessions last, and updates the skill catalog/fixtures so skill sync stays tested.

**Architecture:** Keep the change content-only. Add one new custom skill under `configs/skills/`, register it in the human-readable skill registry, add canonical plus per-target golden fixtures for skill sync tests, and update the skills catalog to reflect the new custom skill and current counts. Verify with the existing Bun test suite that already covers skill rendering and push behavior.

**Tech Stack:** Markdown skills, Bun test runner, fixture-driven skill sync tests

---

## File Map

- Create: `configs/skills/memory-retrieval/SKILL.md`
  - new retrieval workflow skill with Knowledge-vs-Memory routing and sessions-last fallback
- Modify: `configs/skills/REGISTRY.md`
  - add `memory-retrieval` under Custom and bump custom count
- Modify: `docs/skills.md`
  - add the new skill to Custom Skills
  - fix the stale total skill count and custom-count summary
- Create: `test/fixtures/canonical/skills/memory-retrieval/SKILL.md`
  - canonical fixture copied into temp test projects by push E2E tests
- Create: `test/fixtures/claude/skills/memory-retrieval/SKILL.md`
  - expected Claude output
- Create: `test/fixtures/opencode/skills/memory-retrieval/SKILL.md`
  - expected OpenCode output
- Create: `test/fixtures/gemini/skills/memory-retrieval/SKILL.md`
  - expected Gemini output
- Create: `test/fixtures/codex/skills/memory-retrieval/SKILL.md`
  - expected Codex output
- Modify: `test/__tests__/push-skills.test.ts`
  - assert the new skill is pushed to all targets and matches goldens

## Task 1: Add the New Skill Content

**Files:**
- Create: `configs/skills/memory-retrieval/SKILL.md`
- Test: `configs/skills/memory-retrieval/SKILL.md`

- [ ] **Step 1: Write the new skill file with frontmatter and routing rules**

Create `configs/skills/memory-retrieval/SKILL.md` with this content:

```md
---
name: memory-retrieval
description: >-
  Use when exploring a codebase or answering questions that may already be
  captured in Knowledge, Memory, qmd, or session history. Use before broad repo
  search, before reading many files, and before asking the user about prior
  decisions, existing patterns, setup, reference material, or repo context.
---

# Memory Retrieval

Route to the right source first. Search before reading. Curated vault notes before raw transcripts.

## When to Use

Use this skill:

1. before open-ended codebase exploration
2. before reading many files to learn how something works
3. before asking the user about prior decisions, setup, or reference material
4. before using session history for repository knowledge

## Source Selection

### Knowledge first

Use `Knowledge` first for user-authored durable truth:

- docs
- setup/config reference
- backlog/reference notes
- personal reference material
- durable guidance that should outrank agent notes

### Memory first

Use `Memory` first for agent-managed operational context:

- codebase exploration
- repo context
- prior implementation decisions
- existing patterns
- recent discoveries
- project/tool learnings written by agents

**Bias rule:**

- Codebase exploration -> Memory first
- General reference lookup -> Knowledge first

## Retrieval Order

1. Choose the source: Knowledge or Memory.
2. Search inside that source.
3. Escalate only if the vault lookup misses.
4. Session history last.

## Tool Choice

| Need | Tool |
|------|------|
| User-authored docs/setup/reference | `obsidian vault=Knowledge search:context query="..."` |
| Exact keyword in Memory note | `obsidian vault=Memory search:context query="..."` |
| Curated fuzzy recall about repo/tool/pattern | `qmd query "..." -c memory` |
| Broader semantic recall across indexed vault content | `qmd query "..."` |
| Exact phrase from old sessions | `sessions search "..."` |
| Fuzzy historical session recall | `sessions find "..."` |

## Command Patterns

```bash
# Memory first: best default for codebase exploration
qmd query "how does auth work" -c memory

# Exact lookup in Memory
obsidian vault=Memory search:context query="auth middleware"

# Knowledge first for docs/setup/reference
obsidian vault=Knowledge search:context query="Claude config"

# Only after vault lookup misses
sessions search "auth middleware"
sessions find "how did we handle auth errors"
```

After a search hit:

1. read only the winning note or file
2. avoid broad folder dumps
3. avoid bulk file reads until vault context proves insufficient

## Common Mistakes

- jumping straight to `sessions search` for repo understanding
- reading many repo files before checking Memory for repo context
- ignoring Knowledge when the likely source is user-authored reference
- using cross-collection `qmd query` first when `-c memory` is enough
- treating raw session transcripts as more authoritative than curated vault notes
```

- [ ] **Step 2: Verify the skill file matches the approved design before running tests**

Read the new file and confirm all of these are present:

```text
name: memory-retrieval
Knowledge first for user-authored durable truth
Memory first for agent-managed operational context
Codebase exploration -> Memory first
General reference lookup -> Knowledge first
sessions search / sessions find only after vault lookup misses
```

- [ ] **Step 3: Run a focused readback check on the new skill file**

Run:

```bash
rg -n "Knowledge first|Memory first|sessions search|sessions find|qmd query" configs/skills/memory-retrieval/SKILL.md
```

Expected:

```text
matches for the Knowledge-first rule, Memory-first rule, qmd memory lookup, and both session fallback commands
```

## Task 2: Register the Skill and Update Skill Docs

**Files:**
- Modify: `configs/skills/REGISTRY.md`
- Modify: `docs/skills.md`
- Test: `configs/skills/REGISTRY.md`
- Test: `docs/skills.md`

- [ ] **Step 1: Add `memory-retrieval` to the custom registry section**

Update `configs/skills/REGISTRY.md` by changing the Custom section from this:

```md
## Custom (5)

| Skill | Description |
|-------|-------------|
| obsidian-vault-conventions | Vault layout, lifecycle, naming conventions |
| release | Release orchestration: version bumps, changelog, docs, CI gates, PII scan, tagging |
| session-notes | Atomic session note capture templates |
| screenshot-workflow | Screenshot asset pipeline (macOS) |
```

to this:

```md
## Custom (6)

| Skill | Description |
|-------|-------------|
| memory-retrieval | Retrieval routing across Knowledge, Memory, qmd, and sessions with sessions last |
| obsidian-vault-conventions | Vault layout, lifecycle, naming conventions |
| release | Release orchestration: version bumps, changelog, docs, CI gates, PII scan, tagging |
| session-notes | Atomic session note capture templates |
| screenshot-workflow | Screenshot asset pipeline (macOS) |
```

- [ ] **Step 2: Update the skills catalog counts and inventory**

Edit `docs/skills.md` to make these exact changes:

1. frontmatter summary line:

```md
summary: Skills catalog — all 37 on-demand skills with sources, triggers, and trimming notes.
```

2. top-of-doc count line:

```md
37 skills in `configs/skills/`, synced to all targets via `metronome push`.
```

3. source-count table row for Custom:

```md
| Custom | this repo | 12 | Obsidian (6), design (2), workflow (4) |
```

4. add this row to the `### Custom Skills` table, above `obsidian-markdown`:

```md
| `memory-retrieval` | Memory/Knowledge/qmd/session lookup before broad repo search or multi-file reads | — |
```

- [ ] **Step 3: Verify both docs now mention the new skill and corrected counts**

Run:

```bash
rg -n "memory-retrieval|Custom \(6\)|all 37 on-demand skills|37 skills in|workflow \(4\)" configs/skills/REGISTRY.md docs/skills.md
```

Expected:

```text
matches in REGISTRY.md for the new custom entry and Custom (6), plus matches in docs/skills.md for the corrected 37-skill count, workflow (4), and custom-skill row
```

## Task 3: Add Canonical and Target Golden Fixtures

**Files:**
- Create: `test/fixtures/canonical/skills/memory-retrieval/SKILL.md`
- Create: `test/fixtures/claude/skills/memory-retrieval/SKILL.md`
- Create: `test/fixtures/opencode/skills/memory-retrieval/SKILL.md`
- Create: `test/fixtures/gemini/skills/memory-retrieval/SKILL.md`
- Create: `test/fixtures/codex/skills/memory-retrieval/SKILL.md`
- Test: `test/fixtures/**/skills/memory-retrieval/SKILL.md`

- [ ] **Step 1: Copy the canonical skill content into the canonical fixture**

Create `test/fixtures/canonical/skills/memory-retrieval/SKILL.md` with the exact same content as `configs/skills/memory-retrieval/SKILL.md`.

- [ ] **Step 2: Copy the same content into all 4 target fixtures**

Create these files with identical content to the canonical fixture:

```text
test/fixtures/claude/skills/memory-retrieval/SKILL.md
test/fixtures/opencode/skills/memory-retrieval/SKILL.md
test/fixtures/gemini/skills/memory-retrieval/SKILL.md
test/fixtures/codex/skills/memory-retrieval/SKILL.md
```

Use identical contents because current skill rendering preserves the markdown body and frontmatter across targets; target differences are path-only, not content-level.

- [ ] **Step 3: Verify all 5 fixture files exist**

Run:

```bash
test -f test/fixtures/canonical/skills/memory-retrieval/SKILL.md && \
test -f test/fixtures/claude/skills/memory-retrieval/SKILL.md && \
test -f test/fixtures/opencode/skills/memory-retrieval/SKILL.md && \
test -f test/fixtures/gemini/skills/memory-retrieval/SKILL.md && \
test -f test/fixtures/codex/skills/memory-retrieval/SKILL.md
```

Expected:

```text
command exits successfully with no output
```

## Task 4: Extend the Push Skill E2E Test

**Files:**
- Modify: `test/__tests__/push-skills.test.ts`
- Test: `test/__tests__/push-skills.test.ts`

- [ ] **Step 1: Add assertions for the new skill in the golden-fixture push test**

Insert this block in `test/__tests__/push-skills.test.ts` after the existing `design-critique` assertions inside `test('pushes skills to all 4 targets matching golden fixtures', ...)`:

```ts
    const claudeMemoryRetrieval = readFileSync(
      join(paths.claude, 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    const claudeMemoryRetrievalGolden = readFileSync(
      join(FIXTURE_ROOT, 'claude', 'skills', 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    expect(claudeMemoryRetrieval).toBe(claudeMemoryRetrievalGolden);

    const opencodeMemoryRetrieval = readFileSync(
      join(paths.opencode, 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    const opencodeMemoryRetrievalGolden = readFileSync(
      join(FIXTURE_ROOT, 'opencode', 'skills', 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    expect(opencodeMemoryRetrieval).toBe(opencodeMemoryRetrievalGolden);

    const geminiMemoryRetrieval = readFileSync(
      join(paths.gemini, 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    const geminiMemoryRetrievalGolden = readFileSync(
      join(FIXTURE_ROOT, 'gemini', 'skills', 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    expect(geminiMemoryRetrieval).toBe(geminiMemoryRetrievalGolden);

    const codexMemoryRetrieval = readFileSync(
      join(paths.codex, 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    const codexMemoryRetrievalGolden = readFileSync(
      join(FIXTURE_ROOT, 'codex', 'skills', 'memory-retrieval', 'SKILL.md'),
      'utf-8',
    );
    expect(codexMemoryRetrieval).toBe(codexMemoryRetrievalGolden);
```

- [ ] **Step 2: Run the push-skills E2E test and confirm it passes**

Run:

```bash
bun test test/__tests__/push-skills.test.ts
```

Expected:

```text
3 tests pass in push-skills E2E, including the new memory-retrieval golden checks
```

## Task 5: Run the Final Verification Set

**Files:**
- Modify: `configs/skills/memory-retrieval/SKILL.md`
- Modify: `configs/skills/REGISTRY.md`
- Modify: `docs/skills.md`
- Modify: `test/__tests__/push-skills.test.ts`
- Create: `test/fixtures/**/skills/memory-retrieval/SKILL.md`

- [ ] **Step 1: Run the skill adapter unit tests**

Run:

```bash
bun test src/adapters/__tests__/skills.test.ts
```

Expected:

```text
all skill adapter tests pass
```

- [ ] **Step 2: Run the push-skills E2E test again as the final gate**

Run:

```bash
bun test test/__tests__/push-skills.test.ts
```

Expected:

```text
all push-skills tests pass with the new fixture set
```

- [ ] **Step 3: Do a targeted push dry-run to verify the canonical skill set is renderable**

Run:

```bash
bun run src/cli/index.ts push --dry-run --type skills --json
```

Expected:

```text
JSON output describing skill drift or no-drift, with no runtime errors
```

- [ ] **Step 4: Commit**

Run:

```bash
git add \
  configs/skills/memory-retrieval/SKILL.md \
  configs/skills/REGISTRY.md \
  docs/skills.md \
  test/fixtures/canonical/skills/memory-retrieval/SKILL.md \
  test/fixtures/claude/skills/memory-retrieval/SKILL.md \
  test/fixtures/opencode/skills/memory-retrieval/SKILL.md \
  test/fixtures/gemini/skills/memory-retrieval/SKILL.md \
  test/fixtures/codex/skills/memory-retrieval/SKILL.md \
  test/__tests__/push-skills.test.ts \
  docs/superpowers/specs/2026-04-22-memory-retrieval-design.md \
  docs/superpowers/plans/2026-04-22-memory-retrieval.md
git commit -m "feat: add memory retrieval skill"
```

Expected:

```text
a new commit containing the skill, docs, fixtures, tests, spec, and plan
```
