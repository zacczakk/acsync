# Codex Addendum

## Paths
- Canonical rules: `~/Repos/agents/AGENTS.md`
- Canonical commands: `~/Repos/agents/configs/common/commands`
- Canonical subagents: `~/Repos/agents/configs/common/agents`
- Canonical skills: `~/Repos/agents/configs/common/skills`
- Codex prompts (rendered): `~/.codex/prompts`
- Codex skills (rendered): `~/.codex/skills`
- Helper scripts: `~/Repos/agents/scripts`

## Helpers and Sync Discipline
- Repo helper scripts live in `scripts/` (committer, generate-docs, browser-tools).
- If helpers are synced to other repos, keep them byte-identical.
- Use `/zz-sync-agent-helpers` to manage helper drift.

## Config Management
- Global configs are managed in `~/Repos/agents`.
- Use `/zz-sync-agent-configs` to sync configs across CLIs.
- Keep secrets in `.env`; never commit them.
