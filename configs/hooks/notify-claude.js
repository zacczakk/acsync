#!/usr/bin/env node
// Claude Code Notification Hook — handles delayed notification types.
// PermissionRequest hook covers permission/elicitation prompts immediately.
// This hook covers: idle_prompt, auth_success.

const { sendNotification } = require('./notify');

const ICON = 'claude-icon.png';

const TYPE_MAP = {
  idle_prompt: {
    title: 'Claude is waiting',
    sound: undefined,
    timeout: 10,
  },
  auth_success: {
    title: 'Auth complete',
    sound: undefined,
    timeout: 5,
  },
};

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const data = JSON.parse(input);
    const type = data.notification_type || 'unknown';
    const config = TYPE_MAP[type];

    if (!config) process.exit(0);

    sendNotification({
      title: config.title,
      message: data.message || type,
      sound: config.sound,
      timeout: config.timeout,
      group: `claude-${type}`,
      icon: ICON,
    });
  } catch {}
  process.exit(0);
});
