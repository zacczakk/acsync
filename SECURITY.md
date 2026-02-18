# Security Policy

## Reporting a Vulnerability

If you discover a security issue in this project, please open a
[GitHub issue](https://github.com/zacczakk/agents/issues/new) with the label
**security**.

Do **not** include secrets, tokens, or reproduction steps that could be
exploited before a fix is available. Keep the initial report brief and we will
coordinate details privately if needed.

## Scope

This repo contains agent configuration files and helper scripts. It does not
run a production service. The main risks are:

- Accidentally committed secrets or tokens.
- Unsafe shell commands in helper scripts.

## Secrets

All secrets are loaded from `.env` (gitignored). If you find a committed
secret, please report it immediately so we can rotate it.
