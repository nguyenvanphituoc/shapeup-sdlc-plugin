// A CHECK REWRITTEN TO PASS IS ON THE RECORD, AND THE JUDGE IS TOLD TO READ IT.
//
// A scope writes its own per-row checks. Measured on a live run: a row FAILed on attempt 1 — the
// check renamed a list and found the old name still on screen — and went green on attempt 2 because
// the check had been rewritten to stop renaming; the code was unchanged, and the judge took the PASS
// line on its own word. T0 now records the checks it read (by digest) and the rows they named; a row
// that failed in the scope's previous trial and passes now, whose own check file changed, is listed
// as revised, and the evaluate order carries the list.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the revised-check checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { revisedChecks, namedResults } = await import(join(ROOT, "kernel/verify/t0.mjs"));
  section("161. A row that went from FAIL to PASS because its own check was rewritten is recorded and handed to the judge");

  const prev = { check_files: { "flows/TS-01.flow": "a", "flows/TS-02.flow": "b" }, named_results: { "TS-01": "FAIL", "TS-02": "FAIL" } };
  const curr = { check_files: { "flows/TS-01.flow": "a2", "flows/TS-02.flow": "b" }, named_results: { "TS-01": "PASS", "TS-02": "PASS" } };
  const r = revisedChecks(prev, curr);
  if (JSON.stringify(r) === JSON.stringify([{ id: "TS-01", file: "flows/TS-01.flow" }])) ok("a FAIL→PASS row whose check changed is revised; one fixed with its check unchanged is not");
  else fail(`revisedChecks → ${JSON.stringify(r)}`);
  if (revisedChecks(null, curr).length === 0) ok("a first trial has nothing to compare against");
  else fail("a first trial reported revised checks");
  const nr = namedResults([{ stdout: "PASS TS-01\nFAIL TS-02 step 3: x\nPASS TS-02\nui-flow: 1/2" }]);
  if (nr["TS-01"] === "PASS" && nr["TS-02"] === "FAIL") ok("namedResults keeps a FAIL over a later PASS for the same row");
  else fail(`namedResults → ${JSON.stringify(nr)}`);

  // Through the real T0 and the real compiler.
  const d = mkdtempSync(join(tmpdir(), "revised-"));
  const w = (rel, body) => { const p = join(d, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body); return p; };
  try {
    w(".shapeup/demo/receipt.json", JSON.stringify({ slug: "demo", run_id: "demo-20260101T000000Z-abcdef12", started_at: "2026-01-01T00:00:00Z", intake_sha256: "0".repeat(64) }));
    const runner = w("check.sh", "#!/bin/sh\nfor f in \"$1\"/*.flow; do id=$(basename \"$f\" .flow); if grep -q strict \"$f\"; then echo \"FAIL $id step 1: strict\"; st=1; else echo \"PASS $id\"; fi; done\nexit ${st:-0}\n");
    chmodSync(runner, 0o755);
    const contract = w("shapeup/demo/scopes/s1.json", JSON.stringify({ schema_version: 1, scope_id: "s1", allowed_file_substrate: ["flows/**"], e2e_verification_fixtures: ["./check.sh flows"] }));
    const t0 = (attempt) => spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "verify", "t0", contract, "--round", "1", "--attempt", String(attempt), "--cwd", d, "--no-ratchet"], { cwd: d, encoding: "utf8" });
    w("flows/TS-01.flow", "strict\n");
    const a1 = t0(1);
    w("flows/TS-01.flow", "lenient\n");
    const a2 = t0(2);
    const trials = readFileSync(join(d, ".shapeup/demo/t0/trials.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const v2 = JSON.parse(readFileSync(join(d, ".shapeup/demo", trials[trials.length - 1].artifact), "utf8"));
    if (JSON.stringify(v2.revised_checks) === JSON.stringify([{ id: "TS-01", file: "flows/TS-01.flow" }])) ok("verify t0 records the revised check on the verdict of the attempt that went green");
    else fail(`attempt 2 verdict revised_checks = ${JSON.stringify(v2.revised_checks)} (exits ${a1.status}/${a2.status}: ${a2.stderr.trim().slice(0, 160)})`);
    const c = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "compile", "--operation", "evaluate", "--slug", "demo", "--round", "1", "--cwd", d], { encoding: "utf8" });
    let order = null; try { order = JSON.parse(readFileSync(c.stdout.trim(), "utf8")); } catch { /* reported */ }
    const rc = order?.payload?.revised_checks;
    if (JSON.stringify(rc) === JSON.stringify([{ scope_id: "s1", id: "TS-01", file: "flows/TS-01.flow" }])) ok("the evaluate order carries the revised check with its scope");
    else fail(`evaluate order revised_checks = ${JSON.stringify(rc)} (${c.stderr.trim().slice(0, 160)})`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
