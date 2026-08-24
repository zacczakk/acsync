---
summary: Cross-plan decision log for choices that span multiple plans.
read_when:
  - Starting a new plan that may conflict with prior decisions
---

# Cross-Plan Decision Log

Decisions that span multiple plans or affect the repo broadly.

| Date | Decision | Context | Status |
|------|----------|---------|--------|
| 2026-02-18 | Migrate `.tasks/` → `docs/plans/` | Align with canonical AGENTS.md structure | Done |
| 2026-02-18 | Agent-driven sync (no build step) | SYNC.md as contract, CLI reads playbook | Superseded — now code-driven via `metronome` CLI |
| 2026-07-23 | GPT-5.5 uses the OpenAI SDK as a Tux model override | See below | Active |

## 2026-07-23: GPT-5.5 uses the OpenAI SDK as a Tux model override

**Decision:** Keep the single `tux` provider and its `http://127.0.0.1:18080/v1` endpoint. Set `models.gpt-5.5.provider.npm` to `@ai-sdk/openai`, declare text and image input, and expose all documented GPT-5.5 effort variants: `none`, `low`, `medium`, `high`, and `xhigh`.

**Rationale:** Tux serves OpenAI-compatible routes from the same endpoint, while GPT-5.5 requires the Responses API. The per-model SDK override preserves the Tux provider identity and routes GPT requests through `@ai-sdk/openai`, which uses Responses and makes OpenCode set `store:false` for stateless multi-turn tool calls.
