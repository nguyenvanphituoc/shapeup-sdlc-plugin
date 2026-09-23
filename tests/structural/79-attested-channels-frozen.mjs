// 79 — HD-044: the substrate fence leaves the attested channels writable by the leg being judged.
// Section: 133.
//
// THE DEFECT. `hooks/sandbox-guard.mjs`'s run-trace carve-out permits any write under the active
// feature's `.shapeup/<slug>/` root unconditionally — it exists so a doer can keep its own task
// board and discovery ledger current mid-build. `kernel/compile.mjs`'s `substrateFor()` freezes
// only the staged intake for the build operations (`execute`/`fix`/`spike`), so nothing on the
// declared write contract ever reaches the carve-out's blanket permission. The result: a build leg
// can `Edit`/`Write` a dispatch receipt, a leg-completion row, a T0 verdict or its own WorkResult —
// exactly the channels `kernel/probe/attempts.mjs`'s header names as the admissible replacements
// for an order or a T0 verdict read alone, on the grounds that those two are writable by the very
// leg whose exhaustion is being judged. The fence hands the subject its own replacements.
//
// THE FIX is already ordered correctly in the guard: `frozen` is checked BEFORE the carve-out,
// deliberately, so the remedy is declarative — add the four attested-channel globs to the build
// operations' `frozen` list in `substrateFor()`. The carve-out's real purpose (board + discovery
// ledger writes) is untouched because neither lives under any of the four globs.
//
// WHY THIS SPAWNS THE REAL HOOK OVER A REAL COMPILED ORDER, not a unit test against `substrateFor`
// in isolation. `substrateFor` returning the right globs proves nothing about what a worker can
// actually do with an `Edit`/`Write` call — that question belongs to the guard, which reads the
// order from disk through `.shapeup/active-order` exactly as a live dispatch would. A fixture that
// imports the predicate can only ask "does the predicate compute the right answer", never "does
// anything call it" — and `substrateFor` already declared the staged pitch frozen for years before
// anything enforced that declaration (see test #17's own §7b). `kernel/harness.mjs compile` is used
// to produce the order, rather than a hand-typed fixture, so this module also proves the compiler
// actually emits the frozen list this fix adds — not a shape the test asserts as its own belief.

