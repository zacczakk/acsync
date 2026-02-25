/**
 * Generate per-target golden fixture files by rendering canonical fixtures
 * through each adapter. Run with: bun test/generate-golden.ts
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code';
import { OpenCodeAdapter } from '../src/adapters/opencode';
import { GeminiAdapter } from '../src/adapters/gemini';
import { CodexAdapter } from '../src/adapters/codex';
import { parseFrontmatter } from '../src/formats/markdown';
import type { CanonicalItem, CanonicalSettings, MCPServer, TargetName } from '../src/types';
import type { ToolAdapter } from '../src/adapters/base';

const FIXTURE_ROOT = join(import.meta.dir, 'fixtures');
const CANONICAL = join(FIXTURE_ROOT, 'canonical');
const SEEDS = join(FIXTURE_ROOT, 'seeds');

const adapters: { name: TargetName; adapter: ToolAdapter }[] = [
  { name: 'claude-code', adapter: new ClaudeCodeAdapter() },
  { name: 'opencode', adapter: new OpenCodeAdapter() },
  { name: 'gemini', adapter: new GeminiAdapter() },
  { name: 'codex', adapter: new CodexAdapter() },
];

// Target output directory names (match test/fixtures/{dir}/)
const targetDir: Record<TargetName, string> = {
  'claude-code': 'claude',
  'opencode': 'opencode',
  'gemini': 'gemini',
  'codex': 'codex',
};

function readCanonicalItem(filePath: string, name: string): CanonicalItem {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = parseFrontmatter(raw);
  return { name, content, metadata: data };
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function writeGolden(outDir: string, filename: string, content: string): void {
  ensureDir(outDir);
  writeFileSync(join(outDir, filename), content);
}

let fileCount = 0;

// ── Commands ──────────────────────────────────────────────────────────────

const commandFiles = readdirSync(join(CANONICAL, 'commands')).filter(f => f.endsWith('.md'));
for (const file of commandFiles) {
  const name = basename(file, '.md');
  const item = readCanonicalItem(join(CANONICAL, 'commands', file), name);

  for (const { name: target, adapter } of adapters) {
    const rendered = adapter.renderCommand(item);
    // Extract just the filename from the full path
    const outFilename = basename(rendered.relativePath);
    const outDir = join(FIXTURE_ROOT, targetDir[target], 'commands');
    writeGolden(outDir, outFilename, rendered.content);
    fileCount++;
  }
}

// ── Agents ────────────────────────────────────────────────────────────────

const agentFiles = readdirSync(join(CANONICAL, 'agents')).filter(f => f.endsWith('.md'));
for (const file of agentFiles) {
  const name = basename(file, '.md');
  const item = readCanonicalItem(join(CANONICAL, 'agents', file), name);

  for (const { name: target, adapter } of adapters) {
    const rendered = adapter.renderAgent(item);
    const outFilename = basename(rendered.relativePath);
    const outDir = join(FIXTURE_ROOT, targetDir[target], 'agents');
    writeGolden(outDir, outFilename, rendered.content);
    fileCount++;
  }
}

// ── Skills (identity — verbatim copy) ─────────────────────────────────────

const skillDirs = readdirSync(join(CANONICAL, 'skills'));
for (const skillName of skillDirs) {
  const skillFile = join(CANONICAL, 'skills', skillName, 'SKILL.md');
  const item = readCanonicalItem(skillFile, skillName);

  for (const { name: target, adapter } of adapters) {
    const rendered = adapter.renderSkill(item);
    // renderSkill returns relativePath like ~/.../skills/name/SKILL.md
    // We just need skills/{name}/SKILL.md under the target dir
    const outDir = join(FIXTURE_ROOT, targetDir[target], 'skills', skillName);
    writeGolden(outDir, 'SKILL.md', rendered.content);
    fileCount++;
  }
}

// ── Instructions (identity passthrough, target-specific filename) ─────────

const instructionsRaw = readFileSync(join(CANONICAL, 'instructions', 'AGENTS.md'), 'utf-8');
const instructionsContent = adapters[0].adapter.renderInstructions(instructionsRaw);

const instructionFilenames: Record<TargetName, string> = {
  'claude-code': 'CLAUDE.md',
  'opencode': 'AGENTS.md',
  'gemini': 'AGENTS.md',
  'codex': 'AGENTS.md',
};

for (const { name: target } of adapters) {
  const outDir = join(FIXTURE_ROOT, targetDir[target], 'instructions');
  writeGolden(outDir, instructionFilenames[target], instructionsContent);
  fileCount++;
}

// ── MCP Servers (merged into seed state) ──────────────────────────────────

const mcpFiles = readdirSync(join(CANONICAL, 'mcp')).filter(f => f.endsWith('.json'));
const servers: MCPServer[] = mcpFiles.map(file => {
  const raw = readFileSync(join(CANONICAL, 'mcp', file), 'utf-8');
  const server = JSON.parse(raw) as MCPServer;
  if (!server.name) server.name = basename(file, '.json');
  return server;
});

// Seed filenames and output filenames per target
const mcpSeedFile: Record<TargetName, string> = {
  'claude-code': 'mcp.json',
  'opencode': 'mcp.jsonc',
  'gemini': 'mcp.json',
  'codex': 'mcp.toml',
};

const mcpOutFile: Record<TargetName, string> = {
  'claude-code': 'settings.json',
  'opencode': 'opencode.jsonc',
  'gemini': 'settings.json',
  'codex': 'mcp_servers.toml',
};

for (const { name: target, adapter } of adapters) {
  const seedPath = join(SEEDS, targetDir[target], mcpSeedFile[target]);
  const existingContent = readFileSync(seedPath, 'utf-8');
  const rendered = adapter.renderMCPServers(servers, existingContent);
  if (rendered) {
    const outDir = join(FIXTURE_ROOT, targetDir[target], 'mcp');
    writeGolden(outDir, mcpOutFile[target], rendered);
    fileCount++;
  }
}

// ── Settings (merged into seed state) ─────────────────────────────────────

const settingsTargets: { target: TargetName; canonicalFile: string; seedFile: string; outFile: string }[] = [
  { target: 'claude-code', canonicalFile: 'claude.json', seedFile: 'settings.json', outFile: 'settings.json' },
  { target: 'opencode', canonicalFile: 'opencode.json', seedFile: 'settings.jsonc', outFile: 'opencode.json' },
];

for (const { target, canonicalFile, seedFile, outFile } of settingsTargets) {
  const adapter = adapters.find(a => a.name === target)!.adapter;
  const canonicalRaw = readFileSync(join(CANONICAL, 'settings', canonicalFile), 'utf-8');
  const keys = JSON.parse(canonicalRaw) as Record<string, unknown>;
  const settings: CanonicalSettings = { target, keys };
  const seedPath = join(SEEDS, targetDir[target], seedFile);
  const existingContent = readFileSync(seedPath, 'utf-8');
  const rendered = adapter.renderSettings(settings, existingContent);
  const outDir = join(FIXTURE_ROOT, targetDir[target], 'settings');
  writeGolden(outDir, outFile, rendered);
  fileCount++;
}

console.log(`✅ Generated ${fileCount} golden fixture files`);
