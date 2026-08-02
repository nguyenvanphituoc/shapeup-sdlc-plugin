// Shared helpers for evaluation-contract oracle runners (Stage G of the audit).
//
// The `process` oracle (step 1–3) inlined these; the test/snapshot/http oracles (steps 4–5)
// import them so the matching grammar is identical across the registry. Keeping one definition
// of `exit`/regex matching means a contract author learns the grammar once.

// Stack-trace / panic signature shared by every oracle's crash check.
export const CRASH_RE = /at\s+.*:\d+:\d+|Traceback|panic:|unhandled|Segmentation fault/i;

// Interpret an `exit`/`status` spec against an observed number.
//   undefined | "*"            → any (no constraint)
//   number                     → strict equality
//   "==N" "!=N" ">N" "<N" ">=N" "<=N"
export function matchNum(spec, n) {
  if (spec === undefined || spec === "*") return true;
  if (typeof spec === "number") return n === spec;
  const m = String(spec).match(/^(==|!=|>=|<=|>|<)\s*(-?\d+)$/);
  if (!m) return false;
  const want = Number(m[2]);
  switch (m[1]) {
    case "==": return n === want;
    case "!=": return n !== want;
    case ">":  return n > want;
    case "<":  return n < want;
    case ">=": return n >= want;
    case "<=": return n <= want;
    default:   return false;
  }
}

// "/pattern/flags" → RegExp; a bare string → literal-ish RegExp.
export function toRegExp(spec) {
  const m = String(spec).match(/^\/(.*)\/([a-z]*)$/);
  return m ? new RegExp(m[1], m[2]) : new RegExp(spec);
}

// Uniform report formatter so every oracle prints the same PASS/FAIL shape.
export function formatReport(label, { fails, results }) {
  const lines = [`\nEvaluation report — ${label}\n${"=".repeat(60)}`];
  for (const r of results) {
    lines.push(`${r.pass ? "PASS" : "FAIL"}  ${r.id}  ${r.desc || ""}\n        ⇒ ${r.evidence}`);
  }
  lines.push("=".repeat(60));
  lines.push(fails === 0 ? `✅ all ${results.length} criteria PASS` : `❌ ${fails}/${results.length} criteria FAIL`);
  return lines.join("\n");
}
