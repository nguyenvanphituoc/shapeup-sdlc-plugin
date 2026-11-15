// probation — a rule the reflector filed is a hypothesis, and what the following runs show is the test.
//
// Each closed run leaves one row per rule it loaded: the failure class the rule targets, and whether that class
// showed up in the run. Counters are per machine and never committed; what is committed is only a status change.
//
// THE TEST HAS TO FAIL WHEN ITS SUBJECT IS ABSENT. A rule promoted because "the class did not recur" over a
// stretch in which the class never occurred promotes everything for free. So promotion needs a base rate — the
// class happened in at least BASE_MIN earlier runs — and without one a rule only waits, then expires.
import { readFileSync, appendFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadRules } from "./kb.mjs";
import { kbEffect, learningIndex, ordersDir, readRunId } from "./paths.mjs";
import { runClasses, readIndex } from "./learning.mjs";

/** Runs a rule must be loaded in, with its class absent, to be promoted. (A proposal until the PO sets it.) */
export const N_PROMOTE = 3;
/** Runs a rule may wait for a base rate before it expires. */
export const M_EXPIRE = 10;
/** Earlier runs the class must have occurred in before the rule existed. */
export const BASE_MIN = 2;

const jsonl = (p) => { try { return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };

/** The rules a run loaded, from its own orders (the receipts do not see the plan steps), by rule id. */
export function loadedRuleIds(cwd, slug) {
  const runId = readRunId(cwd, slug);
  const byRev = new Map(loadRules(cwd).filter((r) => !r.errors.length).map((r) => [r.rev, r.meta.id]));
  const ids = new Set();
  let files = []; try { files = readdirSync(ordersDir(cwd, slug)).filter((f) => f.endsWith(".json")); } catch { /* none */ }
  for (const f of files) {
    let o; try { o = JSON.parse(readFileSync(join(ordersDir(cwd, slug), f), "utf8")); } catch { continue; }
    if (runId && o.run_id && o.run_id !== runId) continue;
    for (const rev of o.payload?.kb_load_set ?? []) if (byRev.has(rev)) ids.add(byRev.get(rev));
  }
  return [...ids].sort();
}

/** The effect rows this run would leave: one per probationary rule it loaded that names a target. */
export function observe(cwd, slug) {
  const runId = readRunId(cwd, slug); const classes = new Set(runClasses(cwd, slug));
  const loaded = new Set(loadedRuleIds(cwd, slug));
  return loadRules(cwd).filter((r) => !r.errors.length && loaded.has(r.meta.id) && r.meta.targets).map((r) => ({
    schema_version: 1, run_id: runId, slug, at: new Date().toISOString(), rule_id: r.meta.id, targets: r.meta.targets, loaded: true, occurred: classes.has(r.meta.targets),
  }));
}

/** Append this run's effect rows, once per run and rule. Best effort: a counter must never keep a run from ending. */
export function recordEffect(cwd, slug) {
  try {
    const have = new Set(jsonl(kbEffect(cwd)).map((r) => `${r.run_id}|${r.rule_id}`));
    const rows = observe(cwd, slug).filter((r) => !have.has(`${r.run_id}|${r.rule_id}`));
    if (!rows.length) return 0;
    mkdirSync(dirname(kbEffect(cwd)), { recursive: true });
    appendFileSync(kbEffect(cwd), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
    return rows.length;
  } catch { return 0; }
}

/**
 * Decide one probationary rule from its effect rows and the cross-run index.
 * @param {object} rule - A parsed rule.
 * @param {object[]} rows - Its effect rows, earliest first, the current run's included.
 * @param {object[]} index - The cross-run index.
 * @returns {{to: ("active"|"expired"|"retired"|null), why: string}} The status change, or null to keep waiting.
 */
export function decide(rule, rows, index) {
  if (!rule.meta.targets) return { to: null, why: "it names no failure class, so nothing can show it worked; it waits for a person" };
  const mine = rows.filter((r) => r.rule_id === rule.meta.id && r.loaded);
  const runs = [...new Set(mine.map((r) => r.run_id))];
  const recurred = mine.filter((r) => r.occurred);
  if (recurred.length) return { to: "retired", why: `${rule.meta.targets} happened again in ${new Set(recurred.map((r) => r.run_id)).size} run(s) that loaded it` };
  const first = mine.length ? mine.map((r) => r.at).sort()[0] : null;
  const base = first ? new Set(index.filter((x) => x.at < first && (x.classes ?? []).includes(rule.meta.targets)).map((x) => x.run_id)).size : 0;
  if (base < BASE_MIN) {
    return runs.length >= M_EXPIRE
      ? { to: "expired", why: `${rule.meta.targets} had no base rate (${base} earlier run(s) of ${BASE_MIN} needed) across ${runs.length} runs, so the rule could not be shown to work` }
      : { to: null, why: `waiting for a base rate (${base} of ${BASE_MIN} earlier runs had ${rule.meta.targets}); ${runs.length} of ${M_EXPIRE} runs seen` };
  }
  if (runs.length >= N_PROMOTE) return { to: "active", why: `${rule.meta.targets} had occurred in ${base} earlier runs and did not occur in the ${runs.length} runs that loaded this rule` };
  return { to: null, why: `base rate holds (${base} earlier runs); ${runs.length} of ${N_PROMOTE} loaded runs clean so far` };
}

/**
 * Every probationary rule, decided. Reads the effect rows already recorded plus what the current run would add,
 * so the run that is ending counts before it closes.
 * @returns {{id: string, to: (string|null), why: string, targets: string}[]} One entry per rule on probation.
 */
export function review(cwd, slug) {
  const rows = [...jsonl(kbEffect(cwd)), ...observe(cwd, slug)];
  const seen = new Set(); const uniq = rows.filter((r) => { const k = `${r.run_id}|${r.rule_id}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const index = readIndex(cwd);
  return loadRules(cwd).filter((r) => !r.errors.length && r.meta.status === "probation").map((r) => ({ id: r.meta.id, targets: r.meta.targets ?? null, ...decide(r, uniq, index) }));
}
