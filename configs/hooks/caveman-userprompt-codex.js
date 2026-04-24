#!/usr/bin/env node

const os = require('os');
const path = require('path');
const {
  readCavemanConfig,
  parseRequestedMode,
  resolveActivationMode,
  readState,
  writeState,
  renderReminder,
} = require('./caveman-shared');

const statePath = path.join(os.homedir(), '.codex', '.caveman-active');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);

  try {
    const payload = input ? JSON.parse(input) : {};
    const prompt = String(payload.prompt ?? payload.userPrompt ?? '');
    const parsed = parseRequestedMode(prompt);
    const config = readCavemanConfig();

    if (parsed?.kind === 'activate-default') {
      writeState(statePath, resolveActivationMode(config.defaultMode));
    } else if (parsed?.kind === 'activate-explicit') {
      writeState(statePath, parsed.mode);
    } else if (parsed?.kind === 'deactivate') {
      writeState(statePath, 'off');
    }

    const activeMode = readState(statePath);
    const additionalContext = renderReminder(activeMode);

    if (!additionalContext) {
      process.exit(0);
    }

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext,
      },
    }));
  } catch {
    process.exit(0);
  }
});
