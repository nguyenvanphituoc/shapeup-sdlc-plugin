#!/usr/bin/env node
// probe requirements — the way back: a pitch clause, the criterion that graded it, the verdict.
//
// WHY THIS IS A QUERY AND NOT A SENTENCE, which is the same reason `probe owner` is one. The
// requirement matrix is read at GATE L4 and cited by GATE H's census, and both are places where a
// narrated figure is indistinguishable from a measured one. Measured on the first verdict any run
// of the spine produced: 85 of 97 criterion rows carried a `traces_to` anchor in the WorkResult and
// 0 of 97 survived into the projection ingest wrote — so a matrix assembled from memory would have
// been assembled from an edge that no longer existed on disk. Every figure below is derived from
// files: the committed registry, the board's `covers:` clauses, the verdict ledger, and the EVAL
// result's own T0 citations. Nothing is passed in and nothing is written.
//
// THE JOIN, and which half is authoritative. A requirement has EVIDENCE when an acceptance
// criterion covers it (`(covers: REQ-…)` on the AC line — the planning-time edge, reviewed at L1b)
// AND a criterion that names it passed. `traces_to[]` is the navigation path from the judge's
// criterion back to the requirement, exactly what the schema already calls it: an anchor, never a
// grading input. A criterion whose `traces_to` names a REQ that no AC covers is printed as an
// INCONSISTENCY row and counted as nothing — folding it in would derive one L4 line from two
// unreconciled sources, which is the failure `probe owner` exists to prevent.
//
// IT PROJECTS ONE RUN. `order_id`, round and attempt all repeat across runs of one feature; the
// run key is the only thing that separates them, so a projection that ignored it would silently mix
// two runs of one slug. Rows written before the key reached the ledger carry no `run_id`; they are
// reported as unknown rather than folded into the run being projected.
//
// AN EMPTY JOIN READS AS CLEARLY AS A FULL ONE. A tree with no registry, a board with no `covers:`
// and a run with no verdict are all legitimate states, and each answers "no evidence" rather than
// failing — that answer is the point of the query, not an error in it.
//
// Usage:
//   node "${CLAUDE_PLUGIN_ROOT}/kernel/harness.mjs" probe requirements --slug <slug> [--run-id <id>] [--format json|table] [--cwd <dir>]
//
// Exit code: 0 = answered (an empty projection is an answer), 2 = bad argv.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { runArgs, isMain } from "../lib/argv.mjs";
import { requirements as requirementsFile, evaluationDir, resultsDir, readRunId } from "../lib/paths.mjs";
import { parseRequirements, coveredReqIds } from "../verify/trace.mjs";
import { readBoard } from "../compile.mjs";
import { reqId } from "../lib/contract.mjs";

/**
 * Read a file, tolerating absence — every input to this projection is optional by design.
 * @param {string} p - Absolute path.
 * @returns {(string|null)} The contents, or null when the file is missing or unreadable.
 */
function readIf(p) {
  try { return existsSync(p) ? readFileSync(p, "utf8") : null; } catch { return null; }
}

/**
 * The acceptance criteria on the LOCAL board that cover each requirement.
 *
 * The planning-time half of the join, and the authoritative one: a `covers:` clause is written when
 * the plan is still cheap to change and is reviewed at L1b, whereas `traces_to` is written by the
 * judge after the fact.
 *
 * NOT A SECOND COVERS-CLOSURE. Whether a requirement is covered is still decided by
 * `coveredReqIds` in the oracle — there is one implementation of that question and this is not it.
 * This walk exists only to keep the AC the closure discards, so the matrix can print WHICH
 * criterion covers the clause instead of only that one does.
 *
 * @param {Array<object>} board - Task entries from `readBoard` (the only parser that carries
 *   `acceptance_criteria`; the scheduling view does not).
 * @returns {Map<string, Array<{task_id:string, ac:string}>>} REQ-id → the ACs naming it, in board
 *   order. A requirement no AC covers is simply absent.
 */
export function coveringAcs(board) {
  const out = new Map();
  for (const task of board || []) {
    for (const ac of task.acceptance_criteria || []) {
      if (typeof ac !== "object" || !Array.isArray(ac.covers)) continue;
      for (const raw of ac.covers) {
        const id = reqId(raw).toUpperCase();
        if (!out.has(id)) out.set(id, []);
        out.get(id).push({ task_id: task.id, ac: ac.text });
      }
    }
  }
  return out;
}

/**
 * Every criterion row ingest projected, tagged with the EVAL target its ledger belongs to.
 *
 * The target is read off the FILE NAME rather than the row: `.verdicts-<target>.jsonl` is written
 * per order, so the file is what says which dispatch produced the rows, and the same file is what
 * locates the WorkResult carrying that dispatch's T0 citations.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @returns {Array<object>} One entry per ledger line, each the stored row plus `target`. Malformed
 *   lines are skipped; a missing evaluation directory yields [].
 */
