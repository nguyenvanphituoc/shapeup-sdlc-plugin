// Shared helpers for evaluation-contract oracle runners.
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

// --- server lifecycle helpers (shared by the `http` and `ui` oracles) ---------------------
//
// Both oracles grade a RUNNING deliverable, so both need the same two facts: a port nothing else
// holds, and "is it answering yet". They were written twice, identically, in `http-oracle.mjs`
// before the `ui` oracle needed them — and a reachability probe that differs between two graders
// is a reachability probe that will disagree with itself on the run where it matters.

import { createServer } from "node:net";

/**
 * Reserve a free TCP port on the loopback interface.
 *
 * Binds port 0, reads what the OS assigned, then closes. Inherently racy against another process
 * grabbing the port in the gap — which is why the caller always follows with a readiness wait
 * rather than assuming the spawn succeeded.
 *
 * @returns {Promise<number>} The assigned port.
 */
export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Wait until an HTTP endpoint answers at all, or the deadline passes.
 *
 * ANY response counts as up — a 404 from a server with no `/health` route still proves the port is
 * serving. Distinguishing "wrong route" from "not listening" here would make readiness depend on
 * the deliverable's routing table, which is the thing being graded.
 *
 * @param {string} base - Origin, e.g. `http://127.0.0.1:3000`.
 * @param {string} path - Path to poll.
 * @param {number} timeoutMs - Total budget before giving up.
 * @returns {Promise<boolean>} True when the endpoint answered inside the budget.
 */
export async function waitForHttp(base, path, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(base + path, { signal: AbortSignal.timeout(500) });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return false;
}
