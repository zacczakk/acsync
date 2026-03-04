#!/usr/bin/env node
// Vault Context Loader — SessionStart hook
// Reads persona/memory files from ~/Vaults/Memory/ and injects them
// as additionalContext so the agent sees identity and memory context.

const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT_DIR = path.join(os.homedir(), 'Vaults', 'Memory');
const FILES = ['IDENTITY.md', 'SOUL.md', 'USER.md', 'MEMORY.md'];

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    const sections = [];
    for (const file of FILES) {
      const filePath = path.join(VAULT_DIR, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8').trim();
        if (content) {
          const label = path.basename(file, '.md');
          sections.push(`# ${label}\n\n${content}`);
        }
      } catch {
        // File missing or unreadable — skip
      }
    }

    if (sections.length === 0) {
      process.exit(0);
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: sections.join('\n\n---\n\n')
      }
    };

    process.stdout.write(JSON.stringify(output));
  } catch {
    process.exit(0);
  }
});
