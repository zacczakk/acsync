import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  ALL_TARGETS,
  createAdapter,
  readCanonicalCommands,
  readCanonicalSkills,
  readCanonicalMCPServers,
  readCanonicalInstructions,
} from '../canonical';
import { createExclusionFilter } from '../../infra/exclusion';

const projectDir = join(import.meta.dir, '..', '..', '..');

describe('render subcommand logic', () => {
  test('renders a canonical command for all 4 targets', async () => {
    const isExcluded = createExclusionFilter(['gsd-*']);
    const commands = await readCanonicalCommands(projectDir, isExcluded);
    expect(commands.length).toBeGreaterThan(0);

    const first = commands[0]!;
    for (const target of ALL_TARGETS) {
      const adapter = createAdapter(target);
      const rendered = adapter.renderCommand(first);
      expect(rendered.content.length).toBeGreaterThan(0);
      expect(rendered.relativePath.length).toBeGreaterThan(0);
    }
  });

  test('renders instructions for a target', async () => {
    const instructions = await readCanonicalInstructions(projectDir, 'claude-code');
    expect(instructions).not.toBeNull();

    const adapter = createAdapter('claude-code');
    const rendered = adapter.renderInstructions(instructions!.base, instructions!.addendum);
    expect(rendered.length).toBeGreaterThan(0);
  });

  test('renders a canonical skill for targets that support skills', async () => {
    const isExcluded = createExclusionFilter(['gsd-*']);
    const skills = await readCanonicalSkills(projectDir, isExcluded);
    if (skills.length === 0) return;

    const first = skills[0]!;
    for (const target of ALL_TARGETS) {
      const adapter = createAdapter(target);
      const caps = adapter.getCapabilities();
      if (!caps.skills) continue;
      const rendered = adapter.renderSkill(first);
      expect(rendered.content.length).toBeGreaterThan(0);
    }
  });

  test('single target filter returns only that target rendering', async () => {
    const isExcluded = createExclusionFilter(['gsd-*']);
    const commands = await readCanonicalCommands(projectDir, isExcluded);
    expect(commands.length).toBeGreaterThan(0);

    const first = commands[0]!;
    const adapter = createAdapter('claude-code');
    const rendered = adapter.renderCommand(first);
    expect(rendered.content.length).toBeGreaterThan(0);
  });

  test('nonexistent command is not found in canonical list', async () => {
    const isExcluded = createExclusionFilter(['gsd-*']);
    const commands = await readCanonicalCommands(projectDir, isExcluded);
    const missing = commands.find((c) => c.name === 'this-does-not-exist-xyz');
    expect(missing).toBeUndefined();
  });

  test('renders MCP servers', async () => {
    const servers = await readCanonicalMCPServers(projectDir);
    expect(servers.length).toBeGreaterThan(0);

    const adapter = createAdapter('claude-code');
    const rendered = adapter.renderMCPServers(servers);
    expect(rendered.length).toBeGreaterThan(0);
  });
});
