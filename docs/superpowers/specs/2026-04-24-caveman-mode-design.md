# Caveman Mode Design

## Goal

Add a centrally managed `caveman` mode in metronome for OpenCode, Claude, and Codex. The mode must be optional, intensity-based (`lite`, `full`, `ultra`), sticky across a session once activated, and reversible with explicit disable commands including `/caveman off` and `/caveman stop`.

Gemini is out of scope for the first implementation.

## Non-Goals

- No Wenyan / classical-Chinese modes in v1.
- No statusline badges.
- No compression pipeline port in v1.
- No commit/review/compress submodes from the upstream caveman repo.
- No always-on caveman base personality at startup.

## User Experience

### Commands

Supported explicit commands in all target CLIs:

- `/caveman`
- `/caveman lite`
- `/caveman full`
- `/caveman ultra`
- `/caveman off`
- `/caveman stop`

Behavior:

- `/caveman` activates the configured default level. Default is `full` unless overridden by canonical caveman config.
- `/caveman lite|full|ultra` activates the requested level.
- `/caveman off|stop` disables caveman mode immediately.
- `normal mode` and `stop caveman` are treated as natural-language deactivation aliases when the target runtime can inspect prompt text.

### Persistence

- Once activated, caveman mode remains active for the session until disabled or the session ends.
- Intensity changes persist immediately.
- If the user resumes a session and the target CLI re-runs startup hooks, the last active mode is restored from a small state file.

### Safety / Clarity Carve-outs

Even when caveman is active, the agent should temporarily fall back to normal clarity for:

- security warnings
- destructive or irreversible confirmation flows
- multi-step procedures where compression risks ambiguity
- cases where the user explicitly asks for clarification

Code, commits, and PR text remain normal unless a future mode explicitly changes those surfaces.

## Architecture

### 1. Canonical Skill

Metronome owns a canonical `caveman` skill:

- `configs/skills/caveman/SKILL.md`

This file is the source of truth for:

- description / trigger language
- intensity table
- examples
- boundaries
- auto-clarity rules

The skill is user-visible and manually invokable. It is also machine-consumed by runtime scripts that extract the currently active level's rules.

### 2. Canonical Caveman Config

Metronome adds a small canonical config file, for example:

- `configs/settings/caveman.json`

Fields:

- `defaultMode`: `off | lite | full | ultra`
- `targets`: enabled targets list (`opencode`, `claude-code`, `codex`)
- `naturalLanguageActivation`: boolean

Initial defaults:

- `defaultMode = off`
- `targets = ["opencode", "claude-code", "codex"]`
- `naturalLanguageActivation = false`

Rationale:

- start explicit, not surprising
- enable slash-command control first
- add fuzzy activation only after observing behavior

### 3. Runtime State

Each CLI stores a tiny local state file with the currently active mode.

Paths:

- Claude: `~/.claude/.caveman-active`
- Codex: `~/.codex/.caveman-active`
- OpenCode: `~/.config/opencode/.caveman-active`

Allowed values:

- `off`
- `lite`
- `full`
- `ultra`

The runtime helper must validate content on read and reject invalid or oversized values.

### 4. Shared Runtime Helper Logic

Metronome should centralize the reusable logic in one small helper module/script family rather than re-implementing parsing separately per CLI.

Shared responsibilities:

- resolve default mode from canonical caveman config
- parse explicit caveman commands
- parse deactivation aliases
- read/write active-mode state safely
- read canonical `SKILL.md`
- strip frontmatter
- filter the intensity table to the active row only
- filter examples to the active level only
- emit compact reinforcement context when mode is active

The target-specific layers should only adapt:

- hook/plugin event payload format
- hook registration format
- state file path
- context injection mechanism

## CLI Wiring

### Codex

Use native Codex hooks, managed centrally by metronome.

Needed pieces:

- `SessionStart` hook
- `UserPromptSubmit` hook
- `features.codex_hooks = true`

Flow:

1. `SessionStart`
   - read canonical caveman config
   - if default mode is `off` and no saved active mode exists, emit nothing
   - otherwise determine active level and inject filtered caveman rules as `additionalContext`

2. `UserPromptSubmit`
   - parse `/caveman ...` or deactivation text
   - update state file
   - if mode is active, emit a compact reminder `additionalContext`

Codex registration lives in canonical hook config, parallel to the existing vault-context loader.

### Claude

Use Claude hooks, managed in `configs/settings/claude.json`.

Needed pieces:

