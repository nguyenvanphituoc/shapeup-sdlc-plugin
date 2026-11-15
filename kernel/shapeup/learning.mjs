// learning — what a run taught, checked against what the kernel wrote down, never against what anyone says.
//
// A candidate rule is the reflector's proposal. It is worth filing only if the failure class it targets
// really happened, and the only evidence that counts is a row in a ledger the kernel or a hook wrote: the
// metrics the guard appends, the T0 trial ledger, the gate ledger, the dispatch receipts. Each citation
// names a ledger and the digest of one of its rows; the resolver reads the ledger again and recomputes the
// digest, so a row that was edited, or never written, matches nothing. The pitch, a web page, the discovery
// ledger and the decision log may support a candidate and can never be the reason for one.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { better } from "../core/t0.mjs";
import { trials as trialsPath, gates as gatesPath, dispatchReceipts, metricsShard, resultsDir, learningIndex, learnCandidates, readRunId } from "./paths.mjs";
import { READERS } from "./kb.mjs";
import { signalNames } from "./signal-names.mjs";

/** Where each ledger a citation may name lives. */
export const LEDGERS = {
  metrics: (cwd) => metricsShard(cwd),
  trials: (cwd, slug) => trialsPath(cwd, slug),
  gates: (cwd, slug) => gatesPath(cwd, slug),
  receipts: (cwd, slug) => dispatchReceipts(cwd, slug),
};

/** The reader a candidate may be addressed to besides the table's readers: a defect of the harness itself. */
export const DEFECT = "harness-defect";

/** The digest of one ledger row: 16 hex of the sha256 of its line, trimmed. */
export const rowDigest = (line) => createHash("sha256").update(String(line).trim()).digest("hex").slice(0, 16);

const lines = (p) => { try { return readFileSync(p, "utf8").split("\n").filter((l) => l.trim()); } catch { return []; } };
const parse = (l) => { try { return JSON.parse(l); } catch { return null; } };

/** The reflector's candidate file for a run, or null. */
export function readCandidates(cwd, slug) {
  try { return JSON.parse(readFileSync(learnCandidates(cwd, slug), "utf8")); } catch { return null; }
}

/** Whether one citation points at a real row of a kernel ledger, of this feature. */
export function citationHolds(cwd, slug, c) {
  const file = LEDGERS[c?.ledger]?.(cwd, slug);
  if (!file || typeof c.row_digest !== "string") return false;
  for (const l of lines(file)) {
    if (rowDigest(l) !== c.row_digest) continue;
    const row = parse(l);
    if (!row) continue;
    if (c.ledger === "metrics" && row.slug !== slug) continue;
    if (row.run_id && c.run_id && row.run_id !== c.run_id) continue;
    return true;
  }
  return false;
}

/** The failure classes one run really had, derived from its own ledgers. */
export function runClasses(cwd, slug) {
  const out = new Set();
  const t = lines(trialsPath(cwd, slug)).map(parse).filter(Boolean);
  for (const r of t) {
    if (r.round >= 2) out.add("round.ge2");
    if (r.attempt >= 2) out.add("attempt.ge2");
    if (r.status === "kept") continue;
    const base = t.find((x) => x.trial === r.baseline_trial);
    if (!base?.score || !r.score) continue;
    if (better(base.score, r.score) === true) out.add("t0.regressed");
    else if (better(r.score, base.score) === false) out.add("t0.flat");
  }
  let results = [];
  try { results = readdirSync(resultsDir(cwd, slug)).filter((f) => /^evaluate-r\d+\.json$/.test(f)); } catch { /* none */ }
  for (const f of results) {
    let v = null; try { v = JSON.parse(readFileSync(join(resultsDir(cwd, slug), f), "utf8")); } catch { /* skip */ }
    for (const c of v?.verdict?.criteria ?? v?.criteria ?? []) if (c?.verdict === "FAIL") out.add(`eval.fail.${c.dimension || "spec-conformance"}`);
  }
  if (lines(metricsShard(cwd)).map(parse).some((x) => x?.kind === "pathology" && x.slug === slug && x.pathology === "PA3")) out.add("pathology.PA3");
  const known = new Set(signalNames());
  return [...out].filter((s) => known.has(s)).sort();
}

/** The attempts this run spent that did not move the tree forward: trial rows that were not kept. */
export const attemptsCost = (cwd, slug) => lines(trialsPath(cwd, slug)).map(parse).filter((r) => r && r.status && r.status !== "kept").length;

/** The cross-run index: one row per closed run. Written by `order close`; read here. */
export const readIndex = (cwd) => lines(learningIndex(cwd)).map(parse).filter(Boolean);

/**
 * Whether a candidate's failure class clears the threshold: it happened in at least two runs (this one counts),
 * or it cost at least one attempt in this one.
 */
export function thresholdMet(cwd, slug, klass) {
  if (!klass) return false;
  const here = runClasses(cwd, slug).includes(klass);
  const runId = readRunId(cwd, slug);
  const before = new Set(readIndex(cwd).filter((r) => (r.classes ?? []).includes(klass) && r.run_id !== runId).map((r) => r.run_id));
  return (here && before.size >= 1) || (here && attemptsCost(cwd, slug) >= 1);
}

/**
 * The candidates that survive the kernel's checks: addressed to a reader that reads rules (or the defect
 * queue), naming a class of the vocabulary, with at least one citation that holds against a kernel ledger,
 * and a class that cleared the threshold.
 * @returns {{kept: object[], dropped: {id: string, reason: string}[]}} What stays and why the rest went.
 */
export function verifyCandidates(cwd, slug) {
  const file = readCandidates(cwd, slug);
  const kept = []; const dropped = [];
  if (!file || !Array.isArray(file.candidates)) return { kept, dropped: [{ id: "*", reason: "no candidate file" }] };
  for (const c of file.candidates) {
    const id = String(c?.id ?? "?");
    if (!c?.reader || (c.reader !== DEFECT && !READERS[c.reader])) { dropped.push({ id, reason: `reader "${c?.reader}" does not read rules` }); continue; }
    if (!signalNames().includes(c.class)) { dropped.push({ id, reason: `class "${c.class}" is not in the vocabulary` }); continue; }
    const good = (c.citations ?? []).filter((x) => citationHolds(cwd, slug, x));
    if (!good.length) { dropped.push({ id, reason: "no citation matches a row the kernel wrote" }); continue; }
    if (!thresholdMet(cwd, slug, c.class)) { dropped.push({ id, reason: `class ${c.class} did not recur and cost no attempt` }); continue; }
    kept.push({ ...c, citations: good });
  }
  return { kept, dropped };
}