export function readVerdictRows(cwd, slug) {
  const dir = evaluationDir(cwd, slug);
  let files = [];
  try { files = readdirSync(dir).filter((f) => /^\.verdicts-.+\.jsonl$/.test(f)).sort(); } catch { return []; }
  const rows = [];
  for (const f of files) {
    const target = f.replace(/^\.verdicts-/, "").replace(/\.jsonl$/, "");
    for (const line of (readIf(join(dir, f)) || "").split(/\r?\n/)) {
      if (!line.trim()) continue;
      try { rows.push({ ...JSON.parse(line), target }); } catch { /* a truncated line is not a verdict */ }
    }
  }
  return rows;
}

/**
 * The T0 artifacts an EVAL dispatch re-hashed, read from the WorkResult it wrote.
 *
 * The verdict ledger records criteria, not citations, so the machine fact a generator cannot
 * fabricate lives one file over — in `results/<target>.json`. Read here rather than recomputed: the
 * evaluator's own citation is what the round was accepted on.
 *
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {string} target - The EVAL order suffix (`evaluate-r1`), from the ledger's file name.
 * @returns {Array<{scope_id:(string|null), path:(string|null), sha256:(string|null)}>} The cited
 *   artifacts; [] when the result is absent, unreadable or cites none.
 */
export function t0Citations(cwd, slug, target) {
  const body = readIf(join(resultsDir(cwd, slug), `${target}.json`));
  if (!body) return [];
  try {
    const cites = JSON.parse(body)?.verdict?.t0_citations;
    if (!Array.isArray(cites)) return [];
    return cites.map((c) => ({ scope_id: c?.scope_id ?? null, path: c?.path ?? null, sha256: c?.sha256 ?? null }));
  } catch { return []; }
}

/**
 * Project one run's requirement matrix from the artifacts on disk.
 *
 * @param {{cwd:string, slug:string, runId?:(string|null)}} opts - Project root, feature slug, and
 *   the run to project; omitted, it is resolved from the run's own receipt.
 * @returns {{slug:string, run_id:(string|null), registry:boolean, totals:object,
 *   rows:Array<object>, inconsistencies:Array<object>, ledger:object}} `rows` is one entry per
 *   registered clause — its source, status, covering ACs, the criteria that named it and their
 *   verdicts, and each criterion's T0 citations — with `evidence` one of `PASS`, `no evidence` or
 *   `cut`. `inconsistencies` holds criteria tracing to a REQ no AC covers. `ledger` says how many
 *   rows were read, projected, skipped as another run's, and left unkeyed. No registry ⇒ `rows` is
 *   empty and `registry` is false: an empty projection, not an error.
 */
export function projectRequirements({ cwd, slug, runId = undefined }) {
  const regText = readIf(requirementsFile(cwd, slug));
  const clauses = regText === null ? [] : parseRequirements(regText);
  const board = readBoard(cwd, slug);
  // `covered` decides; `acs` only says which criterion did the covering.
  const covered = coveredReqIds(board);
  const acs = coveringAcs(board);
  const run = runId === undefined ? readRunId(cwd, slug) : runId;

  const all = readVerdictRows(cwd, slug);
  const ledger = { rows_read: all.length, rows_projected: 0, rows_other_run: 0, rows_unknown_run: 0 };
  const mine = [];
  for (const r of all) {
    if (r.run_id === undefined || r.run_id === null || r.run_id === "") { ledger.rows_unknown_run++; continue; }
    if (run !== null && r.run_id === run) { ledger.rows_projected++; mine.push(r); continue; }
    ledger.rows_other_run++;
  }

  // The criteria that name each requirement, and the T0 artifacts the round that graded them cited.
  const t0Cache = new Map();
  /**
   * The cited T0 artifacts for one EVAL target, read once per target.
   * @param {string} target - The EVAL order suffix.
   * @returns {Array<object>} The citation rows.
   */
  const t0For = (target) => {
    if (!t0Cache.has(target)) t0Cache.set(target, t0Citations(cwd, slug, target));
    return t0Cache.get(target);
  };

  const byReq = new Map();
  const inconsistencies = [];
  for (const r of mine) {
    const anchors = Array.isArray(r.traces_to) ? r.traces_to : [];
    for (const raw of anchors) {
      const id = reqId(raw).toUpperCase();
      const entry = {
        criterion: r.criterion ?? "", dimension: r.dimension ?? "", verdict: r.verdict ?? "",
        confidence: r.confidence ?? null, evidence: r.evidence ?? "", target: r.target,
        run: r.run ?? null, run_id: r.run_id ?? null, t0: t0For(r.target),
      };
      // THE AUTHORITATIVE HALF DECIDES. An anchor pointing at a requirement no acceptance criterion
      // covers is a claim the plan never made; it is printed so somebody can reconcile it, and
      // counted as nothing.
      if (!covered.has(id)) { inconsistencies.push({ requirement: id, ...entry, why: "no acceptance criterion covers this requirement — the anchor resolves to nothing the plan claimed" }); continue; }
      if (!byReq.has(id)) byReq.set(id, []);
      byReq.get(id).push(entry);
    }
  }

  const rows = clauses.map((c) => {
    const id = c.id.toUpperCase();
    const covering = acs.get(id) || [];
    const criteria = byReq.get(id) || [];
    const cut = c.status !== "covered";
    const passed = criteria.some((x) => String(x.verdict).toUpperCase() === "PASS");
    return {
      id: c.id,
      source: c.source || "",
      clause: c.clause || "",
      status: c.status,
      covering_acs: covering,
      criteria,
      t0: [...new Set(criteria.flatMap((x) => x.t0.map((t) => t.sha256).filter(Boolean)))],
      evidence: cut ? "cut" : passed ? "PASS" : "no evidence",
    };
  });

  const totals = {
    total: rows.length,
    pass: rows.filter((r) => r.evidence === "PASS").length,
    cut: rows.filter((r) => r.evidence === "cut").length,
    no_evidence: rows.filter((r) => r.evidence === "no evidence").length,
    inconsistencies: inconsistencies.length,
  };
  return { slug, run_id: run, registry: regText !== null, totals, rows, inconsistencies, ledger };
}

