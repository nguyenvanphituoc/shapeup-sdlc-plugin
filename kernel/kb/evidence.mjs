#!/usr/bin/env node
// harness kb evidence — the rows of the run's own ledgers a candidate may cite, with the digest to cite them by.
//
//   harness.mjs kb evidence --slug <slug> [--cwd <dir>]
//
// Writes nothing. The reflector copies a citation from here instead of computing one: a digest it made up
// matches no row, and the resolver reads the ledgers again before it believes a citation. Only rows of
// ledgers the kernel or a hook wrote are listed — the discovery ledger, QA findings and the decision log may
// support a lesson but are never the reason for one.
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { runArgs } from "../core/argv.mjs";
import { better } from "../core/t0.mjs";
import { LEDGERS, rowDigest, runClasses, attemptsCost, readIndex } from "../shapeup/learning.mjs";

export const ARGV_SPEC = {
  usage: "harness.mjs kb evidence --slug <slug> [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  cwd: { type: "path" },
};

const rowsOf = (p) => { try { return readFileSync(p, "utf8").split("\n").filter((l) => l.trim()); } catch { return []; } };
const J = (l) => { try { return JSON.parse(l); } catch { return null; } };

export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd()); const slug = args.slug;
  const out = [];
  for (const l of rowsOf(LEDGERS.metrics(cwd))) { const r = J(l); if (r?.kind === "pathology" && r.slug === slug) out.push({ ledger: "metrics", row_digest: rowDigest(l), run_id: null, class: `pathology.${r.pathology}`, summary: `${r.pathology}: ${(r.blocked_paths ?? []).slice(0, 3).join(", ")}` }); }
  const trialLines = rowsOf(LEDGERS.trials(cwd, slug)); const trials = trialLines.map(J);
  trialLines.forEach((l, i) => {
    const r = trials[i]; if (!r || r.status === "kept") return;
    const base = trials.find((x) => x?.trial === r.baseline_trial);
    const klass = base?.score && r.score ? (better(base.score, r.score) === true ? "t0.regressed" : better(r.score, base.score) === false ? "t0.flat" : null) : null;
    out.push({ ledger: "trials", row_digest: rowDigest(l), run_id: r.run_id ?? null, class: klass, summary: `scope ${r.scope_id} round ${r.round} attempt ${r.attempt}: ${r.status}${r.delta ? ` (${r.delta})` : ""}` });
  });
  for (const l of rowsOf(LEDGERS.gates(cwd, slug))) { const r = J(l); if (r?.decision === "loop") out.push({ ledger: "gates", row_digest: rowDigest(l), run_id: r.run_id ?? null, class: "round.ge2", summary: `${r.gate} answered loop (round ${r.round ?? "?"})` }); }
  console.log(JSON.stringify({ ok: true, classes: runClasses(cwd, slug), attempts_cost: attemptsCost(cwd, slug), earlier_runs: readIndex(cwd).filter((r) => r.slug !== slug).length, rows: out }, null, 2));
  process.exit(0);
}
