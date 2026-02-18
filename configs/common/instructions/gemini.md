# Gemini Addendum

## Paths
- Canonical rules: `~/Repos/agents/AGENTS.md`
- Canonical commands: `~/Repos/agents/configs/common/commands`
- Canonical subagents: `~/Repos/agents/configs/common/agents`
- Gemini commands (rendered): `~/.gemini/commands`
- Gemini subagents (rendered): `~/.gemini/agents`
- Helper scripts: `~/Repos/agents/scripts`

## Notes
- Subagents: `experimental.enableAgents = true` in `~/.gemini/settings.json`.
- Context: `AGENTS.md` canonical; `GEMINI.md` fallback (`context.fileName = ["AGENTS.md", "GEMINI.md"]`).
- Missing local context: import `@~/Repos/agents/AGENTS.md`.

## Config Management
- Global configs are managed in `~/Repos/agents`.
- Use `/zz-sync-agent-configs` to sync configs across CLIs.
- Keep secrets in `.env`; never commit them.