import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");

  section("133. A build leg's own attested channels are frozen — receipts, legs, T0 verdicts, results");

  /**
   * Fire the real sandbox-guard hook with a PreToolUse payload, the same shape #17 drives it with.
   * @param {string} cwd - The fixture checkout root (doubles as `cwd` and the project root).
   * @param {string} relPath - Path to write, relative to `cwd`.
   * @param {string} [toolName] - Tool name in the payload (default "Write").
   * @returns {{denied:boolean, out:string}} Whether the hook's stdout carries a deny decision.
   */
  const ask = (cwd, relPath, toolName = "Write") => {
    const payload = JSON.stringify({ tool_name: toolName, cwd, tool_input: { file_path: join(cwd, relPath) } });
    const r = spawnSync("node", [GUARD], { encoding: "utf8", input: payload });
    return { denied: (r.stdout || "").includes('"permissionDecision":"deny"'), out: r.stdout || "" };
  };

  const ws = mkdtempSync(join(tmpdir(), "attested-channels-"));
  try {
    // Compile a REAL "execute" order through the shipped CLI — the same entry point a build
    // dispatch uses — rather than hand-writing one, so the frozen list under test is the one the
    // compiler actually emits, and the active-order pointer it publishes is the real mechanism the
    // guard reads.
    const compiled = spawnSync("node", [
      KERNEL, "compile", "--operation", "execute", "--worker", "task-executor", "--slug", "demo", "--cwd", ws,
    ], { encoding: "utf8" });

    if (compiled.status !== 0 || !existsSync(join(ws, ".shapeup", "demo", "orders", "execute.json"))) {
      fail(`could not compile a real "execute" order to test against\nstdout: ${compiled.stdout}\nstderr: ${compiled.stderr}`);
    } else {
      ok('compiled a real "execute" order through `harness compile` (not a hand-built fixture)');

      if (existsSync(join(ws, ".shapeup", "active-order"))) ok("compile published the active-order pointer the guard reads");
      else fail("compile did not publish .shapeup/active-order — the guard would defer on every case below vacuously");

      // The four attested channels HD-044 names. Each must be DENIED, and denied specifically as
      // FROZEN (not merely "outside every live order's allowed scopes") — the guard names the two
      // differently on purpose, and only the frozen path is checked ahead of the carve-out.
      // PROBE PATHS THAT ARE NOT THE GLOBS' OWN TEXT. An earlier version of this module probed
      // `t0/verdicts/r1-a1.json` — a filename no run produces, since the verifier writes
      // `r<N>-a<M>-t<T>.json` — and every probe was spellable as a literal. Both together let a
      // fix narrowed to exactly these four strings pass. Each path below is now a REAL shape the
      // pipeline writes, and two of them (a second receipt file, a later trial) exist only to be
      // covered by the `**` rather than by a literal.
      const attestedChannels = [
        [".shapeup/demo/receipts/dispatch.jsonl", "dispatch receipt ledger"],
        [".shapeup/demo/receipts/canary.jsonl", "a second receipt file, covered only by the glob"],
        [".shapeup/demo/legs.jsonl", "leg-completion ledger"],
        [".shapeup/demo/t0/verdicts/r1-a1-t1.json", "T0 verdict (the real filename shape)"],
        [".shapeup/demo/t0/verdicts/r2-a3-t7.json", "a later trial's verdict, covered only by the glob"],
      ];
      for (const [relPath, label] of attestedChannels) {
        const r = ask(ws, relPath);
        if (r.denied && /frozen/i.test(r.out)) {
          ok(`sandbox guard DENIES a build leg writing its own ${label} (${relPath}) — frozen, not merely out of substrate`);
        } else if (r.denied) {
          fail(`sandbox guard denied ${relPath} but not as frozen — the run-trace carve-out is still the reason it might reopen\n${r.out}`);
        } else {
          fail(`sandbox guard ALLOWED a build leg to write its own ${label} (${relPath}) — the attested channel is forgeable by the party it is about\n${r.out || "(no output — deferred/allowed)"}`);
        }
      }

      // THE LEG MUST STILL BE ABLE TO ANSWER ITS OWN ORDER, and this arm is why the result
      // envelope is NOT on the list above. It looks like it belongs there — it is the leg's own
      // claim about its own work — and freezing it was tried and measured: the guard denies the
      // documented last step of every build leg, on the first round, unconditionally, because the
      // order is unanswered at exactly that moment by construction. Nothing else writes an ordinary
      // result, so the leg has no other way to finish. Pinned as a check rather than left as a
      // comment, because the next reader to notice the asymmetry will reach for the same edit.
      const ownResult = ask(ws, ".shapeup/demo/results/execute.json");
      if (!ownResult.denied) ok("sandbox guard ALLOWS a build leg to write its OWN WorkResult — the product that answers its order, not evidence about it");
      else fail(`freezing the attested channels also denied the leg its own WorkResult — every build leg's documented last step now fails\n${ownResult.out}`);

      // THE CARVE-OUT'S REAL PURPOSE MUST SURVIVE. Board status/AC ticks (task-executor P3) and the
      // P3.7 discovery ledger are the reason the run-trace carve-out exists at all (test #17, arm
      // 5) — a fix that widens `frozen` far enough to catch these would trade one hole for a
      // strand, and a guard that also blocks legitimate work is a guard that gets switched off.
      const board = ask(ws, ".shapeup/demo/tasks/TASK-001.md");
      if (!board.denied) ok("sandbox guard still ALLOWS the doer's own task-board write under the run-trace root");
      else fail(`freezing the attested channels also blocked the board write the carve-out exists for\n${board.out}`);

      const ledger = ask(ws, ".shapeup/demo/discovery/ledger.md");
      if (!ledger.denied) ok("sandbox guard still ALLOWS the P3.7 discovery-ledger write under the run-trace root");
      else fail(`freezing the attested channels also blocked the discovery-ledger write the carve-out exists for\n${ledger.out}`);

      // Frozen denies BOTH write tools — unlike append_only, it does not discriminate Edit from
      // Write, because the point is that nothing may touch the path, not that overwriting is worse
      // than appending. One of the four is enough to pin this; the others are asserted with the
      // default (Write) above.
      const editAttempt = ask(ws, ".shapeup/demo/legs.jsonl", "Edit");
      if (editAttempt.denied) ok("sandbox guard DENIES an Edit (not only a Write) to a frozen attested channel");
      else fail(`sandbox guard allowed an Edit to append to the leg-completion ledger — frozen must block both tools\n${editAttempt.out}`);
    }
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // PARITY ACROSS THE BUILD OPERATIONS. `fix` and `spike` share the same write contract as
  // `execute` (compile.mjs's own comment: "free of blast radius by construction"); this drives
  // `substrateFor` directly for the two this module does not spawn a full checkout for, the same
  // way test #17 pins the staged-pitch freeze across every non-build operation without spawning
  // the guard for each one.
  const { substrateFor } = await import(join(ROOT, "kernel/compile.mjs"));
  const { matchesAny } = await import(GUARD);
  const attestedGlobPaths = [
    ".shapeup/demo/receipts/dispatch.jsonl",
    ".shapeup/demo/legs.jsonl",
    ".shapeup/demo/t0/verdicts/r1-a1-t1.json",
  ];
  for (const op of ["fix", "spike"]) {
    const frozen = substrateFor(op, { slug: "demo" }).frozen || [];
    const allCovered = attestedGlobPaths.every((p) => matchesAny(p, frozen));
    if (allCovered) ok(`substrateFor("${op}") freezes the same attested channels as "execute" (receipts, legs, T0 verdicts, results)`);
    else fail(`substrateFor("${op}") does not freeze every attested channel: ${JSON.stringify(frozen)}`);
  }
}
