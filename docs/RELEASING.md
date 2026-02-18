---
summary: Release checklist for the agents repo.
read_when:
  - Cutting a release or tagging a version
---

# Releasing

1. Run `/zz-sync-agent-configs check` — verify zero drift.
2. Run `python scripts/generate-docs.py` — verify docs catalog is clean.
3. Run `/zz-groom-docs` — verify no ERROR-level issues.
4. Update `docs/CHANGELOG.md` with changes since last release.
5. Commit, tag, push.
