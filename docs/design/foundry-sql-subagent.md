---
summary: "Design and operating contract for the read-only OpenCode Foundry SQL subagent."
read_when:
  - "Using or changing the foundry-sql subagent"
  - "Changing Palantir MCP access or Foundry data-agent routing"
---

# Foundry SQL Subagent

## Goal

Keep Foundry exploration out of the main session. `foundry-sql` runs as an
OpenCode child on `tux/gpt-5.6-luna` with max reasoning effort, performs only
the data discovery and query work needed for the parent question, and returns a
compact evidence brief instead of raw MCP transcripts or result tables.

## Context Boundary

- The child agent denies all non-Palantir tools by default and allows the
  complete `palantir-mcp_*` namespace.
- The main session keeps its existing Palantir MCP access; this subagent is a
  context-isolating specialist, not a global access policy.
- The prompt prioritizes read-only discovery, schema, SQL, ontology,
  documentation, and API-catalog tools. Mutation safety is instruction-level,
  not permission-level.
- `palantir-mcp` is enabled for OpenCode V1 and V2, with direct tool exposure;
  other CLI targets keep it disabled.

## Query Workflow

1. Define the claim, grain, filters, and time window.
2. Discover the dataset/project or ontology object type when not supplied.
3. Read the dataset/object schema before selecting fields.
4. Prefer bounded aggregate queries; use small row samples only when needed.
5. Use Spark SQL `SELECT` statements with backtick-quoted Foundry references,
   explicit columns, and a SQL/MCP row limit of 50 or lower.
6. Report source, query shape, limits, branch/fallback, caveats, and only
   findings relevant to the parent question.
7. Include the exact Palantir MCP calls needed to reproduce or validate the
   findings, with complete argument objects and in execution order.

The child stops and reports a precise blocker when a required RID, permission,
or schema field is unavailable. It never broadens the task merely because the
complete Palantir catalog is available.

## Report Contract

Every successful response uses:

```text
## Foundry Data Brief

Question: ...

Answer:
...

Evidence:
- ...

Query trail:
- ...

Reproduction calls:
- Call 1: `<exact native palantir-mcp tool name>` with its complete JSON
  argument object

Scope and caveats:
- ...
```

This contract is intentionally small. The parent session receives conclusions,
exact replayable call arguments, and caveats, not the exploration transcript or
tool response payloads. Discovery and schema calls are included when they
supplied values used by later calls; irrelevant exploratory calls are omitted.
