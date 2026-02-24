# Phase 9: Verification Closure + Doc Cleanup - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all audit gaps from the v2.0 milestone — run formal Phase 8 verification with live checks, update REQUIREMENTS.md checkboxes and traceability, clean stale path references in living `.planning/` docs, and update audit scores to reflect closure. No new capabilities; this is paperwork closure.

</domain>

<decisions>
## Implementation Decisions

### Stale Reference Handling
- Only clean **living docs** — historical phase plans/summaries/research stay untouched
- Living docs in scope: ROADMAP.md, REQUIREMENTS.md, STATE.md, PROJECT.md, v2.0-MILESTONE-AUDIT.md, all `.planning/*.md` files that aren't inside `phases/XX-*/` subdirs
- Replace `configs/common/` → `configs/` and `~/Repos/agents` → `~/Repos/acsync` in those files
- Success metric: zero stale refs in living docs (historical phase plans excluded from count)

### Verification Attestation
- Create 08-VERIFICATION.md with **live checks** — actually run commands, inspect files, verify binary
- Run full test suite as part of verification
- Evidence format: **pass/fail table** (Requirement ID | Check | Result)
- Verification file naming: Claude's discretion (08- vs 09- prefix)

### Traceability Table Cleanup
- Update REQUIREMENTS.md: check off REPO-01..06 boxes, flip all 9 Pending rows to Complete
- Update 'Last updated' date, coverage summary, and all metadata
- Phase attribution: TOOL-01..03 and REPO-01..06 credit to **Phase 8** (did the work), not Phase 9
- Update v2.0 audit doc scores to final state (24/24 after closure)
- Update ROADMAP.md: mark Phase 9 complete, mark v2.0 milestone as shipped with date

### Claude's Discretion
- Verification file naming convention (08-VERIFICATION.md vs 09-VERIFICATION.md)
- Exact wording of pass/fail evidence entries
- Order of operations (verify first, then clean refs, or interleave)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The audit doc (`v2.0-MILESTONE-AUDIT.md`) clearly defines the 9 gaps to close and the integration checker already confirmed code is wired.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-verification-closure-doc-cleanup*
*Context gathered: 2026-02-24*
