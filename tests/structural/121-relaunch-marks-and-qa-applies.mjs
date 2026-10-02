// THREE DEFECTS FROM ONE REAL SOAK, ONE GUARD EACH — measured on `rename-appends` and
// `clear-completed` (two consecutive features, one uncleaned run trace, plugin 3.18.3).
//
// 1. A run killed mid-EVAL and resumed by a fresh process (not a reopen — its status never left a
//    live one) re-crossed L1a, L1a.5, L1b and L2 with nothing on the ledger to tell that second
//    crossing from the first. `markRelaunch` leaves the same kind of timestamp the reopen path
//    already leaves in `prior_closes`, in its own `relaunches` field, and `deriveLedgerFacts` reads
//    either marker when it numbers a gate row's launch.
// 2. A QA hunt's result landed with a finding, and nothing ingested it — `legs.jsonl` carried a row
//    for every other order and none for `hunt` — while GATE H's census and the frozen report both
//    said the finding was "carried to ledger". The orchestrator now asks the leg ledger about the
//    hunt the same way `requireLeg` already asks it about ORIENT/ANALYZE/WIRE/MAP-SCOPES, late-
//    ingests a result nothing applied, and — QA never gates — names it at the close instead of
//    aborting.
// 3. The L0 profile WIRE requires was checked at WIRE, after a full planning pass (21 agents, ~770K
//    subagent tokens) had already been paid for. The same check now runs where `rs` is first read,
//    before ORIENT dispatches anything.
import { mkdtempSync, rmSync, appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the checks for all three fixes.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  section("121. A relaunch over an unclosed run is marked, and a QA leg nothing applied is named at the close");

  // ---- 1. markRelaunch is read by deriveLedgerFacts, the same as a reopen's timestamp -----------
  {
    const { markRelaunch, deriveLedgerFacts } = await import(join(ROOT, "kernel/probe/resume.mjs"));
    const { readRunId } = await import(join(ROOT, "kernel/lib/paths.mjs"));
    const w = mkdtempSync(join(tmpdir(), "mark-relaunch-"));
    const K = (...a) => spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...a, "--cwd", w], { cwd: w, encoding: "utf8", timeout: 30_000 });
    const gatesFile = join(w, ".shapeup/checkout/gates.jsonl");
    const gateRow = (gate, at) => appendFileSync(gatesFile, JSON.stringify({ at, run_id: readRunId(w, "checkout"), gate, status: "ok",
      decision: "proceed", source: "preset:ci", note: "pre-approved", round: null }) + "\n");
    try {
      const o = K("init", "run", "--slug", "checkout", "--intake-text", "Add checkout flow", "--auto-level", "unattended");
      if (o.status !== 0) throw new Error(`init run failed: ${o.stderr}`);

      gateRow("L1a", "2020-01-01T00:00:01.000Z");
      const mr = markRelaunch(w, "checkout");
      if (mr.ok && mr.at) ok("markRelaunch writes a timestamp to harness-run.md's relaunches field");
      else fail(`markRelaunch: ${JSON.stringify(mr)}`);

      gateRow("L1a", new Date(new Date(mr.at).getTime() + 1000).toISOString());
      const facts = deriveLedgerFacts(w, "checkout");
      const rows = facts.decisions.filter((d) => d.gate === "L1a");
      if (rows.length === 2 && rows[0].launch === 1 && rows[1].launch === 2 && rows[1].via === "relaunch") {
        ok("a gate signed again after a plain relaunch (no close, no reopen) reads as launch 2, tagged 'relaunch' not 'reopen'");
      } else fail(`L1a rows: ${JSON.stringify(rows)}`);
    } finally {
      rmSync(w, { recursive: true, force: true });
    }
  }

  // ---- 2 & 3. The orchestrator's own source carries both fixes, in the right order --------------
  {
    const src = ctx.read(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"))
      .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

    const profileCheckAt = src.search(/rs\.has_wiring_map\s*&&\s*!rs\.has_project_profile/);
    const orientDispatchAt = src.search(/dispatchOrient\s*=\s*\(/);
    if (profileCheckAt > -1 && orientDispatchAt > -1 && profileCheckAt < orientDispatchAt) {
      ok("the project-profile precondition is checked before ORIENT's own dispatch is built, not only at WIRE");
    } else fail(`profile check at ${profileCheckAt}, orient dispatch at ${orientDispatchAt} — the check can still run after a full planning pass`);

    const hunLegCheckAt = src.search(/query\(`probe leg --slug \$\{slug\} --order "hunt"`/);
    const qaBlockAt = src.search(/operation:\s*"hunt"/);
    if (hunLegCheckAt > -1 && qaBlockAt > -1 && hunLegCheckAt > qaBlockAt) {
      ok("the QA block asks the leg ledger whether the hunt's result was applied");
    } else fail(`hunt leg check at ${hunLegCheckAt}, hunt dispatch at ${qaBlockAt} — QA may still ship an unapplied result unnoticed`);

    if (/unapplied_results:\s*allUnapplied/.test(src)) {
      ok("a normal shipped close carries unapplied_results, not only a GATE-H breaker's close");
    } else fail("the shipped RunReturn does not carry unapplied_results — a QA leg nothing applied ships silently");

    if (/Array\.isArray\(ret\.unapplied_results\)[\s\S]{0,40}ret\.unapplied_results\.length[\s\S]{0,60}unapplied_results=/.test(src)) {
      ok("the close cause line can print unapplied_results on the shipped branch, not only the gate_h branch");
    } else fail("the shipped branch's close-cause formatter still never mentions unapplied_results");
  }
}
