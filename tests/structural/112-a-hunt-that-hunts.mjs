// A HUNT OVER A REACHABLE APP RAN NO CHARTER, AND RETURNED DONE.
//
// The hunter ran the launch command, reached the emulator, swept the fault log clean — and drafted
// no charter. It returned `done`, and a `done` with no findings reads as an app with nothing wrong.
// A `done` hunt whose order gave it a way into the app must have run at least one charter, or it is
// refused on ingest and by `probe hunt`, and the run sends the hunter back once. A `failed` hunt, or
// one with no way in, is not held to it.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the hunt checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { chartersRun, huntProblem } = await import(join(ROOT, "kernel/probe/hunt.mjs"));

  section("166. A done hunt over a reachable app ran a charter, or it is refused and the hunter sent back once");

  if (chartersRun("x\ncharters: 3/3 · units 3") === 3 && chartersRun("charters: 0/0 interactive") === 0 && chartersRun("no line") === null && chartersRun(null) === null) {
    ok("the charter count is read off the report's charters line, and absent means unknown, not zero");
  } else fail("chartersRun misread a report");

  const zero = "# Hunt\ncharters: 0/0 · reach + fault sweep only\n";
  const three = "# Hunt\ncharters: 3/3\n";
  const reach = { launch_cmd: "./scripts/launch-probe.sh" };
  const cases = [
    [huntProblem({ status: "done" }, reach, zero), true, "done, reachable, zero charters"],
    [huntProblem({ status: "done" }, { app_url: "http://x" }, zero), true, "done, served app, zero charters"],
    [huntProblem({ status: "done" }, reach, null), true, "done with no report"],
    [huntProblem({ status: "done" }, reach, three), false, "done with charters"],
    [huntProblem({ status: "failed" }, reach, zero), false, "a failed hunt says it could not hunt"],
    [huntProblem({ status: "done" }, {}, zero), false, "no way into the app"],
  ];
  const wrong = cases.filter(([got, want]) => !!got !== want).map(([, , name]) => name);
  if (!wrong.length) ok("refused: a done hunt over a reachable app with no charter or no report; accepted: charters ran, a failed hunt, no way in");
  else fail(`huntProblem wrong on: ${wrong.join("; ")}`);

  const d = mkdtempSync(join(tmpdir(), "hunt-"));
  const put = (rel, text) => { const p = join(d, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
  const K = (...a) => spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...a, "--cwd", d], { encoding: "utf8" });
  try {
    put(".shapeup/demo/orders/hunt.json", JSON.stringify({ schema_version: 1, order_id: "demo/hunt", worker: "qa-edge-hunter", mode: "orchestrated",
      run_id: "demo-20260927T000000Z-deadbeef", compiled_at: "2026-09-27T00:00:00.000Z", substrate: { allowed: [".shapeup/demo/qa/**"] },
      payload: { feature: "demo", launch_cmd: "./scripts/launch-probe.sh" } }));
    put(".shapeup/demo/results/hunt.json", JSON.stringify({ schema_version: 1, order_id: "demo/hunt", worker: "qa-edge-hunter", status: "done",
      discoveries: [], artifacts: [".shapeup/demo/qa/hunt-report.md"] }));
    put(".shapeup/demo/qa/hunt-report.md", zero);

    const p0 = K("probe", "hunt", "--slug", "demo");
    let o0 = {}; try { o0 = JSON.parse(p0.stdout); } catch { /* reported below */ }
    if (p0.status === 1 && o0.ok === false && o0.qa === "not-hunted" && o0.status === "done" && /0 charters/.test(o0.reason || "")) {
      ok("probe hunt refuses the zero-charter hunt with its reason — what the run hands the hunter on the second dispatch");
    } else fail(`probe hunt (zero): exit ${p0.status} ${p0.stdout}`);

    const i0 = K("reduce", "ingest", "--order", join(d, ".shapeup/demo/orders/hunt.json"), "--no-receipt-check");
    if (i0.status === 1 && /result refused — the hunt returned done/.test(i0.stderr)) ok("ingest refuses the same result and writes nothing");
    else fail(`ingest (zero): exit ${i0.status} ${i0.stderr.slice(0, 200)}`);

    put(".shapeup/demo/qa/hunt-report.md", three);
    const p3 = K("probe", "hunt", "--slug", "demo");
    let o3 = {}; try { o3 = JSON.parse(p3.stdout); } catch { /* reported below */ }
    if (p3.status === 0 && o3.ok === true && o3.qa === "run" && o3.charters_run === 3) ok("a hunt that ran charters is accepted as run");
    else fail(`probe hunt (three): exit ${p3.status} ${p3.stdout}`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }

  const wf = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
  const qa = wf.slice(wf.indexOf('skill: "qa-edge-hunter"') - 300, wf.indexOf("// ---- GATE H"));
  if (/sendBackOnce\(/.test(qa) && /probe hunt --slug/.test(qa) && /qaState = hv\?\.qa === "run"/.test(qa)) ok("the run sends a refused hunt back once, and takes QA's state from the hunt's own record");
  else fail("the workflow no longer checks the hunt through probe hunt");
  if (/--qa \$\{qaState\}/.test(wf) && /qa: qaState,/.test(wf) && /qa=\$\{ret\.qa\}/.test(wf)) ok("the ship report, the run's return and the close line carry the same QA state");
  else fail("the QA state no longer reaches the report, the return and the close together");
}
