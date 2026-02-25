import os from 'node:os';
import path from 'node:path';
import type { TargetName } from '../types';

/**
 * Centralized path construction for all 4 target CLIs.
 * All paths are fully expanded (no ~ in output) and write-ready.
 *
 * Pass `homeDir` to redirect all paths to an isolated directory (for tests).
 */
export class AdapterPathResolver {
  private readonly homeDir: string;

  constructor(private readonly target: TargetName, homeDir?: string) {
    this.homeDir = homeDir ?? os.homedir();
  }

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

  /** Settings file path for the target (may overlap with MCP config path) */
  getSettingsPath(): string {
    return this.expandHome(this.rawSettingsPath());
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

  /** Expand ~ to the home directory (real or overridden) */
  expandHome(p: string): string {
    if (p === '~') return this.homeDir;
    if (p.startsWith('~/')) return path.join(this.homeDir, p.slice(2));
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
      case 'claude-code': return '~/.claude/commands/';
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

  private rawSettingsPath(): string {
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
      case 'opencode':    return '~/.config/opencode/AGENTS.md';
      case 'gemini':      return '~/.gemini/AGENTS.md';
      case 'codex':       return '~/.codex/AGENTS.md';
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
   * - gemini: .toml extension
   * - others: name.md as-is
   */
  private commandFileName(name: string): string {
    switch (this.target) {
      case 'gemini':
        return `${name}.toml`;
      default:
        return `${name}.md`;
    }
  }

  private agentFileName(name: string): string {
    switch (this.target) {
      case 'codex':
        return `agent-${name}.md`;
      default:
        return `${name}.md`;
    }
  }
}
