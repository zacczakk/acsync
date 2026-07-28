# Shared and Private Skill Projection

Public skills are canonical in `configs/skills`. Private skills are direct children of `~/.agents/skills`, the shared OpenCode/Codex root.

`metronome push --type skills` marks public projections with `.metronome-public-v1`, then projects private skills to Claude and Antigravity with a private ownership marker. It discovers private sources before writing the shared root. An unmarked public-name collision is adopted when either its complete directory tree equals the public canonical tree, or its `SKILL.md` hash matches a historical target in the loaded manifest. Historical adoption first accepts an exact marker-free peer tree with the same proven primary hash. As a conservative fallback, a hybrid is accepted only when its marker-free path set exactly matches the current canonical tree and every file is either current canonical content or same-path content from a distinct non-symlink, marker-free peer whose primary hash appears in that skill's manifest targets. This prevents primary-file proof from overwriting unique local support data or accepting extra files.

`--delete` removes marker-owned skill directories only. Unmarked shared entries are never deleted or pulled into `configs/skills`.

Private skills belong directly in `~/.agents/skills`; never place them under the public checkout. Run `metronome push --type skills --force`, then inspect client discovery. Do not move runtime namespaces such as `.system` or `oe-*`.

The public-repository check rejects private classification markers under `configs/skills` and retains a small known-name denylist as a migration guard. Future private skills must never be placed under `configs/skills`; public skills remain allowed there.
