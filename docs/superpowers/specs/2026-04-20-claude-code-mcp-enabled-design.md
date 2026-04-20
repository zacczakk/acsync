# Claude Code MCP Enabled Flag Design

**Date:** 2026-04-20
**Status:** Draft
**Scope:** Claude Code MCP adapter parity for `enabled: false`

## Context

The canonical MCP model already supports two distinct disable semantics:

1. `disabledFor: ['target']` means omit the server entirely for that target.
2. `enabled: false` means render the server but mark it disabled in the target config.

OpenCode already implements the second behavior. Claude Code does not. The current `ClaudeCodeAdapter` filters out `enabled: false` servers at render time, excludes them from rendered-name tracking, and does not round-trip a disabled state back into canonical form.

Result: canonical intent is lost for Claude Code. A disabled server behaves like an omitted server, which breaks parity with the canonical model and with OpenCode.

## Decision

Implement Claude Code parity for `enabled: false` in the adapter only.

Do not refactor shared adapter policy. Do not change Gemini or Codex behavior. Keep `disabledFor` semantics unchanged.

## Goals

1. Preserve canonical meaning of `enabled: false` for Claude Code.
2. Render disabled Claude MCP servers instead of dropping them.
3. Round-trip Claude disabled state back into canonical `MCPServer.enabled`.
4. Make drift/check logic treat disabled Claude servers as managed rendered servers.
5. Keep the change minimal and adapter-local.

## Non-Goals

1. Refactoring base adapter disable policy.
2. Changing Gemini or Codex MCP behavior.
3. Changing `disabledFor` semantics.
4. Changing merge behavior for non-MCP settings keys.
5. Emitting extra Claude fields unrelated to disabled-state support.

## Design

### Target behavior

For Claude Code:

1. `disabledFor: ['claude-code']` still omits the server entirely.
2. `enabled: false` renders the server inside `mcpServers` with `enabled: false`.
3. Omitted `enabled` or `enabled: true` renders as a normal enabled server.
4. Existing top-level JSON keys remain preserved during merge.

### Adapter changes

Modify `src/adapters/claude-code.ts` only.

#### 1. `renderMCPServers`

Current behavior filters out both:

1. `disabledFor` matches
2. `enabled: false`

New behavior filters out only `disabledFor` matches. Servers with `enabled: false` remain in the rendered output.

For each rendered server:

1. keep current stdio mapping: `command`, `args`, optional `env`
2. keep current HTTP mapping: `type: 'http'`, `url`, optional `headers`
3. add `enabled: false` only when canonical `server.enabled === false`
4. omit `enabled` otherwise for minimal output

This preserves current output shape for enabled servers while adding explicit disabled state only when needed.

#### 2. `getRenderedServerNames`

Override the base implementation for Claude Code so rendered-name tracking includes disabled servers.

New rule:

1. exclude servers only when `disabledFor` contains `claude-code`
2. include servers regardless of `enabled`

This aligns check/diff behavior with what Claude will actually contain after render.

#### 3. `parseMCPServers`

Override parsing for Claude Code so reverse parsing recognizes `enabled: false` under `mcpServers.<name>`.

Parsing rules:

1. preserve current stdio vs HTTP detection
2. preserve current env/header parsing
3. if `cfg.enabled === false`, set canonical `server.enabled = false`
4. do not set `enabled` for omitted or truthy values

This gives pull/reverse-parse parity without altering canonical defaults.

## Testing

Update Claude tests in `src/adapters/__tests__/mcp-claude-code.test.ts`.

Required coverage:

1. disabled server remains present in `mcpServers`
2. disabled server renders `enabled: false`
3. `getRenderedServerNames()` includes disabled servers
4. `disabledFor: ['claude-code']` still omits server entirely
5. merge still preserves unrelated top-level keys
6. output remains valid JSON with trailing newline

Add reverse-parse coverage, either in the Claude MCP test file or a shared reverse-parsing test.

Required reverse coverage:

1. parse `enabled: false` back to canonical `enabled: false`
2. omitted `enabled` does not set canonical `enabled`

## Risks

### Risk: Claude config shape mismatch

If Claude Code does not actually support `enabled: false` in `mcpServers`, the rendered config would preserve parity in metronome but not in Claude behavior.

Mitigation:

1. keep the change adapter-local
2. verify against current Claude config/documentation before implementation claims completion

### Risk: drift logic mismatch

If rendered-name logic is not updated alongside render behavior, check output will misclassify disabled servers as orphaned or removed.

Mitigation:

1. change `getRenderedServerNames` in the same implementation
2. test it explicitly

## Acceptance Criteria

The design is complete when all are true:

1. canonical `enabled: false` renders to Claude as a present MCP server with `enabled: false`
2. canonical `disabledFor: ['claude-code']` still omits the server
3. reverse parse from Claude preserves `enabled: false`
4. check/diff logic treats disabled Claude servers as rendered managed servers
5. existing non-Claude adapter behavior is unchanged

## Implementation Scope

Expected file touches:

1. `src/adapters/claude-code.ts`
2. `src/adapters/__tests__/mcp-claude-code.test.ts`
3. one reverse-parse test location if needed

No broader adapter refactor in this change.
