---
summary: "Review of which metronome configuration can use canonical ~/.agents discovery across six coding agents."
read_when:
  - "Changing metronome discovery paths or adding a client adapter"
  - "Consolidating shared skills, instructions, commands, agents, or MCP configuration"
---

# `~/.agents` Canonicalization Review

Date: 2026-07-10

## Verdict

Keep the git-backed `configs/` tree as metronome's public canonical source. Use
`~/.agents/skills/` as the generated public discovery projection and local
private-skill source, not as the full canonical root.

Agent Skills are the only mature common runtime format. OpenCode, Pi, Codex,
and Cursor discover `~/.agents/skills/` natively. Claude Code does not document
that path and still needs `~/.claude/skills/`. Antigravity CLI 1.1.1 did not
pass a user-level shared-root probe, so metronome retains its local projection.

No equivalent shared `~/.agents` convention exists across all six clients for
global instructions, subagents, commands, settings, MCP, hooks, plugins, or
executables.

## Findings

### P0: Do not move the complete canonical tree to `~/.agents`

Metronome resolves its source from the checkout and defines `configs/` as the
single source of truth (`src/cli/canonical.ts:13-27`). That gives configuration
version control, reviewable changes, and a stable distinction between source
and generated client state.

`~/.agents` is a live discovery directory containing both managed public and
private/user content. Ownership markers separate generated public entries from
unmarked private entries; bulk pull and stale cleanup preserve the latter.

Canonical reads now fail closed, and stale cleanup deletes only marker-owned
entries. Missing private source state never deletes the last private copies.

### P0: Consolidate skills only, with explicit ownership

Legacy OpenCode, Codex, Gemini, and Cursor copies were removed after shared-root
replacement. Claude and Antigravity retain required local projections.

Recommended projection:

| Client | Shared `~/.agents/skills` | Additional projection |
|---|---:|---|
| Claude Code | No documented discovery | `~/.claude/skills/` |
| OpenCode | Native | None |
| Pi | Native | Keep Pi-only `~/.pi/agent/skills/` bundles |
| Codex | Native | Keep Codex-owned `.system` and runtime-only skills local |
| Antigravity | Not proven in CLI 1.1.1 | `~/.gemini/antigravity-cli/skills/` |
| Cursor | Native | None |

Metronome owns marked names present in `configs/skills/`. Unmarked bundles in
`~/.agents/skills/`, including private employer skills, are preserved and
projected without entering the public manifest or output.

### P1: OpenCode's metronome paths are stale

Current OpenCode documentation specifies plural directories:

- `~/.config/opencode/skills/`
- `~/.config/opencode/commands/`

Metronome now writes OpenCode commands to plural `commands/` and relies on
native `~/.agents/skills/` discovery. Legacy singular copies were removed.

### P1: The six-client promise needs two more adapters

Metronome currently implements only Claude Code, OpenCode, Antigravity, and
Codex (`src/cli/canonical.ts:42-50`). Pi is a documented design, not an adapter.
Cursor is intentionally handled as an external OpenCode provider plugin rather
than a metronome target (`docs/architecture.md:80-95`).

Shared skill discovery improves Pi and Cursor immediately, but metronome cannot
claim full configuration management for either until explicit adapters and
fixtures exist.

### P1: Reverse pull is not a safe migration source

Client renderers transform and sometimes discard canonical metadata. Examples:
Antigravity strips model metadata; Codex strips provider prefixes from model
IDs. Do not seed a new canonical root by pulling from all clients. Seed the
shared projection from the existing `configs/` source and compare hashes before
removing duplicate projections.

## Portability Matrix

| Surface | Move/project to `~/.agents`? | Recommendation |
|---|---|---|
| Skills | Yes: `~/.agents/skills/` | Shared projection for OpenCode, Codex, Pi, Cursor; Claude and current Antigravity get separate projections |
| Instructions | No universal global path | Keep `configs/instructions/AGENTS.md`; render `CLAUDE.md` or client-native `AGENTS.md` |
| Project instructions | Partly | Commit root `AGENTS.md` for five clients; Claude needs `CLAUDE.md` or documented import |
| Agents/subagents | No | Keep neutral `configs/agents/`; render Markdown or TOML per client |
| Commands/prompts | No | Keep `configs/commands/`; render per client; convert genuinely reusable workflows to skills |
| MCP servers | No shared schema | Keep neutral `configs/mcp/`; render each host; Pi needs an extension/adapter |
| Settings | No | Keep per-client files under `configs/settings/` |
| Hooks | No | Keep shared code where possible, but registrations and event schemas remain client-specific |
| Plugins/extensions | No | Keep client-owned implementations and install roots |
| CLI tools/scripts | No | Publish/link through `PATH`; `~/.agents` is not executable discovery |
| Auth, sessions, runtime state | Never | Leave client-owned and outside metronome canonical state |

## Recommended Layout

```text
~/Repos/zacczakk/metronome/
  configs/                       # canonical, git-backed semantic source
    agents/
    commands/
    hook-configs/
    instructions/
    mcp/
    plugins/
    settings/
    skills/

~/.agents/
  skills/                        # marked public projections + unmarked private sources

~/.claude/skills/                # generated Claude projection
~/.claude/                       # Claude-specific rendered configuration
~/.config/opencode/              # OpenCode-specific rendered configuration
~/.gemini/                       # Antigravity-specific rendered configuration
~/.codex/                        # Codex-specific rendered configuration
~/.pi/agent/                     # Pi-specific config and Pi-only extensions/skills
~/.cursor/                       # Cursor-specific settings, hooks, MCP, plugins
```

An optional `~/.config/metronome/` may hold machine-local source registration
and manifests. It should point to the checkout; it should not replace the
checkout as source of truth.

## Migration Order

1. Add ownership-aware shared-skill planning. Never delete unknown
   `~/.agents/skills/` entries.
2. Fail closed when the canonical root or required source directories cannot be
   read. Do not interpret source read failures as an empty canonical set.
3. Runtime-test skill collision and symlink behavior in all six installed
   clients.
4. Project canonical skills once to `~/.agents/skills/` and separately to
   `~/.claude/skills/` and Antigravity's local root.
5. Stop projecting the same skills to OpenCode, Codex, and Cursor client-local
   roots. Preserve client-owned extras.
6. Add a Pi adapter for settings, instructions, prompts, and optional MCP
   extension config. Keep Pi core's lack of native MCP/subagents explicit.
7. Keep Cursor as native shared-skill discovery plus Cursor-specific config;
   only add a full adapter if metronome should manage Cursor independently from
   OpenCode.
8. Update path docs and tests, then remove old duplicate projections only after
   end-to-end discovery verification.

## Official References

- Claude Code skills: <https://docs.anthropic.com/en/docs/claude-code/skills>
- OpenCode skills: <https://opencode.ai/docs/skills>
- OpenAI Codex skills: <https://developers.openai.com/codex/build-skills/>
- Pi usage: <https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/usage.md>
- Antigravity skills: <https://antigravity.google/docs/skills>
- Cursor skills: <https://cursor.com/docs/skills>

Official documentation was checked on 2026-07-10. Antigravity is the
fastest-moving target; verify its installed release before deleting its current
`~/.gemini/config/skills` projection.
