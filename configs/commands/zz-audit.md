---
description: Security audit with severity-ranked findings. Spawns zz-security-auditor agent.
argument-hint: [scope]
allowed-tools: [Read, Glob, Grep, Bash]
---

# /zz-audit — Security Audit

READ ~/Repos/agents/AGENTS.md BEFORE ANYTHING ELSE. Follow all rules there. Skip if file missing.

## Purpose

Run a security audit on the codebase with severity-ranked findings.
Spawns a zz-security-auditor subagent to do the deep analysis.

## Arguments

`$ARGUMENTS` = optional scope to audit.

- If provided: scope audit to that file, directory, or area (e.g., `src/auth/`, `api endpoints`)
- If omitted: audit the full repository

## Procedure

### 1. Determine scope

- Scoped: verify the path/area exists, enumerate files
- Full repo: identify all source directories, config files, dependency manifests

### 2. Spawn zz-security-auditor agent

Spawn a subagent (see docs/subagent.md) with:
- The scope (files/directories to audit)
- Instructions to check for common vulnerability classes

The auditor should check for:
- **Secrets/credentials** — hardcoded keys, tokens, passwords in source or config
- **Injection** — SQL injection, command injection, XSS, template injection
- **Auth/authz** — missing auth checks, broken access control, privilege escalation
- **Dependencies** — known vulnerabilities (`npm audit`, `pip audit`, `cargo audit`)
- **Config** — insecure defaults, debug mode in prod, permissive CORS
- **Data exposure** — sensitive data in logs, error messages, API responses
- **Crypto** — weak algorithms, hardcoded IVs, insecure random

### 3. Present findings

Rank findings by severity and present:

```
Security Audit — src/auth/

  CRITICAL (1)
    [C1] Hardcoded API key in src/auth/config.ts:23
         → Move to environment variable

  HIGH (2)
    [H1] SQL injection in src/auth/login.ts:45
         → Use parameterized query
    [H2] Missing rate limiting on /api/login endpoint
         → Add rate limiter middleware

  MEDIUM (1)
    [M1] Session token in URL query parameter
         → Move to Authorization header

  LOW (0)

  INFO (1)
    [I1] npm audit reports 2 moderate vulnerabilities in dev dependencies
         → Run npm audit fix

Summary: 1 critical, 2 high, 1 medium, 0 low, 1 info
```

If zero findings: report "No security issues found" (but note scope limitations).
