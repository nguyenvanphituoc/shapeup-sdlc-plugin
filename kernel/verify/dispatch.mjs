#!/usr/bin/env node
// Did THIS SESSION resolve that skill? — the canary's read half.
//
// `verify skills` proves the SKILL.md files exist at a root at a version. It cannot prove the
// session will resolve that copy, because that is a property of how the CLI was launched:
// `--plugin-dir`, an enabled marketplace install, the right version among several installed. Both
// states the diagnosis names — installed-but-disabled, and wrong-version-loaded — pass a file check
// green. Only a live dispatch answers the question, and this reads its evidence.
//
// THE EVIDENCE, and why it is evidence rather than a claim. A `Skill(...)` call whose name does not
// resolve fires NO hook at all: the host rejects the name upstream of the hook layer. Measured, in a
// live session with a sub-agent making the calls — not inferred. So a decision row from
// `dispatch-receipt` naming a skill is proof that the name resolved, and its absence after a call
// was attempted is proof that it did not. Nothing here trusts a sub-agent's report of what happened;
// the sub-agent cannot write these rows.
//
// The canary deliberately dispatches with NO `--order`. It is testing name resolution, not doing
// work: an order would mean a compiled order with no result sitting in `orders/`, which every reader
// of that directory would then have to know about, and a canary that perturbs the run it is
// clearing is not a preflight.
//
// Usage:  node kernel/harness.mjs verify dispatch --skill <worker> [--since <iso>] [--cwd <dir>] [--json]
// Exit:   0 = this session dispatched that skill and the hook layer saw it · 1 = no such evidence

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { runArgs } from "../lib/argv.mjs";
import { decisionsPath } from "../../hooks/lib/decision.mjs";

/**
 * Every decision row on disk, newest last. An unreadable or absent ledger is an empty list — an
 * absence proves nothing on its own, and the caller decides what that means.
 *
 * @param {string} cwd - Project root the ledger resolves against.
 * @returns {object[]} Parsed rows; unparseable lines are dropped rather than throwing.
 */
export function decisionRows(cwd) {
  const path = decisionsPath(cwd);
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, "utf8").split("\n").filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/**
 * Find evidence that a skill resolved in this checkout.
 *
 * The host reports skills namespaced (`shapeup-sdlc-plugin:orient`) and orders name them bare
 * (`orient`), so a row matches on either form — the caller should not have to know which spelling
 * the hook happened to capture.
 *
 * @param {object[]} rows - Decision rows, e.g. from {@link decisionRows}.
 * @param {string} skill - The worker name to look for, bare or namespaced.
 * @param {string} [since] - ISO timestamp; rows older than this are ignored. Without it, evidence
 *   from any point in the checkout's history counts, which is why the canary always passes one.
 * @returns {{resolved:boolean, rows:object[], considered:number}} The matching rows, newest last.
 */
export function dispatchEvidence(rows, skill, since = null) {
  const bare = String(skill).slice(String(skill).lastIndexOf(":") + 1);
  const floor = since ? Date.parse(since) : null;
  const hits = rows.filter((r) => {
    if (r.hook !== "dispatch-receipt" || !r.subject) return false;
    const subj = String(r.subject);
    const subjBare = subj.slice(subj.lastIndexOf(":") + 1).split("/")[0];
    if (subjBare !== bare && subj !== skill) return false;
    if (floor !== null && !Number.isNaN(floor) && !(Date.parse(r.at) >= floor)) return false;
    return true;
  });
  return { resolved: hits.length > 0, rows: hits, considered: rows.length };
}

// ---------------------------------------------------------------------------
/** The typed argv contract (see `./lib/argv.mjs`). */
export const ARGV_SPEC = {
  usage: "harness.mjs verify dispatch --skill <worker> [--since <iso> | --within <seconds>] [--cwd <dir>] [--json]",
  _: { arity: 0, max: 0 },
  skill: { type: "str", required: true },
  since: { type: "str" },
  // `--within` exists because the canary's caller cannot compute a timestamp. A Workflow script may
  // not call `Date.now()` — it would break resume — so a control script asking "was this dispatched
  // JUST NOW" has no clock of its own. Without a window the check answers "ever, in this checkout",
  // which a project that once had the plugin loaded satisfies forever: the canary would pass on the
  // strength of a run from last month. The kernel has a clock; it does the arithmetic.
  within: { type: "int", min: 1 },
  cwd: { type: "path" },
  json: { type: "flag" },
};

/**
 * Report whether this session has been observed dispatching a named skill.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {void} Exits 0 when the evidence exists, 1 when it does not.
 */
export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const since = args.since || (args.within ? new Date(Date.now() - args.within * 1000).toISOString() : null);
  const ev = dispatchEvidence(decisionRows(cwd), args.skill, since);
  if (args.json) {
    console.log(JSON.stringify({ skill: args.skill, since, ...ev }, null, 2));
  } else if (ev.resolved) {
    const last = ev.rows[ev.rows.length - 1];
    console.log(`✅ ${args.skill} resolved in this session — dispatch observed at ${last.at} (${ev.rows.length} row(s))`);
  }
  if (ev.resolved) process.exit(0);
  console.error(`  ✗ verify dispatch: no evidence this session resolved "${args.skill}".`);
  console.error(`    A Skill call whose name does not resolve fires no hook at all, so the absence of a`);
  console.error(`    decision row after an attempted dispatch means the skill was never reached. Either the`);
  console.error(`    plugin is not loaded in this session (\`claude --plugin-dir <repo>\`, or install and`);
  console.error(`    enable it), or the dispatch was never attempted. ${ev.considered} decision row(s) scanned${since ? ` since ${since}` : ""}.`);
  process.exit(1);
}
