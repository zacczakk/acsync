# Ponytail Metronome Integration Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ponytail's portable rules and six skills available through Metronome's canonical V2-safe configuration while automatically tracking upstream skill updates.

**Architecture:** Treat Ponytail as an upstream content source, not an OpenCode runtime plugin. Import its six `agentskills.io` skill directories into `configs/skills/`, register them for automatic upstream synchronization, and merge only the small missing rule set into Metronome's existing canonical `AGENTS.md`. Do not add Ponytail's current V1 OpenCode plugin to the V2 plugin catalog.

**Tech Stack:** Markdown skill bundles, JSON registry, Bun/TypeScript `sync-upstream-skills.ts`, Metronome skill projection.

## Global Constraints

- Keep Metronome's `configs/instructions/AGENTS.md` as the source of truth; never replace it with Ponytail's root `AGENTS.md`.
- Keep Ponytail's six skill directories intact, including any support files.
- Use `sync: "auto"` for the six Ponytail skills so `sync-upstream-skills.ts` pulls HEAD changes automatically.
- Do not add `@dietrichgebert/ponytail` to OpenCode V2; Ponytail `v4.9.0` ships a V1-only plugin.
- Push skills and instructions through Metronome, then verify the projected V2 paths and clean worktree scope.

---

### Task 1: Import Ponytail Skills

**Files:**
- Create: `configs/skills/ponytail/SKILL.md`
- Create: `configs/skills/ponytail-review/SKILL.md`
- Create: `configs/skills/ponytail-audit/SKILL.md`
- Create: `configs/skills/ponytail-debt/SKILL.md`
- Create: `configs/skills/ponytail-gain/SKILL.md`
- Create: `configs/skills/ponytail-help/SKILL.md`

**Interfaces:**
- Consumes: `~/Repos/oss/ponytail/skills/<name>/`
- Produces: six canonical skill trees discoverable by OpenCode V2 through `~/.agents/skills/`.

- [x] **Step 1: Copy the complete upstream skill trees once**

Run from the repository root:

```bash
for name in ponytail ponytail-review ponytail-audit ponytail-debt ponytail-gain ponytail-help; do
  cp -R "$HOME/Repos/oss/ponytail/skills/$name" "configs/skills/$name"
done
```

- [x] **Step 2: Verify names and frontmatter**

Run:

```bash
for name in ponytail ponytail-review ponytail-audit ponytail-debt ponytail-gain ponytail-help; do
  test -f "configs/skills/$name/SKILL.md"
  grep -q "^name: $name$" "configs/skills/$name/SKILL.md"
  grep -q "^description:" "configs/skills/$name/SKILL.md"
done
```

Expected: exit code `0`.

---

### Task 2: Enable Automatic Upstream Sync

**Files:**
- Modify: `configs/skills/registry.json`

**Interfaces:**
- Consumes: the six existing local skill trees from Task 1.
- Produces: an auto-synced `ponytail` upstream entry consumed by `scripts/sync-upstream-skills.ts`.

- [x] **Step 1: Add the Ponytail upstream entry**

Add this member under `upstreams`:

```json
"ponytail": {
  "repo": "https://github.com/DietrichGebert/ponytail.git",
  "basePath": "skills",
  "skills": {
    "ponytail": { "sync": "auto" },
    "ponytail-review": { "sync": "auto" },
    "ponytail-audit": { "sync": "auto" },
    "ponytail-debt": { "sync": "auto" },
    "ponytail-gain": { "sync": "auto" },
    "ponytail-help": { "sync": "auto" }
  }
}
```

- [x] **Step 2: Run the automatic sync**

Run:

```bash
bun scripts/sync-upstream-skills.ts
```

Expected: the six Ponytail skills are checked against `HEAD`; any upstream differences are pulled into the canonical trees, and the temporary checkout is cleaned up.

---

### Task 3: Add the Minimalism Delta

**Files:**
- Modify: `configs/instructions/AGENTS.md`
- Modify: `docs/skills.md`

**Interfaces:**
- Consumes: Metronome's existing instruction source and the imported Ponytail skill behavior.
- Produces: always-on cross-target rules for the small Ponytail-specific gap, with documented skill inventory.

- [x] **Step 1: Add a compact canonical rule section**

Append this section to `configs/instructions/AGENTS.md`:

```markdown
## Minimalism
- Before code: YAGNI -> existing code -> stdlib -> native feature -> installed dependency -> one line -> minimum correct implementation.
- Never simplify away validation, error handling, security, accessibility, calibration, or explicit requirements.
- Mark deliberate corner cuts with `ponytail: <known ceiling>, <upgrade trigger>`.
```

- [x] **Step 2: Document the new upstream source**

Update `docs/skills.md` to report 28 active skills, add Ponytail as a six-skill upstream source, and list its six skills under the catalog. State that automatic sync is enabled for this source.

- [x] **Step 3: Validate the edited sources**

Run:

```bash
bun -e 'JSON.parse(await Bun.file("configs/skills/registry.json").text()); JSON.parse(await Bun.file("package.json").text())'
grep -n "## Minimalism\|ponytail" configs/instructions/AGENTS.md docs/skills.md configs/skills/registry.json
```

Expected: JSON parsing succeeds and all three files contain the Ponytail integration references.

---

### Task 4: Project and Verify

**Files:**
- Modify: generated target files under `~/.agents/skills/` and `~/.config/opencode/AGENTS.md` through Metronome only.
- Modify: `.metronome/manifest.json` through Metronome only.

**Interfaces:**
- Consumes: canonical skills, instructions, and registry from Tasks 1-3.
- Produces: OpenCode V2-visible skill projections and synchronized instructions without any V1 plugin entry.

- [x] **Step 1: Push the approved V2-safe scope**

Run:

```bash
metronome push --force --target opencode --type skills --type instructions
```

Expected: six skill trees and the canonical instruction file are written to the OpenCode V2 projection paths.

- [x] **Step 2: Check synchronization**

Run:

```bash
metronome check --target opencode
```

Expected: no drift for the pushed skills and instructions.

- [x] **Step 3: Verify the V2 runtime does not contain the V1 package plugin**

Run:

```bash
if grep -q "dietrichgebert/ponytail" "$HOME/.config/opencode/opencode.json"; then
  exit 1
fi
```

Expected: exit code `0`.

- [ ] **Step 4: Run the impacted repository checks**

Run:

```bash
bun test
bun scripts/check-public-repo.ts
git status --short
```

Expected: tests and public-repo checks pass; only the planned canonical files, imported skills, docs, plan, and Metronome manifest changes are present.

Result: `bun scripts/check-public-repo.ts` passed. `bun test` reported 688 passing tests and one pre-existing failure in `canonical agent routing > sets Codex base to Tux Luna at xhigh reasoning`; the committed `configs/settings/codex.json` contains the newer profile-based configuration that the stale test still rejects.