- `SessionStart` hook
- `UserPromptSubmit` hook

Flow mirrors Codex:

1. `SessionStart` injects the filtered level rules
2. `UserPromptSubmit` updates state and emits compact reinforcement

This is the closest target to the upstream caveman implementation and should be near-direct.

### OpenCode

Use a local plugin, managed centrally by metronome and pushed by the OpenCode adapter.

Needed behavior:

- inspect outgoing user prompts
- parse `/caveman ...`
- persist mode state
- inject active caveman context at session start and/or before the next tool/model turn

Because OpenCode's event mutation surface is less mature than Codex/Claude hooks, the implementation must split responsibilities cleanly:

- state tracking
- command parsing
- context injection

If OpenCode cannot inject hidden context at exactly the same lifecycle point, the plugin should approximate the behavior while keeping the same visible UX and state semantics.

## Port Plan From Upstream Caveman Repo

### Port Directly

1. Canonical `SKILL.md` model
2. `lite|full|ultra` intensity system
3. `/caveman <level>` parsing
4. `/caveman off|stop` as explicit deactivation aliases
5. prompt deactivation aliases: `stop caveman`, `normal mode`
6. active-mode state file concept
7. filtered rule emission from one source skill file
8. per-turn reinforcement while active
9. auto-clarity and boundaries sections

### Port With Modification

1. Default mode resolution
   - upstream supports env/config fallback
   - metronome should source defaults from canonical repo config first

2. Natural-language activation
   - upstream supports it
   - v1 should keep it disabled by default behind canonical config

3. File safety helpers
   - preserve symlink/whitelist/size-cap validation
   - adapt paths to each CLI home

4. Session-start injection
   - reimplemented per target using target-native hooks/plugins

### Do Not Port In V1

1. `wenyan-*` modes
2. `caveman-commit`
3. `caveman-review`
4. `caveman-compress`
5. statusline badge setup
6. plugin marketplace packaging / branding
7. benchmark claims and token-savings marketing copy

## Adapter / Metronome Changes

### Canonical Assets

Add:

- `configs/skills/caveman/SKILL.md`
- `configs/settings/caveman.json`
- `configs/hooks/caveman-config.js` or equivalent shared helper
- `configs/hooks/caveman-sessionstart-codex.js`
- `configs/hooks/caveman-userprompt-codex.js`
- `configs/hooks/caveman-sessionstart-claude.js`
- `configs/hooks/caveman-userprompt-claude.js`
- `configs/plugins/caveman-opencode.ts`
- canonical hook registrations / plugin registrations in target-specific config

### Target Registrations

Codex:

- extend `configs/hook-configs/codex.json` with caveman hooks

Claude:

- extend `configs/settings/claude.json` hook registration

OpenCode:

- ensure plugin is deployed by adapter
- ensure any required plugin setting / registration survives sync

## Testing Strategy

### Unit Tests

1. state parser accepts only `off|lite|full|ultra`
2. `/caveman` command parsing
3. `/caveman off|stop` parsing
4. deactivation alias parsing
5. filtered level extraction from `SKILL.md`
6. per-target path resolution for active-mode files

### Adapter / Integration Tests

1. Codex hook config rendered correctly
2. Claude settings hook registration rendered correctly
3. OpenCode plugin rendered and synced correctly
4. `metronome push` / `check` idempotency for all three targets

### Runtime Script Tests

1. session-start hook with no active/default mode emits nothing
2. session-start hook with `lite|full|ultra` emits only that level's rows/examples
3. user-prompt hook updates mode file correctly
4. user-prompt hook emits reinforcement only when active
5. deactivation clears state

## Rollout Plan

### Phase 1

- canonical skill
- canonical caveman config
- shared helper logic
- Codex runtime wiring
- Claude runtime wiring

### Phase 2

- OpenCode plugin parity
- cross-target consistency test pass

### Phase 3

- optional natural-language activation
- Gemini support if desired

## Risks

1. OpenCode plugin event surface may not support hidden context injection as cleanly as Codex/Claude.
2. Per-turn reinforcement can over-inject if not kept minimal.
3. Poorly validated mode files could create drift or garbage context.
4. Natural-language activation can produce accidental mode switches.

## Recommendation

Implement `caveman` as a canonical skill plus centrally managed sticky runtime mode. Use target-native hooks/plugins to activate, persist, and reinforce it. Port the upstream intensity model, rule filtering, and state file design; skip Wenyan, badges, and compression in v1.
