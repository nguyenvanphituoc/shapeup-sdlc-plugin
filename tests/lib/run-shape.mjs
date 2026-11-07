// The shape of a finished run's records, as two predicates over files — shared by the driven run and by an
// archived real one, so the property is stated once and can be tried against both.
//
// NO COURIER. Every agent a run spawns is a worker and leaves a row; nothing else spawns, so nothing else
// can leave a row. The count that says so: the leg ledger holds exactly one row per worker dispatch the hook
// layer attested (a dispatch receipt naming a current worker), plus one per fence-only `plan` order the loop
// opened and closed itself (worker `building`, no receipt, because no sub-agent runs). A courier — a
// sub-agent whose only job was to type a kernel command — would show up as a receipt with no leg row, or a
// leg row naming no worker, and this count would not close.
//
// NO RELAUNCH. A gate is answered in the session that reached it, so a run's gate rows carry one run id,
// the ledger carries no relaunch marker, and no gate row is written after the ledger's close unless a reopen
// stands between them. ONE GATE IS ALLOWED TO FOLLOW THE CLOSE, BY DESIGN: COACH-1, the retro's ownership
// question, is handed out by the shipped step itself and resolved after the run has closed. It is not a
// relaunch — it is exempt from the after-the-close count, named as such, and still held to the one run id.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Read a JSONL file into rows, skipping anything that does not parse.
 * @param {string} p - Path.
 * @returns {object[]} The rows; [] when the file is absent.
 */
export function readJsonl(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

/**
 * The worker roster, read off the schema that defines it — never typed here.
 * @param {string} ROOT - Plugin root.
 * @returns {string[]} The worker skill names.
 */
export function workerRoster(ROOT) {
  return JSON.parse(readFileSync(join(ROOT, "kernel/schemas/domain.schema.json"), "utf8")).$defs.WorkerName.enum;
}

/**
 * What the leg ledger and the dispatch receipts say about couriers.
 *
 * @param {{legs: object[], receipts: object[], workers: string[]}} o - The run's rows and the roster.
 * @returns {{legs:number, workerOrders:string[], planLegs:number, expected:number, foreignLegWorkers:string[], retiredReceipts:string[], equal:boolean}}
 *   `equal` is the property: legs === distinct worker-receipted orders + closed plan orders, and every leg's
 *   worker is a roster member or `building`. `retiredReceipts` names receipts for a skill outside the
 *   roster (a worker retired since the run was recorded) — reported, never counted as a worker dispatch.
 */
export function courierFindings({ legs, receipts, workers }) {
  const skillOf = (r) => String(r.skill_invoked ?? r.worker_declared ?? "").split(":").pop();
  const workerOrders = [...new Set(receipts.filter((r) => workers.includes(skillOf(r)) && r.dispatch_ok !== false).map((r) => String(r.order_id)))];
  const planLegs = legs.filter((l) => l.worker === "building" && l.operation === "plan").length;
  const foreignLegWorkers = [...new Set(legs.map((l) => l.worker).filter((w) => !workers.includes(w) && w !== "building"))];
  const retiredReceipts = [...new Set(receipts.map(skillOf).filter((s) => s && !workers.includes(s)))];
  const expected = workerOrders.length + planLegs;
  return { legs: legs.length, workerOrders, planLegs, expected, foreignLegWorkers, retiredReceipts, equal: legs.length === expected && !foreignLegWorkers.length };
}

/**
 * What the gate ledger and the run ledger say about relaunches.
 *
 * @param {{gates: object[], ledgerText: string, runId: string}} o - The run's gate rows, `harness-run.md`, and its receipt's run id.
 * @returns {{runIds:string[], relaunchMarked:boolean, reopened:boolean, rowsAfterClose:number, retroRowsAfterClose:number, closedAt:(string|null), ok:boolean}}
 *   `ok` is the property: one run id (the retro gate's row included), no relaunch marker, no reopen, and no gate row
 *   other than COACH-1 dated after the close; `retroRowsAfterClose` counts the exempt rows.
 */
export function relaunchFindings({ gates, ledgerText, runId }) {
  const line = (k) => (ledgerText.match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [])[1]?.trim() ?? null;
  const closedAt = line("closed_at");
  const closed = closedAt && closedAt !== "~" ? closedAt : null;
  const relaunches = line("relaunches");
  const priorCloses = line("prior_closes");
  const runIds = [...new Set(gates.map((g) => g.run_id).filter(Boolean))];
  const after = closed ? gates.filter((g) => g.at && g.at > closed) : [];
  const rowsAfterClose = after.filter((g) => g.gate !== "COACH-1").length;
  const retroRowsAfterClose = after.length - rowsAfterClose;
  const relaunchMarked = Boolean(relaunches && relaunches !== "~");
  const reopened = Boolean(priorCloses && priorCloses !== "~");
  return { runIds, relaunchMarked, reopened, rowsAfterClose, retroRowsAfterClose, closedAt: closed, ok: runIds.length === 1 && (!runId || runIds[0] === runId) && !relaunchMarked && !reopened && rowsAfterClose === 0 };
}
