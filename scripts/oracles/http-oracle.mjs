#!/usr/bin/env node
// `http` oracle for the evaluation contract (Stage G, step 5 of the audit).
//
// Deliverable: a service / API. The oracle starts the server, waits until it is reachable,
// sends each criterion's request, and grades the OBSERVED response (status + body) — never the
// source. It then tears the server down. This reuses the `process` sandbox idea (controlled
// spawn) but observes over HTTP instead of stdout.
//
// Invariants (carried from the evaluator's design):
//   • Probe behavior, not code presence — the verdict cites response status + body.
//   • Absence of evidence = FAIL — if the server never becomes reachable, EVERY criterion FAILs
//     (a service you cannot reach does not pass), and a request that errors out FAILs.
//   • One verdict per criterion.
//
// Contract shape:
//   { "oracle": "http",
//     "server": { "cmd": "node ./server.mjs", "ready_path": "/health", "ready_timeout_ms": 4000 },
//     "criteria": [
//       { "id": "H1", "desc": "health is ok",
//         "probe": { "method": "GET", "path": "/health" },
//         "expect": { "status": 200, "body": "/ok/i" } },
//       { "id": "H2", "desc": "echo returns the message as json",
//         "probe": { "method": "POST", "path": "/echo", "json": { "msg": "hi" } },
//         "expect": { "status": 200, "json": { "msg": "hi" } } } ] }
//
// The server is spawned with env.PORT set to a free port the runner picks, so fixtures must read
// `process.env.PORT`. `status` uses the shared numeric grammar (200 | "!=500" | ">=200" ...).
//
// Library use:  const { fails, results } = await runContract({ server, criteria })
// CLI use:      node http-oracle.mjs <contract.json> ["override server command"]
//               exit 0 = all PASS, 1 = ≥1 FAIL, 2 = usage/contract error.

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFileSync } from "node:fs";
import { matchNum, toRegExp, formatReport } from "./_shared.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
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

async function reachable(base, path, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ctrl = AbortSignal.timeout(500);
      await fetch(base + path, { signal: ctrl });
      return true; // any HTTP response (even 404) means the port is serving
    } catch {
      await sleep(100);
    }
  }
  return false;
}

async function probe(base, p) {
  const init = { method: p.method || "GET", headers: { ...(p.headers || {}) } };
  if (p.json !== undefined) { init.body = JSON.stringify(p.json); init.headers["content-type"] = "application/json"; }
  else if (p.body !== undefined) { init.body = p.body; }
  const res = await fetch(base + (p.path || "/"), { ...init, signal: AbortSignal.timeout(p.timeout_ms || 5000) });
  const text = await res.text();
  return { status: res.status, text };
}

function jsonSubsetMatches(want, gotText) {
  let got;
  try { got = JSON.parse(gotText); } catch { return false; }
  for (const [k, v] of Object.entries(want)) {
    if (JSON.stringify(got?.[k]) !== JSON.stringify(v)) return false;
  }
  return true;
}

function grade(expect, r) {
  const reasons = [];
  let pass = true;
  if (!matchNum(expect.status ?? "*", r.status)) { pass = false; reasons.push(`status ${r.status} ≠ expected ${expect.status}`); }
  if (expect.body !== undefined && !toRegExp(expect.body).test(r.text)) { pass = false; reasons.push(`body does not match ${expect.body}`); }
  if (expect.json !== undefined && !jsonSubsetMatches(expect.json, r.text)) { pass = false; reasons.push(`json does not contain ${JSON.stringify(expect.json)}`); }
  const evidence = `status ${r.status}, body=${JSON.stringify(r.text.trim().slice(0, 120))}` + (reasons.length ? `  [${reasons.join("; ")}]` : "");
  return { pass, evidence };
}

export async function runContract({ server, criteria }) {
  const results = [];
  let fails = 0;
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const [bin, ...args] = String(server.cmd).split(/\s+/).filter(Boolean);
  const child = spawn(bin, args, {
    env: { ...process.env, PORT: String(port) },
    cwd: server.cwd,
    stdio: ["ignore", "ignore", "ignore"],
  });

  try {
    const up = await reachable(base, server.ready_path || "/", server.ready_timeout_ms || 4000);
    if (!up) {
      // Absence of evidence = FAIL for every criterion: an unreachable service does not pass.
      for (const c of criteria) {
        results.push({ id: c.id, desc: c.desc, pass: false, evidence: `server never became reachable at ${base}${server.ready_path || "/"} within ${server.ready_timeout_ms || 4000}ms` });
        fails++;
      }
      return { fails, results };
    }
    for (const c of criteria) {
      let g;
      try { g = grade(c.expect || {}, await probe(base, c.probe || {})); }
      catch (e) { g = { pass: false, evidence: `request failed: ${e.message}` }; }
      if (!g.pass) fails++;
      results.push({ id: c.id, desc: c.desc, ...g });
    }
    return { fails, results };
  } finally {
    child.kill("SIGTERM");
    // give it a beat, then hard-kill if still alive
    await sleep(100);
    if (!child.killed) { try { child.kill("SIGKILL"); } catch { /* already gone */ } }
  }
}

export { formatReport };

// --- CLI entry ---------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const contractPath = process.argv[2];
  const overrideCmd = process.argv[3];
  if (!contractPath) {
    console.error('usage: node http-oracle.mjs <contract.json> ["override server command"]');
    process.exit(2);
  }
  let contract;
  try { contract = JSON.parse(readFileSync(contractPath, "utf8")); }
  catch (e) { console.error(`cannot read contract ${contractPath}: ${e.message}`); process.exit(2); }
  if (!Array.isArray(contract.criteria) || contract.criteria.length === 0) {
    console.error(`contract ${contractPath} has no criteria[]`); process.exit(2);
  }
  const server = { ...(contract.server || {}) };
  if (overrideCmd) server.cmd = overrideCmd;
  if (!server.cmd) { console.error(`contract ${contractPath} has no server.cmd`); process.exit(2); }
  const summary = await runContract({ server, criteria: contract.criteria });
  console.log(formatReport(`http oracle: ${contractPath}`, summary));
  process.exit(summary.fails === 0 ? 0 : 1);
}
