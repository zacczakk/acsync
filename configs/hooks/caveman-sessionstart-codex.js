#!/usr/bin/env node

const os = require('os');
const path = require('path');
const {
  readCavemanConfig,
  readState,
  renderActiveContext,
} = require('./caveman-shared');

const statePath = path.join(os.homedir(), '.codex', '.caveman-active');

try {
  const config = readCavemanConfig();
  const activeMode = readState(statePath);
  const mode = activeMode !== 'off' ? activeMode : config.defaultMode;
  const additionalContext = renderActiveContext(mode);

  if (!additionalContext) {
    process.exit(0);
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  }));
} catch {
  process.exit(0);
}
