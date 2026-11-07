// The archived real run is held to the same two predicates as the driven one. Section 179.
//
// `traces/v4/one-page-site-fold-2026-11-07` is a run that went from an empty project to a shipped close in
// ONE launch of the loop, with the hook layer writing the dispatch receipts and the kernel writing the leg
// rows — nothing in it is a fixture. The driven run in section 176 fakes its sub-agents, so on that run the
// receipt side of "no courier" holds by construction; here it does not, and the equality is evidence.
//
// WHAT THE ARCHIVE SHOWS, and what it predates. It was recorded before the stop census became the loop's own
// step, so its census was a dispatch of the since-retired `scope-hammer` worker: that receipt names a skill
// outside today's roster, is reported as such, and is not counted as a worker dispatch. The orient order
// carries two receipts (two agents named it); a receipt is a dispatch, the order is the unit, so orders are
// counted distinct. Neither adjustment loosens the check — the equality is exact, and a courier still breaks it.
//
// READ-ONLY. The trace is read in place and never written; a checkout without it skips with a note.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readJsonl, workerRoster, courierFindings, relaunchFindings } from "../lib/run-shape.mjs";

/**
 * Run the archived-run checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("179. The archived real run: no courier, no relaunch — the same predicates, over records the hooks wrote");

  const local = join(ROOT, "traces/v4/one-page-site-fold-2026-11-07/shapeup-local");
  if (!existsSync(join(local, "legs.jsonl"))) { ok("the archived v4 run is absent — nothing to hold to the predicates (skipped, not failed)"); return; }

  const workers = workerRoster(ROOT);
  const legs = readJsonl(join(local, "legs.jsonl"));
  const receipts = readJsonl(join(local, "receipts", "dispatch.jsonl"));
  const cf = courierFindings({ legs, receipts, workers });

  if (cf.equal) ok(`no courier: ${cf.legs} leg rows = ${cf.workerOrders.length} worker-attested orders (${cf.workerOrders.map((o) => o.split("/")[1]).join(", ")}) + ${cf.planLegs} fence-only plan orders`);
  else fail(`the archived leg ledger does not close against its dispatch receipts: ${JSON.stringify(cf)}`);
  if (cf.workerOrders.length === 4 && cf.planLegs === 4) ok("the four workers dispatched once each and the four planning substeps each ran as a fence order — 4 + 4, nothing else spawned");
  else fail(`the archive's shape moved: ${cf.workerOrders.length} worker orders, ${cf.planLegs} plan legs`);
  if (!cf.foreignLegWorkers.length) ok("every leg row names one of the roster's workers or `building` — no row names a courier");
  else fail(`a leg row names a worker outside the roster: ${cf.foreignLegWorkers.join(", ")}`);
  if (cf.retiredReceipts.every((s) => s === "scope-hammer")) ok(`the only receipt outside today's roster is the retired census worker (${cf.retiredReceipts.join(", ") || "none"}) — the archive predates the loop doing the census itself`);
  else fail(`a receipt names a skill that is neither a worker nor the retired census worker: ${cf.retiredReceipts.join(", ")}`);
  const notWorkerReceipts = receipts.filter((r) => !r.tool || r.tool === "Skill").length === receipts.length;
  if (notWorkerReceipts) ok("every receipt is a Skill dispatch the hook layer saw — nothing is a bare Agent call that ran no skill");
  else fail("a receipt records something other than a Skill dispatch");

  const gates = readJsonl(join(local, "gates.jsonl"));
  const receipt = JSON.parse(readFileSync(join(local, "receipt.json"), "utf8"));
  const rf = relaunchFindings({ gates, ledgerText: readFileSync(join(local, "harness-run.md"), "utf8"), runId: receipt.run_id });
  if (rf.ok) ok(`no relaunch: all ${gates.length} gate rows carry the one run id, the ledger holds no relaunch or reopen marker, and the close (${rf.closedAt}) is the last thing written`);
  else fail(`the archived run reads as relaunched: ${JSON.stringify(rf)}`);
  const summary = JSON.parse(readFileSync(join(ROOT, "traces/v4/one-page-site-fold-2026-11-07/SUMMARY.json"), "utf8"));
  if (summary.launches === 1) ok("the archive's own summary records one launch, matching what the ledgers show");
  else fail(`the summary says ${summary.launches} launches`);
}
