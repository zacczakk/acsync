#!/usr/bin/env node
// Claude Code Notification Hook — maps notification_type to alerter calls.
// Registered as a Notification hook in settings.json.

const { sendNotification } = require('./notify');

const ICON = 'claude-icon.png';

const TYPE_MAP = {
  permission_prompt: {
    title: 'Permission needed',
    sound: 'Ping',
    timeout: 0,
  },
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
  elicitation_dialog: {
    title: 'Input needed',
    sound: 'Ping',
    timeout: 0,
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

    if (!config) {
      // Unknown notification type — skip silently
      process.exit(0);
    }

    sendNotification({
      title: config.title,
      message: data.message || type,
      subtitle: data.tool_name || undefined,
      sound: config.sound,
      timeout: config.timeout,
      group: `claude-${type}`,
      icon: ICON,
    });
  } catch {
    // Malformed input — skip
  }
  process.exit(0);
});
