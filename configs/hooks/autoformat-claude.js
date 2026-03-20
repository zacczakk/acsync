#!/usr/bin/env node
// Claude Code PostToolUse Hook — auto-formats files after Edit/Write.
// Detects language from file extension and runs the appropriate formatter.
// Shared by Claude Code (not OpenCode — OpenCode has built-in formatters).

const { execSync } = require('child_process');
const path = require('path');

const FORMATTERS = {
  prettier: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.css', '.json', '.md', '.html', '.yaml', '.yml'],
    command: (file) => `prettier --write "${file}" 2>&1 | head -5`,
    detect: () => {
      try { execSync('which prettier', { stdio: 'ignore' }); return true; } catch { return false; }
    },
  },
  ruff: {
    extensions: ['.py', '.pyi'],
    command: (file) => `ruff format "${file}" 2>&1 | head -5`,
    detect: () => {
      try { execSync('which ruff', { stdio: 'ignore' }); return true; } catch { return false; }
    },
  },
  rustfmt: {
    extensions: ['.rs'],
    command: (file) => `rustfmt "${file}" 2>&1 | head -5`,
    detect: () => {
      try { execSync('which rustfmt', { stdio: 'ignore' }); return true; } catch { return false; }
    },
  },
  swiftformat: {
    extensions: ['.swift'],
    command: (file) => `swiftformat "${file}" 2>&1 | head -5`,
    detect: () => {
      try { execSync('which swiftformat', { stdio: 'ignore' }); return true; } catch { return false; }
    },
  },
};

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 5000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input?.file_path || data.tool_input?.filePath || '';
    if (!filePath) process.exit(0);

    const ext = path.extname(filePath).toLowerCase();

    for (const [name, formatter] of Object.entries(FORMATTERS)) {
      if (formatter.extensions.includes(ext) && formatter.detect()) {
        try {
          execSync(formatter.command(filePath), { timeout: 10000, stdio: 'pipe' });
        } catch {}
        break;
      }
    }
  } catch {}
  process.exit(0);
});
