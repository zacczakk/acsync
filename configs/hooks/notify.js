#!/usr/bin/env node
// Alerter notification core — shared by Claude Code and OpenCode hooks.
// Requires: brew install vjeantet/tap/alerter

const { execFile } = require('child_process');
const path = require('path');

const ALERTER_PATH = '/opt/homebrew/bin/alerter';
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

/**
 * Send a macOS notification via alerter.
 * Gracefully skips if alerter is not installed.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.subtitle]
 * @param {string} [opts.sound] - e.g. "Ping", "default"
 * @param {number} [opts.timeout] - seconds, 0 = persistent
 * @param {string} [opts.group] - notification group ID
 * @param {string} [opts.icon] - filename in configs/assets/
 */
function sendNotification({ title, message, subtitle, sound, timeout, group, icon }) {
  try {
    require('fs').accessSync(ALERTER_PATH);
  } catch {
    process.stderr.write('notify: alerter not installed, skipping\n');
    return;
  }

  const args = ['--title', title, '--message', message];
  if (subtitle) args.push('--subtitle', subtitle);
  if (sound) args.push('--sound', sound);
  if (timeout !== undefined) args.push('--timeout', String(timeout));
  if (group) args.push('--group', group);

  if (icon) {
    const iconPath = path.join(ASSETS_DIR, icon);
    args.push('--app-icon', iconPath);
  }

  execFile(ALERTER_PATH, args, (err, stdout) => {
    if (err) { process.stderr.write(`notify: ${err.message}\n`); return; }
    if (stdout.trim() === '@ACTIONCLICKED') {
      const sessionId = process.env.ITERM_SESSION_ID;
      if (!sessionId) return;
      const uuid = sessionId.split(':')[1];
      if (!uuid) return;
      const script = `
        tell application "iTerm2"
          activate
          repeat with w in windows
            repeat with t in tabs of w
              repeat with s in sessions of t
                if unique ID of s is "${uuid}" then
                  select t
                  select s
                  return
                end if
              end repeat
            end repeat
          end repeat
        end tell`;
      execFile('osascript', ['-e', script]);
    }
  });
}

module.exports = { sendNotification };
