// A RUN'S CLOSE READS ITS OWN RECORDS, AND ITS QA HUNT GETS THE WAY IN THE JUDGE GOT.
//
// 1. A run opened afresh over a slug that already ran keeps the earlier run's `evaluate-r<N>.json`,
//    gate rows, T0 verdicts and build gates beside its own. The close read them all: a run whose last
//    round PASSed closed `final_verdict: FAIL` from the earlier run's round 3, and its Rounds and
//    Decisions tables carried the earlier run's rows. Each is now scoped to this run's key.
// 2. A mobile deliverable has no URL. The hunt order carried only `app_url: null`, and the hunter
//    reported "no reachable deliverable" and hunted nothing over a build the round gate had launched.
//    Hunt orders now carry `launch_cmd` and `build_gate`, as evaluate orders do.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the own-records checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { deriveLedgerFacts } = await import(join(ROOT, "kernel/probe/resume.mjs"));
  section("162. A close reads only its own run's records, and a hunt order carries the launch evidence");

  const d = mkdtempSync(join(tmpdir(), "own-run-"));
  const w = (rel, body) => { const p = join(d, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2)); };
  const NEW = "demo-20260102T000000Z-bbbbbbbb", OLD = "demo-20260101T000000Z-aaaaaaaa";
  try {
    w(".shapeup/demo/receipt.json", { slug: "demo", run_id: NEW, started_at: "2026-01-02T00:00:00Z", intake_sha256: "1".repeat(64) });
    const res = (n, overall) => w(`.shapeup/demo/results/evaluate-r${n}.json`, { schema_version: 1, order_id: `demo/evaluate-r${n}`, worker: "spec-evaluator", status: "done", verdict: { overall, criteria: [{ criterion: "x", verdict: overall }] } });
    const ord = (n, run_id) => w(`.shapeup/demo/orders/evaluate-r${n}.json`, { schema_version: 1, order_id: `demo/evaluate-r${n}`, run_id, worker: "spec-evaluator", mode: "orchestrated", payload: {} });
    res(1, "FAIL"); ord(1, NEW); res(2, "PASS"); ord(2, NEW); res(3, "FAIL"); ord(3, OLD);
    w(".shapeup/demo/gates.jsonl", [
      { gate: "L3", decision: "loop", run_id: OLD, round: 3 },
      { gate: "L3", decision: "loop", run_id: NEW, round: 2, verdict: "pass" },
    ].map((x) => JSON.stringify(x)).join("\n") + "\n");
    w(".shapeup/demo/t0/verdicts/r3-a1-t1.json", { round: 3, overall: "red", run_id: OLD, scope_id: "s" });
    w(".shapeup/demo/t0/verdicts/r2-a1-t1.json", { round: 2, overall: "green", run_id: NEW, scope_id: "s" });
    w(".shapeup/demo/build/r3-t1.json", { overall: "red", run_id: OLD });
    const f = deriveLedgerFacts(d, "demo");
    if (f.final_verdict === "PASS") ok("the final verdict is this run's last round, not a later-numbered round of an earlier run");
    else fail(`final_verdict = ${f.final_verdict}`);
    if (f.decisions.length === 1 && f.decisions[0].run_id === NEW) ok("the Decisions table holds only this run's gate rows");
    else fail(`decisions: ${JSON.stringify(f.decisions)}`);
    if (!f.roundRows.some((r) => /\| 3 \|/.test(r))) ok("no round of the earlier run appears in this run's Rounds table");
    else fail(`round rows: ${JSON.stringify(f.roundRows)}`);

    // A hunt order compiled with the workflow's payload carries the launch evidence.
    w("shapeup/demo/project-profile.md", ["---", "schema_version: 1", "archetype: mobile", "entry_point: src/a.ets", 'launch_probe: "./scripts/launch.sh"', "---", "", "# p", ""].join("\n"));
    w(".shapeup/demo/build/r1-t1.json", { overall: "green", run_id: NEW, steps: [] });
    const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "compile", "--operation", "hunt", "--slug", "demo", "--round", "1",
      "--payload", JSON.stringify({ feature: "demo", round: 1 }), "--cwd", d], { encoding: "utf8" });
    let p = {}; try { p = JSON.parse(readFileSync(r.stdout.trim(), "utf8")).payload; } catch { /* reported */ }
    if (p.launch_cmd === "./scripts/launch.sh" && p.build_gate === ".shapeup/demo/build/r1-t1.json") ok("a hunt order carries launch_cmd and this run's build gate");
    else fail(`hunt payload: ${JSON.stringify(p)} (exit ${r.status}: ${r.stderr.trim().slice(0, 160)})`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
