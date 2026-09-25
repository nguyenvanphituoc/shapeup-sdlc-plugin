// 77 — HD-034's mechanism half: the T0 record keeps the evidence the kernel already measured.
// Sections: 130, 131.
//
// THE DEFECT. `runCommand` captures four facts about every fixture — exit code, stdout, stderr, and
// whether the command RAN AT ALL (`error`, set when the spawn itself failed or timed out). Its own
// comment says why the fourth matters: "a spawn failure or a timeout is NOT the same fact as 'the
// command ran and failed'". The ratchet agrees — it grades a crash as `crash`, restores the tree,
// and never counts it as a reverted attempt. And then the verdict artifact, the only durable record
// of any of it, stored three fields:
//
//     {"cmd":"./scripts/t0-assemble.sh","exit":1,"pass":false}
//
// `exit: r.status ?? 1` maps a command that never ran onto the exact number a real failure returns.
// So from that moment on — in the digest, the hill, the report, the evaluator's citation, and for
// anyone reading the trace back afterwards — A REFUSED COMMAND AND A BROKEN BUILD ARE THE SAME
// RECORD. The kernel computes the distinction and discards it one step later.
//
// WHY IT IS NOT ENOUGH TO SAY "exit 1". A verdict that claims a command failed, and carries neither
// its output nor the fact that it never started, is an assertion nobody downstream can check. The
// green direction is worth as much: a fixture that exits 0 having run zero tests is the false green
// this whole evidence layer exists to catch, and its stdout is the only place that shows.
//
// AND ONE HEURISTIC THAT DOES NOT SUBSTITUTE, measured while diagnosing this: an empty digest does
// NOT mean "the command was refused". It means the digester found no `file:line` to extract. A real
// build that failed with a path but no line number produced an empty digest too. Using digest
// length as a refusal signal is a heuristic that happened to hold on the refusal case and is not
// specific to it — which is why the fix is to keep the fact, not to infer it.
//
// WHAT THIS MODULE PINS:
//   130 — the persisted record carries `error` and bounded output, driven through the real
//         `harness verify t0` entry point rather than by calling the mapper (a fixture that calls
//         your function directly cannot see whether the pipeline calls it).
//   131 — the two outcomes are DISTINGUISHABLE from the artifact alone, which is the defect stated
//         as a property, plus the bound on what a fixture's output can cost the artifact.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section, readJSON } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");

  /** A committed git work tree — the ratchet needs one even when we tell it not to ratchet. */
  function gitRepo(tag) {
    const ws = mkdtempSync(join(tmpdir(), `struct-t0-evidence-${tag}-`));
    const g = (args) => spawnSync("git", args, { cwd: ws, encoding: "utf8" });
    g(["init", "-q", "-b", "main"]);
    g(["config", "user.email", "probe@example.invalid"]);
    g(["config", "user.name", "probe"]);
    mkdirSync(join(ws, "src"), { recursive: true });
    writeFileSync(join(ws, "src", "index.js"), "// baseline\n");
    g(["add", "-A"]);
    g(["commit", "-q", "-m", "baseline"]);
    return ws;
  }

  /**
   * Run one attempt's T0 through the real CLI and hand back the verdict artifact it wrote.
   * @param {string} tag - Names the temp dirs, so a survivor is identifiable.
   * @param {string[]} fixtures - The scope's fixture command lines.
   * @returns {{artifact:object|null, cli:object}} The parsed verdict, plus the CLI result.
   */
  function t0(tag, fixtures) {
    const ws = gitRepo(tag);
    const outDir = mkdtempSync(join(tmpdir(), `struct-t0-evidence-out-${tag}-`));
    try {
      const contractPath = join(ws, `SC-${tag}.json`);
      mkdirSync(dirname(contractPath), { recursive: true });
      writeFileSync(contractPath, JSON.stringify({
        schema_version: 1, scope_id: `SC-${tag.toUpperCase()}`,
        allowed_file_substrate: ["src/**"],
        e2e_verification_fixtures: fixtures,
      }, null, 2));
      const cli = spawnSync("node", [KERNEL, "verify", "t0", contractPath,
        "--round", "1", "--attempt", "1", "--cwd", ws, "--out", outDir, "--no-ratchet"],
        { cwd: ws, encoding: "utf8" });
      const vDir = join(outDir, "t0", "verdicts");
      const f = existsSync(vDir) ? readdirSync(vDir).filter((x) => x.endsWith(".json")).sort().pop() : null;
      return { artifact: f ? readJSON(join(vDir, f)) : null, cli };
    } finally {
      rmSync(ws, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  }

  // A command that RAN and failed the way a build fails: a diagnostic on stderr, a non-zero exit.
  const RAN_AND_FAILED = "node -e \"console.error('src/cart.ts:31:7 error TS2551: no such property'); process.exit(1)\"";
  // A command that NEVER RAN: overflowing spawnSync's maxBuffer is a node-level spawn error, the
  // same `r.error` a refused command or a timeout produces. 28-t0-ratchet-fallback.mjs already
  // relies on this being a genuine crash, so the two modules agree about what this fixture is.
  const NEVER_RAN = "node -e \"process.stdout.write('x'.repeat(2*1024*1024))\"";

  // ===============================================================================================
  section("130. The T0 verdict keeps what the kernel measured — the error, and bounded output");
  // ===============================================================================================
  const failed = t0("failed", [RAN_AND_FAILED]);
  const crashed = t0("crashed", [NEVER_RAN]);
  const passed = t0("passed", ["node -e \"console.log('4 fixtures, 4 passed')\""]);

  if (!failed.artifact || !crashed.artifact || !passed.artifact) {
    fail(`verify t0 wrote no verdict artifact (failed=${!!failed.artifact} crashed=${!!crashed.artifact} passed=${!!passed.artifact}) — cannot judge the record: ${(failed.cli.stderr || "").slice(0, 200)}`);
    return;
  }
  ok("verify t0 wrote a verdict artifact for all three outcomes");

  const rowOf = (a) => (a.fixtures || [])[0] || {};
  const ran = rowOf(failed.artifact), crash = rowOf(crashed.artifact), green = rowOf(passed.artifact);

  // The stderr of a real failure is the one thing that makes `exit 1` checkable by anyone else.
  if (typeof ran.stderr_tail === "string" && ran.stderr_tail.includes("TS2551")) ok("a failed fixture's record keeps its stderr (the diagnostic survives into the artifact)");
  else fail(`a failed fixture's record carries no usable stderr — the verdict asserts exit ${ran.exit} with nothing behind it: ${JSON.stringify(ran)}`);

  // The green direction, which is the one that hides a false pass.
  if (typeof green.stdout_tail === "string" && green.stdout_tail.includes("4 passed")) ok("a passing fixture's record keeps its stdout (a green that ran nothing stays visible)");
  else fail(`a passing fixture's record carries no stdout — a fixture that passed having run zero tests is unreadable from the artifact: ${JSON.stringify(green)}`);

  // The fact the kernel computes and used to throw away.
  if (crash.error) ok("a fixture that never ran keeps its `error` in the record");
  else fail(`the spawn failure was dropped from the record — the kernel measured it and the artifact does not carry it: ${JSON.stringify(crash)}`);

  if (!ran.error) ok("a fixture that ran and failed carries NO `error` (the field means 'never ran', not 'went badly')");
  else fail(`a command that ran and exited 1 was recorded with error=${JSON.stringify(ran.error)} — the two facts are being conflated in the other direction`);

  // The schema is where a reader learns the fields exist; a persisted field it does not declare is
  // a field the next reader has no reason to trust.
  {
    const schema = readJSON(join(ROOT, "kernel/schemas/domain.schema.json"));
    const props = schema.$defs?.CommandResult?.properties || {};
    const missing = ["error", "stdout_tail", "stderr_tail"].filter((k) => !props[k]);
    if (!missing.length) ok("CommandResult declares error/stdout_tail/stderr_tail");
    else fail(`CommandResult does not declare ${missing.join(", ")} — the artifact carries fields the schema denies`);
  }

  // ===============================================================================================
  section("131. Refused and broken are different records — and the output is bounded");
  // ===============================================================================================
  // THE DEFECT AS A PROPERTY. Both commands land on `exit 1, pass false`; that is the mapping, and
  // it is not what changed. What has to be true is that a reader holding only the artifact can
  // still tell which one happened, without re-running anything and without a heuristic.
  {
    const classify = (r) => (r.error ? "did-not-run" : "ran-and-failed");
    const sameVerdict = crash.exit === ran.exit && crash.pass === ran.pass;
    if (sameVerdict) ok("both outcomes still land on the same exit/pass pair (the conflation is real, not assumed)");
    else ok(`the two outcomes differ at exit/pass already (crash exit=${crash.exit}, failure exit=${ran.exit})`);
    if (classify(crash) === "did-not-run" && classify(ran) === "ran-and-failed") ok("the artifact ALONE separates a refused command from a broken build");
    else fail(`the artifact cannot separate the two: crash→${classify(crash)}, failure→${classify(ran)}`);
  }

  // BOUNDED, because an unbounded tail turns one chatty fixture into a megabyte of run trace that
  // every later reader pays for. The bound has to keep the END: a stack trace and a test summary
  // both land there.
  {
    const noisy = t0("noisy", ["node -e \"for (let i = 0; i < 40000; i++) console.log('filler line ' + i); console.log('LAST LINE MARKER')\""]);
    const row = rowOf(noisy.artifact || {});
    const tail = row.stdout_tail || "";
    if (tail.includes("LAST LINE MARKER")) ok("the kept output is the TAIL — the last line of a noisy fixture survives");
    else fail("the kept output does not include the end of the stream — a stack trace or a summary line would be cut off");
    if (tail.length && tail.length <= 8192) ok(`the kept output is bounded (${tail.length} chars from a ~700KB stream)`);
    else fail(`the kept output is ${tail.length} chars — unbounded output makes every T0 artifact pay for one chatty fixture`);
    if (!tail.includes("filler line 0\n")) ok("the truncated head is genuinely dropped, not merely reordered");
    else fail("the head of a truncated stream is still present — the bound is not doing what it says");
    if (/truncat/i.test(tail)) ok("a truncated tail says so in the record (a partial stream never reads as the whole one)");
    else fail("a truncated tail is indistinguishable from a complete one — the record overstates its own evidence");
  }
}
