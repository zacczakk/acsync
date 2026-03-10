#!/usr/bin/env node
// Claude Code Stop Hook — notifies when Claude finishes a turn.
// Skips if stop_hook_active (avoids noise from chained stop hooks).

const { sendNotification } = require('./notify');

const ICON = 'claude-icon.png';

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);

    if (data.stop_hook_active) process.exit(0);

    const raw = (data.last_assistant_message || '').trim();
    const firstLine = raw.split(/\n/)[0] || '';
    const summary = firstLine.slice(0, 120) || 'Task complete';

    sendNotification({
      title: 'Claude is done',
      message: summary,
      sound: 'Pop',
      timeout: 10,
      group: 'claude-stop',
      icon: ICON,
    });
  } catch {}
  process.exit(0);
});
