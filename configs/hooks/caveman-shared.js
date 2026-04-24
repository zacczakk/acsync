const fs = require('fs');
const path = require('path');

const VALID_MODES = new Set(['off', 'lite', 'full', 'ultra']);
const MAX_STATE_FILE_BYTES = 16;

function repoRoot() {
  return path.resolve(__dirname, '..', '..');
}

function cavemanConfigPath() {
  return path.join(repoRoot(), 'configs', 'settings', 'caveman.json');
}

function cavemanSkillPath() {
  return path.join(repoRoot(), 'configs', 'skills', 'caveman', 'SKILL.md');
}

function readCavemanConfig() {
  const raw = fs.readFileSync(cavemanConfigPath(), 'utf8');
  const parsed = JSON.parse(raw);

  return {
    defaultMode: VALID_MODES.has(parsed.defaultMode) ? parsed.defaultMode : 'off',
    targets: Array.isArray(parsed.targets) ? parsed.targets.filter(Boolean) : [],
    naturalLanguageActivation: parsed.naturalLanguageActivation === true,
  };
}

function parseRequestedMode(text) {
  const input = String(text || '').trim().toLowerCase();

  if (input === '/caveman') {
    return { kind: 'activate-default' };
  }

  const slashMatch = /^\/caveman\s+(lite|full|ultra|off|stop)$/.exec(input);
  if (slashMatch) {
    return slashMatch[1] === 'off' || slashMatch[1] === 'stop'
      ? { kind: 'deactivate', mode: 'off' }
      : { kind: 'activate-explicit', mode: slashMatch[1] };
  }

  if (input === 'normal mode' || input === 'stop caveman') {
    return { kind: 'deactivate', mode: 'off' };
  }

  return null;
}

function resolveActivationMode(defaultMode) {
  return defaultMode === 'off' || !VALID_MODES.has(defaultMode) ? 'full' : defaultMode;
}

function getSafeStatePath(statePath) {
  if (typeof statePath !== 'string' || statePath.length === 0) {
    return null;
  }

  const resolved = path.resolve(statePath);
  if (!path.isAbsolute(statePath) || statePath !== resolved) {
    return null;
  }

  if (path.basename(resolved) !== '.caveman-active') {
    return null;
  }

  const parent = path.dirname(resolved);
  const parentName = path.basename(parent);
  const grandparentName = path.basename(path.dirname(parent));

  if (parentName !== '.claude' && parentName !== '.codex' && !(parentName === 'opencode' && grandparentName === '.config')) {
    return null;
  }

  return hasSymlinkInProtectedPath(resolved) ? null : resolved;
}

function hasSymlinkInProtectedPath(targetPath) {
  return getProtectedPaths(targetPath).some((candidatePath) => {
    if (!fs.existsSync(candidatePath)) {
      return false;
    }

    return fs.lstatSync(candidatePath).isSymbolicLink();
  });
}

function getProtectedPaths(targetPath) {
  const stateDir = path.dirname(targetPath);

  if (path.basename(stateDir) === 'opencode') {
    return [path.dirname(stateDir), stateDir, targetPath];
  }

  return [stateDir, targetPath];
}

function readState(statePath) {
  const safePath = getSafeStatePath(statePath);
  if (!safePath) {
    return 'off';
  }

  try {
    const value = fs.readFileSync(safePath, 'utf8').trim();
    if (value.length > MAX_STATE_FILE_BYTES) {
      return 'off';
    }
    return VALID_MODES.has(value) ? value : 'off';
  } catch {
    return 'off';
  }
}

function writeState(statePath, mode) {
  const safePath = getSafeStatePath(statePath);
  if (!safePath) {
    return;
  }

  fs.mkdirSync(path.dirname(safePath), { recursive: true });
  fs.writeFileSync(safePath, VALID_MODES.has(mode) ? mode : 'off');
}

function stripFrontmatter(raw) {
  return raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
}

function extractSection(body, heading) {
  const pattern = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = pattern.exec(body);
  return match ? match[1].trim() : '';
}

function extractLevelBlock(body, level) {
  const pattern = new RegExp(`### ${level}\\n([\\s\\S]*?)(?=\\n### |\\n## |$)`);
  const match = pattern.exec(body);
  return match ? match[1].trim() : '';
}

function extractIntensityRow(body, level) {
  const intensities = extractSection(body, 'Intensities');
  if (!intensities) {
    return '';
  }

  const lines = intensities.split('\n');
  const row = lines.find((line) => new RegExp(`^\\|\\s*${level}\\s*\\|`).test(line));
  if (!row || lines.length < 2) {
    return '';
  }

  return [lines[0], lines[1], row].join('\n');
}

function renderActiveContext(level) {
  if (!VALID_MODES.has(level) || level === 'off') {
    return '';
  }

  const body = stripFrontmatter(fs.readFileSync(cavemanSkillPath(), 'utf8'));
  const boundaries = extractSection(body, 'Boundaries');
  const clarity = extractSection(body, 'Auto Clarity');
  const intensities = extractIntensityRow(body, level);
  const rules = extractLevelBlock(body, level);
  const examplesSection = extractSection(body, 'Examples');
  const examples = extractLevelBlock(`## Examples\n${examplesSection}`, level);

  return [
    'CAVEMAN MODE ACTIVE',
    `level: ${level}`,
    '',
    'Boundaries:',
    boundaries,
    '',
    'Auto Clarity:',
    clarity,
    '',
    'Intensities:',
    intensities,
    '',
    `Level Rules (${level}):`,
    rules,
    '',
    `Examples (${level}):`,
    examples,
  ].join('\n');
}

function renderReminder(level) {
  if (!VALID_MODES.has(level) || level === 'off') {
    return '';
  }

  return `CAVEMAN REMINDER: level=${level}. Compressed reply style active. Use normal clarity for safety, destructive actions, multi-step ambiguity, or explicit clarification requests.`;
}

module.exports = {
  VALID_MODES,
  readCavemanConfig,
  parseRequestedMode,
  resolveActivationMode,
  readState,
  writeState,
  renderActiveContext,
  renderReminder,
};