/**
 * The one-line summary GATE L4 prints and GATE H's census cites.
 *
 * @param {object} r - A report from {@link projectRequirements}.
 * @returns {string} `15/17 PASS · 1 CUT (PO) · 1 no evidence (REQ-12 ← R12)`, or the empty-run
 *   phrasing when there is no registry to project.
 */
export function summaryLine(r) {
  if (!r.registry) return "n/a (no registry)";
  if (!r.totals.total) return "0 requirements registered";
  const gaps = r.rows.filter((x) => x.evidence === "no evidence");
  const named = gaps.slice(0, 3).map((x) => (x.source ? `${x.id} ← ${x.source}` : x.id)).join(", ");
  const parts = [`${r.totals.pass}/${r.totals.total} PASS`];
  if (r.totals.cut) parts.push(`${r.totals.cut} CUT (PO)`);
  if (r.totals.no_evidence) parts.push(`${r.totals.no_evidence} no evidence (${named}${gaps.length > 3 ? ", …" : ""})`);
  if (r.totals.inconsistencies) parts.push(`${r.totals.inconsistencies} inconsistency ${r.totals.inconsistencies === 1 ? "row" : "rows"}`);
  return parts.join(" · ");
}

/**
 * Render the matrix as a fixed-width table for a human reading a gate block.
 * @param {object} r - A report from {@link projectRequirements}.
 * @returns {string} The header, one row per requirement, the summary line and any inconsistencies.
 */
export function renderTable(r) {
  const out = [];
  const head = ["REQ", "source", "status", "covering AC", "criterion", "verdict", "T0"];
  const rows = r.rows.map((x) => [
    x.id, x.source || "—", x.evidence,
    x.covering_acs.length ? `${x.covering_acs[0].task_id}: ${x.covering_acs[0].ac.slice(0, 40)}${x.covering_acs.length > 1 ? ` (+${x.covering_acs.length - 1})` : ""}` : "—",
    x.criteria.length ? `${x.criteria[0].criterion.slice(0, 40)}${x.criteria.length > 1 ? ` (+${x.criteria.length - 1})` : ""}` : "—",
    x.criteria.length ? x.criteria.map((c) => c.verdict).join(",") : "—",
    x.t0.length ? x.t0.map((h) => String(h).slice(0, 12)).join(",") : "—",
  ]);
  if (rows.length) {
    const w = head.map((h, i) => Math.max(h.length, ...rows.map((row) => String(row[i]).length)));
    const line = (row) => row.map((c, i) => String(c).padEnd(w[i])).join("  ").trimEnd();
    out.push(line(head), line(w.map((n) => "-".repeat(n))), ...rows.map(line), "");
  }
  out.push(`Requirements: ${summaryLine(r)}`);
  out.push(`run_id: ${r.run_id ?? "unknown"} · ledger rows read ${r.ledger.rows_read}, projected ${r.ledger.rows_projected}, other run ${r.ledger.rows_other_run}, unkeyed (run_id: unknown) ${r.ledger.rows_unknown_run}`);
  for (const i of r.inconsistencies) {
    out.push(`  ⚠ ${i.requirement}: "${String(i.criterion).slice(0, 60)}" ${i.verdict} — ${i.why}`);
  }
  return out.join("\n");
}

export const ARGV_SPEC = {
  usage: "harness.mjs probe requirements --slug <slug> [--run-id <id>] [--format json|table] [--cwd <dir>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  slug: { type: "str", required: true },
  "run-id": { type: "str" },
  format: { type: "enum", values: ["json", "table"], default: "json" },
  cwd: { type: "path" },
};

/**
 * Answer "which requirement has evidence, and from which criterion" from the artifacts on disk.
 *
 * @param {string[]} rawArgv - The subcommand's own arguments (harness.mjs strips the verb words).
 * @returns {Promise<void>} Exits 0 with the projection — an absent run, an absent registry and an
 *   absent verdict are all answers, never errors.
 */
export async function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  const report = projectRequirements({ cwd, slug: args.slug, runId: args.runId ?? undefined });
  console.log(args.format === "table" ? renderTable(report) : JSON.stringify(report, null, 2));
  process.exit(0);
}

if (isMain(import.meta.url)) cli(process.argv.slice(2));
