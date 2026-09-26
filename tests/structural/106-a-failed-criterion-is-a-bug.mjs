// A FAILED CRITERION REACHES THE ROUND THAT MUST FIX IT, WHETHER OR NOT THE JUDGE FILED A BUG.
//
// A verdict carries the criteria it graded and the bugs it filed, and only the bugs reached the next
// round. A criterion graded FAIL with no matching bug — "no evidence: no check names this row" —
// handed the fix round nothing: three fix rounds in a row compiled with no bugs over FAIL verdicts
// and the run ended where it started. Each uncovered FAIL criterion now becomes a bug addressed to
// the scope whose contract lists the use case the criterion names.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the failed-criterion checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { criteriaBugs } = await import(join(ROOT, "kernel/compile.mjs"));
  section("160. A criterion graded FAIL reaches the owning scope's next round even when no bug was filed for it");

  const d = mkdtempSync(join(tmpdir(), "crit-bugs-"));
  const w = (rel, body) => { const p = join(d, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2)); };
  try {
    w("shapeup/demo/scopes/lists.json", { schema_version: 1, scope_id: "lists", use_cases: ["UC-07"], allowed_file_substrate: ["src/lists/**"] });
    w("shapeup/demo/scopes/toggle.json", { schema_version: 1, scope_id: "toggle", use_cases: ["UC-05"], allowed_file_substrate: ["src/toggle/**"] });
    w(".shapeup/demo/results/evaluate-r1.json", { schema_version: 1, order_id: "demo/evaluate-r1", worker: "spec-evaluator", status: "done",
      verdict: { overall: "FAIL",
        criteria: [
          { criterion: "UC-05 TS-05-05", verdict: "FAIL", evidence: "NO EVIDENCE: no fixture names it" },
          { criterion: "UC-07 TS-07-04", verdict: "FAIL", evidence: "card count 2, expected 3" },
          { criterion: "UC-07 TS-07-05", verdict: "PASS", evidence: "flow PASS" },
          { criterion: "UC-09 TS-09-01", verdict: "FAIL", evidence: "no owner" },
          { criterion: "UC-05 TS-05-06", verdict: "FAIL", evidence: "withdrawn" },
        ],
        bugs: [{ criterion: "UC-07 TS-07-04", severity: "major", location: "src/lists/Card.ets:12", actual: "2 cards" }],
        refuted: [{ criterion: "UC-05 TS-05-06" }] } });

    const got = criteriaBugs(d, "demo", 2);
    const by = Object.fromEntries(got.map((b) => [b.criterion, b]));
    if (by["UC-05 TS-05-05"]?.scope_id === "toggle" && /NO EVIDENCE/.test(by["UC-05 TS-05-05"].actual)) ok("an uncovered FAIL criterion becomes a bug for the scope owning its use case, carrying the judge's evidence");
    else fail(`UC-05 TS-05-05 → ${JSON.stringify(by["UC-05 TS-05-05"])}`);
    if (!by["UC-07 TS-07-04"]) ok("a criterion the judge already filed a bug for is not doubled");
    else fail("a criterion with a filed bug was added a second time");
    if (!by["UC-07 TS-07-05"] && !by["UC-05 TS-05-06"]) ok("PASS criteria and refuted ones yield no bug");
    else fail(`a PASS or refuted criterion yielded a bug: ${JSON.stringify(got)}`);
    if (by["UC-09 TS-09-01"] && !("scope_id" in by["UC-09 TS-09-01"])) ok("a criterion whose use case no scope lists carries no scope_id and is routed as before (unowned)");
    else fail(`UC-09 → ${JSON.stringify(by["UC-09 TS-09-01"])}`);
    if (criteriaBugs(d, "demo", 1).length === 0) ok("round 1 has no predecessor and no criteria bugs");
    else fail("round 1 produced criteria bugs");

    // Through the real compiler: the owning scope's round-2 order carries it; the other does not.
    const compile = (scope) => {
      const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "compile", "--scope", join(d, `shapeup/demo/scopes/${scope}.json`), "--round", "2", "--attempt", "1", "--cwd", d], { encoding: "utf8" });
      try { return JSON.parse(readFileSync(r.stdout.trim(), "utf8")); } catch { return { err: r.stderr.trim().slice(0, 200) }; }
    };
    const toggle = compile("toggle"), lists = compile("lists");
    const tb = (toggle.payload?.bugs || []).map((b) => b.criterion);
    const lb = (lists.payload?.bugs || []).map((b) => b.criterion);
    if (tb.includes("UC-05 TS-05-05") && !lb.includes("UC-05 TS-05-05")) ok("the compiled round-2 order of the owning scope carries the criterion; another scope's does not");
    else fail(`toggle bugs ${JSON.stringify(tb)} / lists bugs ${JSON.stringify(lb)} ${toggle.err || ""}`);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}
