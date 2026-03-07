#!/usr/bin/env node
// Compaction Note — writes a checkpoint session note to Memory vault
// when context compaction occurs. Used by both Claude Code (PreCompact hook)
// and OpenCode (plugin wrapper calling this directly).

const fs = require('fs');
const path = require('path');
const os = require('os');

const SESSIONS_DIR = path.join(os.homedir(), 'Vaults', 'Memory', 'sessions');

function pad(n) { return String(n).padStart(2, '0'); }

function writeCompactionNote({ sessionId, source, agent }) {
  const now = new Date();
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const slug = `checkpoint-compaction-${time}`;
  const filename = `${date}-${slug}.md`;
  const filePath = path.join(SESSIONS_DIR, filename);

  const agentTag = agent || 'unknown';
  const content = `---
type: checkpoint
date: ${date}
tags: [session, checkpoint, compaction, ${agentTag}]
consolidated: false
related: ["[[sessions]]"]
---

# Compaction — ${date} ${time}

- **agent**: ${agentTag}
- **session**: ${sessionId || 'unknown'}
- **trigger**: ${source || 'auto'}
- **time**: ${now.toISOString()}

Context window compacted. Prior conversation summarized by the agent.
`;

  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (err) {
    process.stderr.write(`compaction-note: ${err.message}\n`);
  }
}

// When invoked as Claude Code hook: reads JSON from stdin
if (require.main === module) {
  let input = '';
  const stdinTimeout = setTimeout(() => {
    writeCompactionNote({ source: 'auto', agent: 'claude-code' });
    process.exit(0);
  }, 3000);

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => input += chunk);
  process.stdin.on('end', () => {
    clearTimeout(stdinTimeout);
    try {
      const data = JSON.parse(input);
      writeCompactionNote({
        sessionId: data.session_id,
        source: data.source || 'auto',
        agent: 'claude-code'
      });
    } catch {
      writeCompactionNote({ source: 'auto', agent: 'claude-code' });
    }
    process.exit(0);
  });
}

module.exports = { writeCompactionNote };
