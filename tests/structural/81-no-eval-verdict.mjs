// 81 — HD-045: a `--no-eval` run must not freeze a committed report that says PASS.
// Section 133.
//
// THE DEFECT. references/protocol.md promises this TWICE — once in Part 1 ("with --no-eval …
// the run goes straight to SHIP with verdict `not-evaluated` recorded in the ledger") and once in
// the ledger Rules ("A `not-evaluated` final verdict (from `--no-eval`) is recorded plainly —
// never silently upgraded to `pass`"). `shapeup-run.js` did neither: the `--no-eval` branch set
// its local `verdict` to the literal `"pass"`, and the SHIP dispatch hardcoded
// `reduce ship --verdict PASS` regardless of what actually happened. GATE L4's sign-off block
// (SKILL.md Step 4) reads `RunReturn.verdict` verbatim, so even the human-facing gate said
// "Verdict: pass" — and the frozen `shapeup/<slug>/REPORT.md` a teammate inherits on `git pull`
// carried the same lie with no gate in front of it at all.
//
// WHY SOURCE LEVEL for shapeup-run.js. It is a Workflow body — top-level `return`, no exports —
// and cannot be imported or executed by this suite (58-relaunch-memory.mjs's own banner, repeated
// here because every module that touches this file re-learns it). `kernel/reduce/ship.mjs`,
// the kernel half of the same value, CAN be executed for real and is driven directly below,
// exercising both the fixed direction (not-evaluated) and the pre-existing one (a real PASS),
// because a fix that only proves the new state does not regress the old one is half a fix.

