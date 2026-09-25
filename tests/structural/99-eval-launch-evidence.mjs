// THE JUDGE IS TOLD THE APP WAS LAUNCHED, AND HOW TO LAUNCH IT AGAIN.
//
// A `[ui]` criterion is graded on the RUNNING app, and the evaluator's contract for getting one is
// `payload.run_cmd`: absent, an orchestrated evaluator escalates rather than guess. Two facts kept
// that contract unmet on a stack where building and launching are different acts:
//
//   1. THE LEDGER'S `run_cmd` IS THE BUILD. The round build gate runs it first, as the build, and
//      a run whose tech lead pinned none has no `run_cmd` at all — so the workflow's evaluate
//      payload carried nothing to start the app with.
//   2. A GREEN LAUNCH WAS PROVEN AND THEN UNAVAILABLE. The gate runs the project's launch probe
//      (install, start, assert the first screen) and records its output, but its artifact reached
//      an order only when RED, as the next round's bug list. Every `[ui]` row was graded "no
//      evidence on the running app" over a build that had launched.
//
// Measured on a live run: the only difference between a 6-of-35 verdict with fifteen ungraded rows
// and a 28-of-35 verdict with all fifteen graded was one field in the order.
//
// The kernel now derives two optional fields for every evaluate order — `build_gate` (this run's
// newest gate artifact) and `launch_cmd` (the profile's launch probe) — and `probe t0` prints the
// digest a T0 citation needs, so a session with no shell hasher it may run can still cite one. Each
// property is asserted by executing the kernel against a fixture.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Run the launch-evidence checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("152. An evaluate order names the launch evidence and the launch command, and probe t0 hands over its digest");
  // =============================================================================

  const K = (verb) => [join(ROOT, "kernel/harness.mjs"), ...verb.split(" ")];
  const { launchEvidenceFor } = await import(join(ROOT, "kernel/compile.mjs"));
  const { runIdFromReceipt } = await import(join(ROOT, "kernel/lib/paths.mjs"));
  const { evalVerdict } = await import(join(ROOT, "kernel/probe/eval.mjs"));

  const roots = [];
  const fixture = (name) => { const d = mkdtempSync(join(tmpdir(), `eval-launch-${name}-`)); roots.push(d); return d; };
  const w = (root, rel, body) => {
    const p = join(root, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
    return p;
  };
  const profile = (root, launchProbe) => w(root, "shapeup/demo/project-profile.md", [
    "---", "schema_version: 1", "archetype: mobile", "entry_point: src/app/Entry.ets",
    ...(launchProbe === undefined ? [] : [`launch_probe: ${JSON.stringify(launchProbe)}`]),
    "---", "", "# profile", "",
  ].join("\n"));
  const gate = (root, file, body = {}) => w(root, `.shapeup/demo/build/${file}`, {
    schema_version: 1, overall: "green",
    steps: [{ kind: "launch_probe", cmd: "./scripts/launch.sh", exit: 0, pass: true }], ...body,
  });
  const compileEval = (root, payload) => {
    const r = spawnSync("node", [...K("compile"), "--operation", "evaluate", "--slug", "demo", "--round", "1",
      "--payload", JSON.stringify(payload), "--cwd", root], { encoding: "utf8" });
    let order = null;
    try { order = r.status === 0 ? JSON.parse(readFileSync(r.stdout.trim(), "utf8")) : null; } catch { /* reported below */ }
    return { r, order };
  };
  // Exactly the payload the workflow's evaluate dispatch sends when the ledger pinned no run_cmd:
  // the key is dropped, never null (see the workflow's note on absent versus null).
  const WORKFLOW_PAYLOAD = { dimensions: ["spec-conformance"], round: 1 };

  try {
    // --- (a) which gate artifact: this round, newest by NUMBER, then any round when none is named --
    const a = fixture("which");
    gate(a, "r1-t2.json"); gate(a, "r1-t10.json"); gate(a, "r2-t1.json");
    const g1 = launchEvidenceFor(a, "demo", 1).build_gate;
    if (g1 === ".shapeup/demo/build/r1-t10.json") ok("build_gate is the round's newest trial, ordered as a number — t10 is newer than t2");
    else fail(`build_gate for round 1 was ${g1}; a string sort would read r1-t2 as newer than r1-t10`);
    const g2 = launchEvidenceFor(a, "demo", 2).build_gate;
    if (g2 === ".shapeup/demo/build/r2-t1.json") ok("build_gate is scoped to the round being evaluated — round 1's artifact is not round 2's evidence");
    else fail(`build_gate for round 2 was ${g2}, expected r2-t1`);
    const gAny = launchEvidenceFor(a, "demo", undefined).build_gate;
    if (gAny === ".shapeup/demo/build/r2-t1.json") ok("with no round (a standalone evaluation) build_gate is the newest of any round");
    else fail(`build_gate with no round was ${gAny}, expected r2-t1`);

    // --- (b) another run's launch evidence is not this run's ------------------------------------
    const b = fixture("run-scope");
    const receipt = { slug: "demo", started_at: "2026-01-02T00:00:00.000Z", intake_sha256: "b".repeat(64) };
    w(b, ".shapeup/demo/receipt.json", receipt);
    const mine = runIdFromReceipt(receipt);
    gate(b, "r1-t1.json", { run_id: mine });
    gate(b, "r1-t5.json", { run_id: "demo-20250101T000000Z-deadbeef" }); // a prior run's, newer ordinal
    const gb = launchEvidenceFor(b, "demo", 1).build_gate;
    if (gb === ".shapeup/demo/build/r1-t1.json") ok("a prior run's gate artifact over the same slug is not handed to this run's judge");
    else fail(`build_gate was ${gb} — it named another run's artifact, or none of this run's`);

    // --- (c) the profile's launch probe, read as declared ---------------------------------------
    const c = fixture("launch-cmd");
    profile(c, "  ./scripts/launch-probe.sh  ");
    const lc = launchEvidenceFor(c, "demo", 1).launch_cmd;
    if (lc === "./scripts/launch-probe.sh") ok("launch_cmd is the profile's launch_probe, trimmed");
    else fail(`launch_cmd was ${JSON.stringify(lc)}`);

    // --- (d) the compiled order carries both, from the workflow's own payload -------------------
    const d = fixture("order");
    profile(d, "./scripts/launch-probe.sh"); gate(d, "r1-t1.json"); gate(d, "r1-t2.json");
    const c1 = compileEval(d, WORKFLOW_PAYLOAD);
    const p1 = c1.order?.payload || {};
    if (p1.build_gate === ".shapeup/demo/build/r1-t2.json" && p1.launch_cmd === "./scripts/launch-probe.sh") {
      ok("an evaluate order compiled from the workflow's payload carries build_gate and launch_cmd derived from disk");
    } else fail(`the evaluate order carries build_gate=${p1.build_gate} launch_cmd=${p1.launch_cmd} (exit ${c1.r.status}: ${c1.r.stderr.trim().slice(0, 200)})`);
    if (!("run_cmd" in p1)) ok("deriving them invents no run_cmd — the ledger's own field stays the ledger's");
    else fail(`the order gained run_cmd=${p1.run_cmd} from the derivation`);
    const c1b = compileEval(d, { ...WORKFLOW_PAYLOAD, run_cmd: "npm run build" });
    if (c1b.order?.payload?.run_cmd === "npm run build" && c1b.order.payload.launch_cmd === "./scripts/launch-probe.sh") {
      ok("a build-only run_cmd and a launch_cmd ride together — neither displaces the other");
    } else fail(`with a ledger run_cmd the order carried run_cmd=${c1b.order?.payload?.run_cmd} launch_cmd=${c1b.order?.payload?.launch_cmd}`);

    // --- (e) an explicit --payload value outranks the derivation --------------------------------
    const c2 = compileEval(d, { ...WORKFLOW_PAYLOAD, build_gate: "hand/gate.json", launch_cmd: "hand launch" });
    if (c2.order?.payload?.build_gate === "hand/gate.json" && c2.order.payload.launch_cmd === "hand launch") {
      ok("an operator-named build_gate and launch_cmd outrank the derivation");
    } else fail(`explicit values were overridden: ${JSON.stringify({ g: c2.order?.payload?.build_gate, l: c2.order?.payload?.launch_cmd })}`);

    // --- (f) non-regression: nothing declared, nothing added ------------------------------------
    const n1 = fixture("nothing");
    const cn = compileEval(n1, WORKFLOW_PAYLOAD);
    if (cn.r.status === 0 && cn.order && !("build_gate" in cn.order.payload) && !("launch_cmd" in cn.order.payload)) {
      ok("a project with no gate and no profile compiles the order it always did — neither field, no error");
    } else fail(`an order with nothing to derive carried ${JSON.stringify(cn.order?.payload)} (exit ${cn.r.status})`);
    const n2 = fixture("blank");
    profile(n2, "   "); w(n2, ".shapeup/demo/build/r1-t1.json", "{ this is not json");
    const cb = compileEval(n2, WORKFLOW_PAYLOAD);
    if (cb.r.status === 0 && cb.order && !("build_gate" in cb.order.payload) && !("launch_cmd" in cb.order.payload)) {
      ok("a blank launch_probe and a corrupt gate artifact are absent, never an error and never an empty string");
    } else fail(`blank/corrupt inputs produced ${JSON.stringify(cb.order?.payload)} (exit ${cb.r.status}: ${cb.r.stderr.trim().slice(0, 160)})`);

    // --- (g) probe t0 hands over the digest the citation check re-derives -----------------------
    const t = fixture("digest");
    w(t, "shapeup/demo/scopes/alpha.json", { schema_version: 1, scope_id: "alpha", allowed_file_substrate: ["src/alpha/**"] });
    const verdict = { schema_version: 2, round: 1, attempt: 1, trial: 1, scope_id: "alpha", overall: "green" };
    const vp = w(t, ".shapeup/demo/t0/verdicts/r1-a1-t1.json", verdict);
    const want = createHash("sha256").update(readFileSync(vp)).digest("hex");
    const pt = spawnSync("node", [...K("probe t0"), "--slug", "demo", "--scope", "alpha", "--round", "1", "--cwd", t], { encoding: "utf8" });
    let out = {};
    try { out = JSON.parse(pt.stdout); } catch { /* reported below */ }
    if (pt.status === 0 && out.green === true && out.sha256 === want) ok("probe t0 prints the sha256 of the green verdict, equal to an independent hash of the file");
    else fail(`probe t0 printed ${pt.stdout.trim()} (exit ${pt.status}); the file hashes to ${want}`);

    const cite = (sha256) => {
      w(t, ".shapeup/demo/results/evaluate-r1.json", { schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator",
        status: "done", verdict: { overall: "FAIL", bugs: [],
          criteria: [{ criterion: "UC-01 step 1", verdict: "FAIL", evidence: "src/a.ts:1 measured" }],
          t0_citations: [{ scope_id: "alpha", path: ".shapeup/demo/t0/verdicts/r1-a1-t1.json", sha256 }] } });
      return evalVerdict(t, "demo", 1);
    };
    if (cite(out.sha256).found) ok("the digest probe t0 printed is the one the verdict check accepts — a judge that asks for it can cite it");
    else fail(`a citation carrying probe t0's own digest was refused: ${JSON.stringify(cite(out.sha256))}`);
    const flipped = out.sha256.slice(0, -1) + (out.sha256.endsWith("0") ? "1" : "0");
    if (!cite(flipped).found) ok("the same citation with one hex digit changed is still refused — the check did not go vacuous");
    else fail("a citation with a wrong digest was accepted after probe t0 started printing one");

    const red = fixture("digest-red");
    w(red, "shapeup/demo/scopes/alpha.json", { schema_version: 1, scope_id: "alpha", allowed_file_substrate: ["src/alpha/**"] });
    w(red, ".shapeup/demo/t0/verdicts/r1-a1-t1.json", { ...verdict, overall: "red" });
    const pr = spawnSync("node", [...K("probe t0"), "--slug", "demo", "--scope", "alpha", "--round", "1", "--cwd", red], { encoding: "utf8" });
    let outR = {};
    try { outR = JSON.parse(pr.stdout); } catch { /* reported below */ }
    if (pr.status === 1 && outR.green === false && !("sha256" in outR)) ok("a scope that is not green exits 1 and prints no digest — there is nothing to cite");
    else fail(`probe t0 over a red scope printed ${pr.stdout.trim()} (exit ${pr.status})`);
  } finally {
    for (const r of roots) rmSync(r, { recursive: true, force: true });
  }
}
