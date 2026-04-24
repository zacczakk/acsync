import os from 'node:os';
import path from 'node:path';
import type { TargetName } from '../types';
import { getCavemanStatePath as getRuntimeCavemanStatePath, type CavemanTarget } from '../runtime/caveman-paths';

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

  /** Skills directory for targets that support direct skill sync */
  getSkillsDir(): string {
    return this.expandHome(this.rawSkillsDir());
  }

  /** Plugins directory (only meaningful for opencode) */
  getPluginsDir(): string {
    return this.expandHome(this.rawPluginsDir());
  }

  /** Hook config path for targets that support standalone hooks config */
  getHooksPath(): string {
    return this.expandHome(this.rawHooksPath());
  }

  /** Caveman mode state path for supported targets */
  getCavemanStatePath(): string {
    return getRuntimeCavemanStatePath(this.cavemanTarget(), this.homeDir);
  }

  /** Full path for a rendered plugin file given a logical name */
  getPluginFilePath(name: string): string {
    return path.join(this.getPluginsDir(), this.pluginFileName(name));
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
      case 'codex':       return '~/.codex/agents/';
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
      case 'claude-code': return '~/.claude/settings.json';
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
      case 'codex':       return '~/.agents/skills/';
      // Other targets don't use skills
      default:            return path.join(this.rawBaseDir(), 'skills/');
    }
  }

  private rawPluginsDir(): string {
    switch (this.target) {
      case 'opencode':    return '~/.config/opencode/plugins/';
      default:            return path.join(this.rawBaseDir(), 'plugins/');
    }
  }

  private rawHooksPath(): string {
    switch (this.target) {
      case 'codex':       return '~/.codex/hooks.json';
      default:            return path.join(this.rawBaseDir(), 'hooks.json');
    }
  }

  private cavemanTarget(): CavemanTarget {
    switch (this.target) {
      case 'claude-code':
      case 'opencode':
      case 'codex':
        return this.target;
      default:
        throw new Error(`caveman state unsupported for ${this.target}`);
    }
  }

  private pluginFileName(name: string): string {
    return `${name}.ts`;
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
        return `${name}.toml`;
      default:
        return `${name}.md`;
    }
  }
}
