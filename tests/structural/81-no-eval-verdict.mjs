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

import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function run(ctx) {
  const { ROOT, ok, fail, section, readJSON } = ctx;

  // =============================================================================
  section("135. A --no-eval run says `not-evaluated`, never a silently upgraded `pass`");
  // =============================================================================

  const src = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");

  // --- (a) the --no-eval branch itself sets the ONE value protocol.md names -----------------
  // Scoped to the `args.noEval` branch's own body, not the whole file — `verdict = "pass"` is a
  // legitimate assignment elsewhere (a real EVAL PASS, the fast-forward resume path, the REFUTE
  // wave overturning every finding), and a whole-file grep for it would pass on a file that still
  // mis-assigns inside this one branch.
  const noEvalBranch = src.match(/\}\s*else if\s*\(args\.noEval\)\s*\{([\s\S]*?)\n\s*\}\s*else\s*\{/);
  if (!noEvalBranch) {
    fail("could not find the `else if (args.noEval) { … } else {` EVAL branch in shapeup-run.js — has the Eval phase been restructured?");
  } else {
    const body = noEvalBranch[1];
    if (/verdict\s*=\s*"not-evaluated"/.test(body)) {
      ok("the --no-eval branch sets verdict = \"not-evaluated\", the value protocol.md promises");
    } else {
      fail(`the --no-eval branch does not set verdict = "not-evaluated": ${JSON.stringify(body.trim())}`);
    }
    if (/verdict\s*=\s*"pass"/.test(body)) {
      fail("the --no-eval branch STILL assigns verdict = \"pass\" — the silent upgrade protocol.md's Rules forbid");
    } else {
      ok("the --no-eval branch no longer upgrades its verdict to \"pass\"");
    }
  }

  // --- (b) "not-evaluated" ships like "pass" — it must not spend another round or hit GATE H ----
  // A value that ONLY changed at the assignment site but never taught to the loop's own exit
  // checks would still loop forever (the while guard) or misreport a circuit-breaker trip (the
  // post-loop fallback) for the one path meant to go straight to SHIP.
  if (/if\s*\(verdict === "pass" \|\| verdict === "not-evaluated"\) break;/.test(src)) {
    ok("the round loop breaks out to ship on \"not-evaluated\" exactly like \"pass\"");
  } else {
    fail("the round loop's break condition does not treat \"not-evaluated\" as shippable — a --no-eval run would spend another BUILD/EVAL round instead of going straight to SHIP");
  }
  if (/if\s*\(verdict !== "pass" && verdict !== "not-evaluated"\)\s*\{\s*\n\s*return await withWarnings\(\{ status: "gate_h"/.test(src)) {
    ok("the post-loop fallback does not route a \"not-evaluated\" run to GATE H as if it had failed");
  } else {
    fail("the post-loop verdict check was not widened to admit \"not-evaluated\" — a --no-eval run falling through here would be misreported as a circuit-breaker trip");
  }

  // --- (c) the SHIP dispatch's own --verdict argument is DERIVED, never a hardcoded PASS --------
  if (/reduce ship --slug \$\{slug\} --verdict PASS /.test(src)) {
    fail("`reduce ship` is still dispatched with a hardcoded --verdict PASS — a --no-eval run freezes a REPORT.md claiming PASS");
  } else {
    ok("the ship dispatch no longer hardcodes --verdict PASS");
  }
  const shipLine = src.match(/const shipVerdict = verdict === "not-evaluated" \? "not-evaluated" : "PASS";\s*\n\s*const ship = await cmd\(`reduce ship --slug \$\{slug\} --verdict \$\{shipVerdict\}/);
  if (shipLine) {
    ok("the ship dispatch derives --verdict from the run's own verdict (not-evaluated stays not-evaluated; anything else still ships PASS)");
  } else {
    fail("could not find a shipVerdict derivation feeding `reduce ship --verdict ${shipVerdict}` — the ship report's verdict line may still be a constant");
  }

  // --- (d) the final RunReturn's own `verdict` field is the real variable, not a literal --------
  // Scoped to the terminal `status: "shipped"` object this file's own top-level flow constructs.
  // `lastIndexOf` rather than an adjacent-line anchor: the file's own header comment (its wire-
  // format banner) ALSO contains the literal text `status: "shipped",`, so anchoring on anything
  // that mutation (c) could remove (e.g. the `shipVerdict` declaration) risks sliding this check
  // onto that unrelated comment instead — silently checking nothing real. The terminal RunReturn
  // is the only CODE occurrence, and it is always the last one in the file.
  const shippedReturn = src.slice(src.lastIndexOf('status: "shipped",'));
  if (/verdict: "pass"/.test(shippedReturn.slice(0, 400))) {
    fail("the terminal RunReturn still hardcodes verdict: \"pass\" — GATE L4's sign-off block (SKILL.md Step 4) reads this field verbatim and would keep telling a human the run was graded when it was not");
  } else if (/\n\s*verdict,/.test(shippedReturn.slice(0, 400))) {
    ok("the terminal RunReturn carries the run's real verdict (pass | not-evaluated), not a hardcoded literal");
  } else {
    fail(`the terminal RunReturn's verdict field is neither the expected "verdict," shorthand nor a hardcoded "pass" — inspect: ${JSON.stringify(shippedReturn.slice(0, 200))}`);
  }

  // --- (e) the wire format agrees: RunReturn.verdict is a legal enum for "not-evaluated" ---------
  // Established, not invented (AGENTS.md's own discipline: derive facts from artifacts). Before
  // this fix `kernel/reduce/ship.mjs` already treated "not-evaluated" as a first-class verdict
  // (its own --verdict usage string, and generate()'s own no-artifact default, both driven for
  // real in section (f) below) — the schema's RunReturn.verdict enum was the one layer that had
  // not caught up, and a value that reaches the wire outside its own enum is exactly the drift
  // CLAUDE.md's "keeping the docs and the plugin honest" rule exists to catch.
  const schema = readJSON(join(ROOT, "kernel/schemas/domain.schema.json"));
  const verdictEnum = schema.$defs?.RunReturn?.properties?.verdict?.enum;
  if (Array.isArray(verdictEnum) && verdictEnum.includes("not-evaluated")) {
    ok("RunReturn.verdict's schema enum admits \"not-evaluated\"");
  } else {
    fail(`RunReturn.verdict's schema enum does not admit "not-evaluated": ${JSON.stringify(verdictEnum)}`);
  }
  // Both directions: widening the enum must not have dropped what it already carried.
  if (Array.isArray(verdictEnum) && verdictEnum.includes("pass") && verdictEnum.includes("fail")) {
    ok("RunReturn.verdict's schema enum still admits \"pass\" and \"fail\" — widened, not replaced");
  } else {
    fail(`RunReturn.verdict's schema enum lost an existing value: ${JSON.stringify(verdictEnum)}`);
  }

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
  const protocol = readFileSync(join(ROOT, "skills/tech-lead/references/protocol.md"), "utf8");
  if (/the run goes straight to SHIP with verdict `not-evaluated` recorded in the ledger/.test(protocol)) {
    ok("protocol.md's --no-eval section still promises `not-evaluated`, not a silent PASS");
  } else {
    fail("protocol.md no longer promises `not-evaluated` for --no-eval — the doc drifted from the fix, or the fix drifted from the doc");
  }
  if (/recorded plainly — never silently\s*\n?\s*upgraded to `pass`/.test(protocol)) {
    ok("protocol.md's ledger Rules still forbid silently upgrading not-evaluated to pass");
  } else {
    fail("protocol.md's ledger Rules no longer state the never-silently-upgraded promise this defect was named for");
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
  // run-args record would prove the guard reads JSON, not that the pipeline produces what it reads.
  {
    const K = join(ROOT, "kernel/harness.mjs");
    const ws = mkdtempSync(join(tmpdir(), "struct-no-eval-ship-"));
    const run = (...a) => spawnSync("node", [K, ...a, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    try {
      spawnSync("git", ["init", "-q"], { cwd: ws });
      spawnSync("git", ["commit", "-q", "--allow-empty", "-m", "base"], { cwd: ws });
      const common = ["--auto-level", "unattended", "--exec-model", "claude-opus-5",
        "--max-rounds", "1", "--attempts", "2", "--plugin-root", join(ws, "plugin")];

      run("init", "run", "--slug", "skipped", "--intake-text", "a run that grades nothing");
      const argsSkipped = run("init", "run-args", "--slug", "skipped", ...common, "--no-eval");
      run("init", "run", "--slug", "graded", "--intake-text", "a run that grades");
      const argsGraded = run("init", "run-args", "--slug", "graded", ...common, "--eval-model", "claude-opus-5");
      if (argsSkipped.status !== 0 || argsGraded.status !== 0) {
        fail(`could not record run arguments through the CLI (skipped=${argsSkipped.status} graded=${argsGraded.status}) — the fixture cannot measure the guard: ${(argsSkipped.stderr || argsGraded.stderr || "").slice(0, 200)}`);
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
