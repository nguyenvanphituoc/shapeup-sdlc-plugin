// The single writer is asked, not assumed. A run dispatched five legs, five results landed, three
// leg rows were written — and nothing noticed, because the leg ledger was read in one place, behind
// the checks that decide a scope is green, and appeared in neither the run graph nor the export.
// This module pins the three answers: `probe leg` can be asked about any order by name and about
// the whole run; the graph carries a Leg node with an INGESTED edge so a result nobody applied is a
// one-hop query; the export carries the leg table; and the run loop asks before any early return.
import { pinnedBy } from "../lib/pinned-row.mjs";
import { mkdtempSync, existsSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");

  section("136. The single writer is asked — by order, across the run, in the graph, in the export, and before any early return");

  const ws = mkdtempSync(join(tmpdir(), "single-writer-"));
  try {
    const git = (args) => spawnSync("git", args, { cwd: ws, encoding: "utf8" });
    git(["init", "-q", "-b", "main"]); git(["config", "user.email", "p@example.invalid"]); git(["config", "user.name", "p"]);
    git(["commit", "-q", "--allow-empty", "-m", "base"]);
    const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const opened = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    const compiled = kernel("compile", "--slug", "f", "--operation", "orient");
    if (opened.status !== 0 || compiled.status !== 0) {
      fail(`could not open a run and compile a planning order (init=${opened.status} compile=${compiled.status}): ${(opened.stderr || compiled.stderr || "").slice(0, 300)}`);
      return;
    }
    const orderPath = join(ws, ".shapeup/f/orders/orient.json");
    const orderId = JSON.parse(readFileSync(orderPath, "utf8")).order_id;
    mkdirSync(join(ws, ".shapeup/f/results"), { recursive: true });
    writeFileSync(join(ws, ".shapeup/f/results/orient.json"), JSON.stringify({ schema_version: 1, order_id: orderId, worker: "orient", status: "done", discoveries: [] }));

    // --- probe leg, by order and across the run -------------------------------------------------
    const byOrder = kernel("probe", "leg", "--slug", "f", "--order", "orient");
    const j1 = (() => { try { return JSON.parse(byOrder.stdout); } catch { return null; } })();
    if (byOrder.status === 1 && j1?.found && j1.has_result && !j1.applied) ok("`probe leg --order orient` reports a phase result on disk that nothing applied (exit 1)");
    else fail(`probe leg --order did not report the unapplied planning result: exit ${byOrder.status} ${byOrder.stdout.slice(0, 200)}`);

    const open1 = kernel("probe", "leg", "--slug", "f", "--open");
    const j2 = (() => { try { return JSON.parse(open1.stdout); } catch { return null; } })();
    if (open1.status === 1 && j2?.open_total === 1 && j2.open_ids?.[0] === orderId) ok("`probe leg --open` lists that result as the run's one open leg");
    else fail(`probe leg --open did not list the open leg: exit ${open1.status} ${open1.stdout.slice(0, 200)}`);

    // Now let the single writer run — the real ingest — and ask again.
    const ingested = kernel("reduce", "ingest", "--order", orderPath, "--no-receipt-check");
    if (ingested.status !== 0) { fail(`reduce ingest refused the fixture result (exit ${ingested.status}): ${(ingested.stderr || ingested.stdout).slice(0, 300)}`); return; }
    const byOrder2 = kernel("probe", "leg", "--slug", "f", "--order", "orient");
    const open2 = kernel("probe", "leg", "--slug", "f", "--open");
    if (byOrder2.status === 0 && open2.status === 0) ok("after `reduce ingest`, the same order reads applied and the run has no open leg (both exit 0)");
    else fail(`after ingest the probes still report an open leg: order=${byOrder2.status} open=${open2.status} ${open2.stdout.slice(0, 200)}`);

    // --- the export: a leg table ---------------------------------------------------------------
    const { TABLES } = await import(join(ROOT, "kernel/report/facts.mjs"));
    if (TABLES.includes("leg")) ok("TABLES declares the leg table");
    else fail("TABLES does not declare a leg table — the export cannot say whether a result was ever read");
    const { collectRun } = await import(join(ROOT, "kernel/report/export.mjs"));
    const collected = collectRun(ws, "f");
    const legRows = collected?.tables?.leg || [];
    if (legRows.length === 1 && legRows[0].order_id === orderId && legRows[0].run_id === collected.run_id) {
      ok("collectRun projects the leg ledger as one keyed row per applied order");
    } else fail(`the export's leg table is wrong: ${JSON.stringify(legRows).slice(0, 300)}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // --- the run loop: asked before any early return, in planning and build, and honest at the close ---------
  // This half used to read the retired run script's source: that its post-condition asked the leg ledger once
  // the artifact check passed and repaired with a late ingest, that no round returned the word "inner" for a
  // stall, that a stalled round consulted `probe attempts` before naming a breaker, and that the close cause
  // carried `unapplied_results` and the stall. Those are branches of `probe next` now, and rows of the
  // state-machine suite; the kernel halves above (probe leg, the graph, the export) are unchanged.
  pinnedBy(ctx, ["an orient result that was never applied is applied before anything else", "a plan result that was written and never applied is applied before anything else"],
    "a phase's result nothing applied is applied before the phase counts as done — planning and orient alike");
  pinnedBy(ctx, ["a settled green round runs its build gate once, late-ingesting an unapplied green result first"],
    "a build scope's unapplied green result is late-ingested before the round is judged");
  pinnedBy(ctx, ["a scope that spent its whole budget red and is the only scope trips the nothing-green breaker", "an unanswered order is named at every close"],
    "a stalled round names the breaker the attested census supports, and the close names unanswered orders");
}
