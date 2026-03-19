import type { EvalSummary } from "./types";

export function generateReport(summary: EvalSummary): string {
  const passRate = ((summary.passed / summary.total) * 100).toFixed(0);
  const rows = summary.results
    .map((r) => {
      const status = r.pass ? "pass" : "fail";
      const expect = r.should_trigger ? "trigger" : "ignore";
      const actual = r.triggered ? "triggered" : "ignored";
      return `<tr class="${status}">
        <td class="status">${status.toUpperCase()}</td>
        <td>${expect}</td>
        <td>${actual}</td>
        <td>${escapeHtml(r.query)}</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Skill Eval: ${escapeHtml(summary.skill)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0d1117; color: #c9d1d9; padding: 2rem; }
  h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
  .meta { color: #8b949e; margin-bottom: 1.5rem; font-size: 0.9rem; }
  .score { font-size: 2rem; font-weight: 700; margin-bottom: 1rem; }
  .score .num { color: ${parseInt(passRate) >= 80 ? "#3fb950" : parseInt(passRate) >= 50 ? "#d29922" : "#f85149"}; }
  .desc { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; font-size: 0.85rem; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; padding: 0.5rem; border-bottom: 1px solid #30363d; color: #8b949e; }
  td { padding: 0.5rem; border-bottom: 1px solid #21262d; }
  .status { font-weight: 600; width: 60px; }
  tr.pass .status { color: #3fb950; }
  tr.fail .status { color: #f85149; }
  tr.fail { background: #1c0c0c; }
</style>
</head>
<body>
  <h1>Skill Eval: ${escapeHtml(summary.skill)}</h1>
  <div class="meta">${new Date().toISOString()}</div>
  <div class="score"><span class="num">${summary.passed}</span> / ${summary.total} passed (${passRate}%)</div>
  <div class="desc">${escapeHtml(summary.description)}</div>
  <table>
    <thead><tr><th>Status</th><th>Expected</th><th>Actual</th><th>Query</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
