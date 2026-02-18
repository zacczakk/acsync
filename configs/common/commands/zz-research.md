---
description: Research a question with confidence-graded findings. Spawns zz-researcher agent.
argument-hint: <question>
allowed-tools: [Read, Glob, Grep, Bash, mcp__*]
---

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Research

Research an external question and return confidence-graded findings.

## Input

$ARGUMENTS is the research question. If empty, ask the user what to research.

## Context gathering

Before spawning the zz-researcher, gather repo context that might be relevant:
- Tech stack: check `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.
- Current patterns: grep for relevant imports or usage if the question relates to a library
- Existing decisions: check `.tasks/DECISIONS.md` for prior choices on the topic

This helps the zz-researcher give answers that fit the actual project.

## Spawn zz-researcher agent

Pass to the zz-researcher:
- The research question
- Repo tech stack and relevant context
- Instruction: use web search tools (Tavily, Context7, WebFetch) to find answers
- Instruction: prefer 2025–2026 sources; quote exact errors; cite sources
- Instruction: grade each finding by confidence

## Present findings

Format each finding as:
```
[HIGH/MED/LOW confidence] Finding
Source: [domain or title]
Relevance: [why this matters for the project]
```

End with:
- **Recommendation**: what to do based on the findings
- **Gaps**: what couldn't be answered and how to resolve it