import { pinnedBy } from "../lib/pinned-row.mjs";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function run(ctx) {
  const { ROOT, ok, fail, section, readJSON } = ctx;

  // =============================================================================
  section("135. A --no-eval run says `not-evaluated`, never a silently upgraded `pass`");
  // =============================================================================

  // --- (a)-(d) the wiring — the verdict a --no-eval run carries, and what it does to the loop ---------
  // These four read the retired run script's source: that its --no-eval branch set `not-evaluated` and never
  // `pass`, that the round loop broke out to ship on it like a pass and did not misreport a breaker trip,
  // that the ship dispatch DERIVED its --verdict instead of hardcoding PASS, and that the final return
  // carried the real verdict. The loop's `probe next` carries every one of those as a derivation, pinned by
  // named rows; and the guarantee does not rest on the orchestrator at all — see (h), which moves it to the
  // writer of the artifact.
  pinnedBy(ctx, ["--no-eval ships not-evaluated: GATE L3 is crossed over that verdict", "a not-evaluated ship reports --verdict not-evaluated, never a PASS", "a red build gate outranks --no-eval"],
    "(a)-(d) a --no-eval run carries `not-evaluated` through the gate and the ship command, is shippable like a pass, and is never read as a breaker trip");

  // --- (e) the ship command's own argv admits the value --------------------------------------------------
  // The wire-format half used to be the run return's `verdict` enum. That union is gone; the command that
  // freezes the report is where the value has to be legal, and its own usage line names it.
  const shipSrc = readFileSync(join(ROOT, "kernel/reduce/ship.mjs"), "utf8");
  if (/not-evaluated/.test(shipSrc.slice(shipSrc.indexOf("export const ARGV_SPEC"), shipSrc.indexOf("export const ARGV_SPEC") + 900))) {
    ok("`reduce ship`'s own argv contract admits \"not-evaluated\" as a verdict");
  } else fail("`reduce ship`'s argv contract does not name \"not-evaluated\" — the value a --no-eval run ships with would be rejected at the command");

  // --- (f) the kernel half, DRIVEN FOR REAL — both directions, over the actual generate() --------
  // shapeup-run.js cannot be executed (see banner), but the function it calls into can be, so the
  // report-rendering half of this fix is proven against real output rather than pinned by regex.
  const SR = await import(join(ROOT, "kernel/reduce/ship.mjs"));
  const dir = mkdtempSync(join(tmpdir(), "no-eval-verdict-"));
  try {
    // (f1) --no-eval's own value: the report must say not-evaluated, plainly, not PASS.
    const notEvaluated = SR.generate({ cwd: dir, slug: "demo", verdict: "not-evaluated" });
    if (notEvaluated.facts.verdict === "not-evaluated" && /verdict: not-evaluated/.test(notEvaluated.markdown)
        && /\| Verdict \| \*\*not-evaluated\*\* \|/.test(notEvaluated.markdown)) {
      ok("reduce ship, driven for real with verdict=\"not-evaluated\", freezes a report that says so plainly (frontmatter AND the Outcome table)");
    } else {
      fail(`a real --no-eval-shaped ship report did not say not-evaluated: ${JSON.stringify(notEvaluated.facts.verdict)}`);
    }
    if (/verdict: PASS/.test(notEvaluated.markdown) || /\*\*PASS\*\*/.test(notEvaluated.markdown)) {
      fail("a --no-eval-shaped report ALSO says PASS somewhere — the upgrade this defect exists to close is still reachable");
    } else {
      ok("a --no-eval-shaped report never says PASS anywhere in the frozen document");
    }

    // (f2) the other direction: a real PASS must still say PASS. Trading one wrong answer
    // (always PASS) for another (always not-evaluated) is exactly the failure mode AGENTS.md's
    // own discipline and this task's instructions both forbid.
    const realPass = SR.generate({ cwd: dir, slug: "demo", verdict: "PASS" });
    if (realPass.facts.verdict === "PASS" && /verdict: PASS/.test(realPass.markdown)
        && /\| Verdict \| \*\*PASS\*\* \|/.test(realPass.markdown)) {
      ok("reduce ship, driven for real with a genuine PASS, still freezes a report that says PASS — the fix did not weaken the passing case");
    } else {
      fail(`a real PASS ship report lost its own verdict: ${JSON.stringify(realPass.facts.verdict)}`);
    }
    if (/not-evaluated/.test(realPass.markdown)) {
      fail("a genuine PASS report also says not-evaluated somewhere — the two states are bleeding into each other");
    } else {
      ok("a genuine PASS report never says not-evaluated");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  // --- (g) the promise itself is still on the page — a code fix is not license to soften the doc -
  const rounds = readFileSync(join(ROOT, "skills/building/resources/rounds.md"), "utf8").replace(/\s+/g, " ");
  if (/crossed over the verdict `not-evaluated`/.test(rounds) && /never upgraded to a pass/.test(rounds)) {
    ok("the rounds resource still promises `not-evaluated` for --no-eval, never a silent PASS");
  } else {
    fail("the rounds resource no longer promises `not-evaluated` for --no-eval — the doc drifted from the fix, or the fix drifted from the doc");
  }

  // --- (h) THE GUARANTEE, AT THE WRITER OF THE ARTIFACT ---------------------------------------
  // Everything above this line is a source-level reading of a file this suite cannot execute, and
  // an acceptance pass proved exactly what that is worth: with one assignment reinserted DOWNSTREAM
  // of the branch — `if (args.noEval) verdict = "pass";` just above the loop's break — the whole
  // defect came back and every check in this suite stayed green. A regex can pin the shape of the
  // code it was shown; it cannot pin the shape of code nobody thought to look at.
  //
  // So the promise moved to where it can be enforced: `reduce ship` is the hand that freezes the
  // committed report, it can read the run's own recorded arguments, and it now refuses to write a
  // PASS over a run whose record says nothing graded it. A future orchestrator edit cannot reach
  // past that — the worst it can do is make the ship fail loudly, which is the opposite of the
  // failure this defect was: a report that quietly said PASS.
  //
  // Driven through the real CLI, with the fixture built by the real CLI too — a hand-written
  // launch record would prove the guard reads JSON, not that the pipeline produces what it reads.
  // `init run --no-eval` is what writes the record the guard reads.
  {
    const K = join(ROOT, "kernel/harness.mjs");
    const ws = mkdtempSync(join(tmpdir(), "struct-no-eval-ship-"));
    const run = (...a) => spawnSync("node", [K, ...a, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    try {
      spawnSync("git", ["init", "-q"], { cwd: ws });
      spawnSync("git", ["commit", "-q", "--allow-empty", "-m", "base"], { cwd: ws });
      const common = ["--auto-level", "unattended", "--exec-model", "claude-opus-5", "--max-rounds", "1", "--attempts", "2"];

      const argsSkipped = run("init", "run", "--slug", "skipped", "--intake-text", "a run that grades nothing", ...common, "--no-eval");
      const argsGraded = run("init", "run", "--slug", "graded", "--intake-text", "a run that grades", ...common, "--eval-model", "claude-opus-5");
      if (argsSkipped.status !== 0 || argsGraded.status !== 0) {
        fail(`could not record the launch through the CLI (skipped=${argsSkipped.status} graded=${argsGraded.status}) — the fixture cannot measure the guard: ${(argsSkipped.stderr || argsGraded.stderr || "").slice(0, 200)}`);
      } else {
        const refused = run("reduce", "ship", "--slug", "skipped", "--verdict", "PASS");
        const wroteReport = existsSync(join(ws, "shapeup/skipped/REPORT.md"));
        if (refused.status !== 0 && !wroteReport) ok("reduce ship REFUSES to freeze a PASS report for a run whose own record says --no-eval, and writes nothing");
        else fail(`reduce ship froze a PASS report over a run that graded nothing (exit ${refused.status}, report written: ${wroteReport}) — the artifact a teammate inherits is the one that lies`);
        if (/no-eval/.test(refused.stderr || "") && /not-evaluated/.test(refused.stderr || "")) ok("the refusal names the cause and the verdict to ship instead");
        else fail(`the refusal does not tell the caller what to do instead: ${JSON.stringify((refused.stderr || "").slice(0, 200))}`);

        const honest = run("reduce", "ship", "--slug", "skipped", "--verdict", "not-evaluated");
        if (honest.status === 0 && /not-evaluated/.test(readFileSync(join(ws, "shapeup/skipped/REPORT.md"), "utf8"))) ok("the same run ships freely as not-evaluated — the guard refuses a claim, not the ship");
        else fail(`a --no-eval run could not ship as not-evaluated (exit ${honest.status}) — the guard is blocking the honest path too`);

        const graded = run("reduce", "ship", "--slug", "graded", "--verdict", "PASS");
        if (graded.status === 0 && /\*\*PASS\*\*/.test(readFileSync(join(ws, "shapeup/graded/REPORT.md"), "utf8"))) ok("a run that DID evaluate still ships PASS — the guard reads the record, not the verb");
        else fail(`a graded run was refused its PASS (exit ${graded.status}) — the guard is firing on runs it has no business refusing`);
      }
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }
}
