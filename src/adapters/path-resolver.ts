import os from 'node:os';
import path from 'node:path';
import type { TargetName } from '../types';

/**
 * Centralized path construction for all 4 target CLIs.
 * All paths are fully expanded (no ~ in output) and write-ready.
 */
export class AdapterPathResolver {
  constructor(private readonly target: TargetName) {}

  /** Base config directory for the target */
  getBaseDir(): string {
    return this.expandHome(this.rawBaseDir());
  }

  /** Commands directory for the target */
  getCommandsDir(): string {
    return this.expandHome(this.rawCommandsDir());
  }

  /** Agents directory for the target */
  getAgentsDir(): string {
    return this.expandHome(this.rawAgentsDir());
  }

  /** MCP config file path for the target */
  getMCPConfigPath(): string {
    return this.expandHome(this.rawMCPConfigPath());
  }

  /** Instructions file path for the target */
  getInstructionsPath(): string {
    return this.expandHome(this.rawInstructionsPath());
  }

  /** Skills directory (only meaningful for opencode) */
  getSkillsDir(): string {
    return this.expandHome(this.rawSkillsDir());
  }

  /** Full path for a rendered command file given a logical name */
  getCommandFilePath(name: string): string {
    return path.join(this.getCommandsDir(), this.commandFileName(name));
  }

  /** Full path for a rendered agent file given a logical name */
  getAgentFilePath(name: string): string {
    return path.join(this.getAgentsDir(), this.agentFileName(name));
  }

  /** Expand ~ to the user's home directory */
  expandHome(p: string): string {
    if (p === '~') return os.homedir();
    if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
    return p;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private rawBaseDir(): string {
    switch (this.target) {
      case 'claude-code': return '~/.claude';
      case 'opencode':    return '~/.config/opencode';
      case 'gemini':      return '~/.gemini';
      case 'codex':       return '~/.codex';
    }
  }

  private rawCommandsDir(): string {
    switch (this.target) {
      case 'claude-code': return '~/.claude/commands/zz/';
      case 'opencode':    return '~/.config/opencode/command/';
      case 'gemini':      return '~/.gemini/commands/';
      case 'codex':       return '~/.codex/prompts/';
    }
  }

  private rawAgentsDir(): string {
    switch (this.target) {
      case 'claude-code': return '~/.claude/agents/';
      case 'opencode':    return '~/.config/opencode/agents/';
      case 'gemini':      return '~/.gemini/agents/';
      case 'codex':       return '~/.codex/prompts/';
    }
  }

  private rawMCPConfigPath(): string {
    switch (this.target) {
      case 'claude-code': return '~/.claude.json';
      case 'opencode':    return '~/.config/opencode/opencode.json';
      case 'gemini':      return '~/.gemini/settings.json';
      case 'codex':       return '~/.codex/config.toml';
    }
  }

  private rawInstructionsPath(): string {
    switch (this.target) {
      case 'claude-code': return '~/.claude/CLAUDE.md';
      case 'opencode':    return '~/.config/opencode/OPENCODE.md';
      case 'gemini':      return '~/.gemini/GEMINI.md';
      case 'codex':       return '~/.codex/instructions.md';
    }
  }

  private rawSkillsDir(): string {
    switch (this.target) {
      case 'opencode':    return '~/.config/opencode/skill/';
      // Other targets don't use skills
      default:            return path.join(this.rawBaseDir(), 'skills/');
    }
  }

  /**
   * Convert a logical command name to a filename for the target.
   * - claude-code: strip "zz-" prefix, add .md (e.g. "zz-plan" → "plan.md")
   * - gemini: .toml extension
   * - others: name.md as-is
   */
  private commandFileName(name: string): string {
    switch (this.target) {
      case 'claude-code': {
        const stripped = name.startsWith('zz-') ? name.slice(3) : name;
        return `${stripped}.md`;
      }
      case 'gemini':
        return `${name}.toml`;
      default:
        return `${name}.md`;
    }
  }

  private agentFileName(name: string): string {
    return `${name}.md`;
  }
}
