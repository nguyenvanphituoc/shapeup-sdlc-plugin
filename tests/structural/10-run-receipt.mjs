// Structural test module: the run receipt, the gate answer set, and the zero-work block.
// Sections: 35, 36, 37.
//
// These three units exist because of one measured failure (sdd-harness-bench, F2 / Haiku 4.5,
// n=5, zero variance): the orchestrator was given a valid spec, described its own pipeline in
// future tense, and stopped — scoring 29% with 10 escaped defects while reading like a clean
// run. So the checks here are written against that transcript, not against the happy path. The
// question each one answers is "would this have caught THAT?".
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Run the run-receipt / gate-answers / zero-work checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx): ROOT, ok, fail,
 *   section, and the read helpers. ok()/fail() mutate the counters in place.
 * @returns {Promise<void>} Resolves when the section bodies finish.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  const node = (script, args, opts = {}) =>
    spawnSync("node", [join(ROOT, script), ...args], { encoding: "utf8", ...opts });

  // =============================================================================
  section("35. init-run.mjs opens a run and leaves the receipt every later guard depends on");
  // =============================================================================
  // The receipt is the fact that separates "the harness ran" from "the harness described
  // itself". Before it existed, every guard was scoped to an ACTIVE run and a run that never
  // started was invisible to all of them — the emptier the failure, the less of it there was
  // to detect. These checks assert the receipt is written, is complete, and cannot be
  // clobbered by a second init.
  const INIT = "skills/tech-lead/scripts/init-run.mjs";
  if (!existsSync(join(ROOT, INIT))) {
    fail(`${INIT} is missing — the run receipt has no writer`);
  } else {
    const ws = mkdtempSync(join(tmpdir(), "struct-initrun-"));
    try {
      const intake = "Add category budgets with a monthly rollover";
      const r = node(INIT, ["--slug", "budgets", "--intake-text", intake,
                            "--auto-level", "unattended", "--gate-answers", "ci", "--cwd", ws]);
      if (r.status === 0) ok("init-run exits 0 on a valid intake");
      else fail(`init-run failed on a valid intake: ${r.stderr || r.stdout}`);

      const receiptPath = join(ws, ".shapeup-sdlc", "budgets", "receipt.json");
      if (existsSync(receiptPath)) ok("init-run writes receipt.json");
      else fail("init-run did not write receipt.json — gate-zerowork has nothing to read");

      if (existsSync(join(ws, ".shapeup-sdlc", "active-scope"))) ok("init-run writes active-scope");
      else fail("init-run did not write active-scope — anti-rationalization stays scoped out");

      if (existsSync(join(ws, ".shapeup-sdlc", "budgets", "harness-run.md"))) ok("init-run writes harness-run.md");
      else fail("init-run did not write harness-run.md");

      // The intake, verbatim + digested. This is what makes "the spec was dropped on the
      // hand-off" a checkable claim — the benchmark's first (wrong) diagnosis was exactly that,
      // and nothing on disk could settle it either way.
      const intakePath = join(ws, ".shapeup-sdlc", "budgets", "intake.md");
      if (existsSync(intakePath) && readFileSync(intakePath, "utf8").includes(intake)) {
        ok("init-run records the intake verbatim");
      } else fail("init-run did not record the intake verbatim");

      if (existsSync(receiptPath)) {
        const rec = JSON.parse(readFileSync(receiptPath, "utf8"));
        if (rec.started === true) ok("receipt asserts started:true (the predicate gate-zerowork reads)");
        else fail("receipt lacks started:true");
        if (/^[0-9a-f]{64}$/.test(rec.intake_sha256 || "")) ok("receipt carries a sha256 of the intake");
        else fail("receipt lacks a well-formed intake_sha256");
        if (rec.config?.auto_level === "unattended" && rec.config?.gate_answers === "ci") {
          ok("receipt records the lane and the answer set it was opened with");
        } else fail("receipt does not record auto_level + gate_answers");
      }

      // A silent re-init would discard the round history the circuit breaker counts against.
      const again = node(INIT, ["--slug", "budgets", "--intake-text", intake, "--cwd", ws]);
      if (again.status === 3) ok("init-run refuses to clobber an existing receipt without --force");
      else fail(`re-init should exit 3, got ${again.status}`);

      // Both stdin shapes. `--intake-file -` is what an agent reaches for on its second attempt
      // (measured), so it is accepted rather than treated as a file literally named "-". Inlining
      // a multi-line requirement into a shell argument is the failure mode these exist to dodge.
      for (const [label, extraArgs] of [["--intake-stdin", ["--intake-stdin"]], ["--intake-file -", ["--intake-file", "-"]]]) {
        const slug = `stdin-${label.replace(/[^a-z]/g, "")}`;
        const r2 = node(INIT, ["--slug", slug, ...extraArgs, "--cwd", ws], { input: intake });
        const wrote = existsSync(join(ws, ".shapeup-sdlc", slug, "receipt.json"));
        if (r2.status === 0 && wrote) ok(`init-run accepts intake on stdin via ${label}`);
        else fail(`${label} did not open a run (exit ${r2.status}): ${r2.stderr}`);
      }

      // Same precondition as GATE L0.0, re-checked where the run actually opens.
      const empty = node(INIT, ["--slug", "x", "--cwd", ws]);
      if (empty.status === 2) ok("init-run refuses an empty intake (exit 2)");
      else fail(`empty intake should exit 2, got ${empty.status}`);
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }

  // =============================================================================
  section("36. gate-answers.mjs resolves gates by exit code, and refuses a set that would stall");
  // =============================================================================
  // The exit code IS the contract — the orchestrator branches on it, not on the prose. And
  // `--verify` is the ten-second check that replaces a 1800s DNF: an unattended lane whose
  // answer set stops at a gate is a stall, and a stall is indistinguishable from work until the
  // budget runs out.
  const GA = "skills/tech-lead/scripts/gate-answers.mjs";
  if (!existsSync(join(ROOT, GA))) {
    fail(`${GA} is missing — gate sign-off has no mechanism`);
  } else {
    const cross = node(GA, ["--resolve", "L1b", "--preset", "ci"]);
    if (cross.status === 0) ok("gate-answers exits 0 on a pre-approved gate");
    else fail(`ci/L1b should exit 0, got ${cross.status}`);
    try {
      const out = JSON.parse(cross.stdout);
      if (out.decision === "proceed") ok("ci/L1b resolves to proceed");
      else fail(`ci/L1b resolved to ${out.decision}`);
      // The record is generated by the tool that made the decision, never re-typed by the model.
      if (typeof out.ledger_row === "string" && out.ledger_row.includes("preset:ci")) {
        ok("a crossing yields a ledger row naming its source");
      } else fail("crossing does not yield a source-bearing ledger row");
    } catch { fail("gate-answers --resolve did not emit parseable JSON"); }

    const ask = node(GA, ["--resolve", "L4", "--preset", "guarded"]);
    if (ask.status === 4) ok("gate-answers exits 4 when the gate must go to the PO");
    else fail(`guarded/L4 should exit 4 (ask), got ${ask.status}`);

    const missing = node(GA, ["--resolve", "L4", "--file", join(ROOT, "tests", "does-not-exist.json")]);
    if (missing.status === 2) ok("gate-answers exits 2 on an unreadable answer set");
    else fail(`missing file should exit 2, got ${missing.status}`);

    const verifyCi = node(GA, ["--verify", "--preset", "ci", "--auto-level", "unattended"]);
    if (verifyCi.status === 0) ok("--verify passes the ci preset for an unattended lane");
    else fail(`ci should verify clean for unattended, got ${verifyCi.status}: ${verifyCi.stdout}`);

    const verifyGuarded = node(GA, ["--verify", "--preset", "guarded", "--auto-level", "unattended"]);
    if (verifyGuarded.status === 2) ok("--verify rejects a set that would stall an unattended lane");
    else fail(`guarded under unattended should fail verify, got ${verifyGuarded.status}`);

    // An answer set that says `L4: "proceed"` was written by someone who did not know what L4
    // asks. Coercing it would be worse than refusing it.
    const ws2 = mkdtempSync(join(tmpdir(), "struct-ga-"));
    try {
      const bad = join(ws2, "bad.json");
      writeFileSync(bad, JSON.stringify({ version: 1, preset: "custom", answers: { L4: { decision: "proceed" } } }));
      const r = node(GA, ["--resolve", "L4", "--file", bad]);
      if (r.status === 2 && /not valid here/.test(r.stderr)) ok("gate-answers rejects a decision that is invalid for its gate");
      else fail(`invalid decision for L4 should exit 2 with an explanation, got ${r.status}`);

      // The direct fix for the DNF: a headless lane must fail fast, not wait.
      const abortSet = join(ws2, "abort.json");
      writeFileSync(abortSet, JSON.stringify({ version: 1, preset: "custom", on_missing: "abort", answers: { L0: { decision: "proceed" } } }));
      const ab = node(GA, ["--resolve", "L4", "--file", abortSet]);
      if (ab.status === 5) ok("on_missing:abort turns an unanswered gate into a fast attributable abort");
      else fail(`on_missing:abort should exit 5, got ${ab.status}`);
    } finally {
      rmSync(ws2, { recursive: true, force: true });
    }
  }

  // =============================================================================
  section("37. gate-zerowork.mjs blocks the narrated run, and nothing else");
  // =============================================================================
  // Case A is the benchmark transcript, reproduced. The rest are the fail-open paths: a hook
  // that blocks legitimate sessions gets disabled, and a disabled hook enforces nothing.
  const ZW = "hooks/gate-zerowork.mjs";
  if (!existsSync(join(ROOT, ZW))) {
    fail(`${ZW} is missing — narration has no detector`);
  } else {
    const ws = mkdtempSync(join(tmpdir(), "struct-zerowork-"));
    try {
      const jsonl = (evts, name) => {
        const p = join(ws, name);
        writeFileSync(p, evts.map((e) => JSON.stringify(e)).join("\n") + "\n");
        return p;
      };
      const dispatch = { type: "assistant", message: { content: [
        { type: "tool_use", name: "Skill", input: { skill: "shapeup-sdlc-plugin:tech-lead", args: "--unattended" } },
      ] } };
      const narrationText = "The tech-lead skill is orchestrating the full Shape Up harness. It will: 1. ...";
      const narrated = jsonl([dispatch, { type: "assistant", message: { content: [{ type: "text", text: narrationText }] } }], "narrated.jsonl");
      const worked = jsonl([dispatch,
        { type: "assistant", message: { content: [{ type: "tool_use", name: "Write", input: {} }, { type: "tool_use", name: "Bash", input: {} }] } },
        { type: "assistant", message: { content: [{ type: "tool_use", name: "Edit", input: {} }, { type: "tool_use", name: "Write", input: {} }] } },
      ], "worked.jsonl");
      const unrelated = jsonl([{ type: "assistant", message: { content: [{ type: "text", text: "hello" }] } }], "unrelated.jsonl");

      const empty = join(ws, "empty"); mkdirSync(empty, { recursive: true });
      const started = join(ws, "started", ".shapeup-sdlc", "budgets");
      mkdirSync(started, { recursive: true });
      writeFileSync(join(started, "receipt.json"), JSON.stringify({ started: true, slug: "budgets" }));

      const fire = (payload) => spawnSync("node", [join(ROOT, ZW)], { encoding: "utf8", input: JSON.stringify(payload) });

      const a = fire({ cwd: empty, transcript_path: narrated, last_assistant_message: narrationText });
      let blocked = null;
      try { blocked = JSON.parse(a.stdout || "{}"); } catch { /* not JSON */ }
      if (blocked?.decision === "block") ok("BLOCKS the benchmark transcript: orchestrator dispatched, no receipt");
      else fail("did not block the narrated-run transcript — the failure it exists for");
      if (typeof blocked?.reason === "string" && /init-run\.mjs/.test(blocked.reason)) {
        ok("the block names the exact next command, not just the problem");
      } else fail("block reason does not tell the model what to run");

      const b = fire({ cwd: join(ws, "started"), transcript_path: narrated });
      if (!b.stdout.trim()) ok("defers once a receipt exists (progress is anti-rationalization's job)");
      else fail("fired despite a receipt on disk");

      const c = fire({ cwd: empty, transcript_path: worked });
      if (!c.stdout.trim()) ok("defers when the session did real work by other means (fail-open)");
      else fail("fired on a session with four work calls");

      const d = fire({ cwd: empty, transcript_path: unrelated });
      if (!d.stdout.trim()) ok("defers on a non-harness session");
      else fail("fired on a session that never dispatched the orchestrator");

      const e = fire({ cwd: empty, transcript_path: narrated, stop_hook_active: true });
      if (!e.stdout.trim()) ok("defers when stop_hook_active (one block per stop chain, no loop)");
      else fail("would loop: fired with stop_hook_active set");

      const f = fire({ cwd: empty, transcript_path: join(ws, "nope.jsonl") });
      if (!f.stdout.trim()) ok("defers when the transcript is unreadable (no facts, no block)");
      else fail("fired without a transcript to reason from");

      // The second structural miss the benchmark exposed: the advisory guard matched only
      // past-tense completion, so the emptiest failures were the least detectable.
      const ar = join(ROOT, "hooks", "anti-rationalization.mjs");
      if (existsSync(ar)) {
        const mod = await import(`file://${ar}`);
        if (mod.detectClaim(narrationText)) ok("anti-rationalization now detects a future-tense promise as a claim");
        else fail("anti-rationalization still misses future-tense narration");
        if (mod.detectClaim("all tests pass")) ok("anti-rationalization still detects past-tense completion");
        else fail("past-tense claim detection regressed");
      }
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }

  // =============================================================================
  section("38. The deadline breaker trips inward, and leaves the exit reachable");
  // =============================================================================
  // The benchmark's F3 DNF was read as a gate stall and was not one: 327 turns, 262 tool calls,
  // 37 writes, last gate L3, zero stall signals. It was working when the clock ran out, and both
  // existing breakers count EVENTS, so neither could see it. These checks assert the third
  // breaker's two load-bearing properties — it stops new work, and it does NOT block the run's
  // ability to judge, hammer and close (a breaker that sealed the exit would strand green scopes).
  const BUDGET = "skills/tech-lead/scripts/budget-check.mjs";
  const DEADLINE = "hooks/gate-deadline.mjs";
  if (!existsSync(join(ROOT, BUDGET)) || !existsSync(join(ROOT, DEADLINE))) {
    fail("the wall-clock breaker is missing budget-check.mjs and/or gate-deadline.mjs");
  } else {
    const { evaluateBudget, WARN_AT } = await import(`file://${join(ROOT, BUDGET)}`);

    if (evaluateBudget(10, null).status === "off") ok("no budget configured → breaker off (non-regression)");
    else fail("an unconfigured budget should report off");
    if (evaluateBudget(10, 1800).status === "ok") ok("well inside the budget → ok");
    else fail("early elapsed should report ok");
    if (evaluateBudget(1800 * WARN_AT + 1, 1800).status === "warn") ok(`crossing ${WARN_AT * 100}% → warn (finish the scope in flight, open nothing new)`);
    else fail("crossing the warn threshold did not report warn");
    if (evaluateBudget(1801, 1800).status === "trip") ok("past the budget → trip");
    else fail("exceeding the budget did not trip");
    if (/GATE H/.test(evaluateBudget(1801, 1800).action)) ok("the trip routes to GATE H — ship what is green, never a silent kill");
    else fail("the trip action does not route to GATE H");

    const ws = mkdtempSync(join(tmpdir(), "struct-deadline-"));
    try {
      const r = node(INIT, ["--slug", "f3", "--intake-text", "wiring trap", "--auto-level", "unattended",
                           "--wall-clock-budget", "1800", "--cwd", ws]);
      if (r.status === 0) ok("init-run accepts --wall-clock-budget");
      else fail(`init-run rejected --wall-clock-budget: ${r.stderr}`);

      const receiptPath = join(ws, ".shapeup-sdlc", "f3", "receipt.json");
      const rec = JSON.parse(readFileSync(receiptPath, "utf8"));
      if (rec.config.wall_clock_budget_s === 1800) ok("the budget is recorded in the receipt, where the hook reads it");
      else fail("wall_clock_budget_s did not reach the receipt");

      // Wind the clock back rather than waiting for it.
      rec.started_at = new Date(Date.now() - 2000 * 1000).toISOString();
      writeFileSync(receiptPath, JSON.stringify(rec, null, 2));

      const fire = (skill) => spawnSync("node", [join(ROOT, DEADLINE)], {
        encoding: "utf8",
        input: JSON.stringify({ tool_name: "Skill", cwd: ws, tool_input: { skill } }),
      });

      const denied = fire("shapeup-sdlc-plugin:task-executor");
      let out = null;
      try { out = JSON.parse(denied.stdout || "{}"); } catch { /* not JSON */ }
      if (out?.hookSpecificOutput?.permissionDecision === "deny") ok("DENIES task-executor past the deadline");
      else fail("did not deny new build work past the deadline");
      if (/scope-hammer/.test(out?.hookSpecificOutput?.permissionDecisionReason || "")) {
        ok("the denial names the exit — Skill(scope-hammer, --breaker deadline)");
      } else fail("the denial does not name the exit");

      for (const survivor of ["spec-evaluator", "scope-hammer", "qa-edge-hunter", "advisor-protocol"]) {
        if (!fire(survivor).stdout.trim()) ok(`allows ${survivor} past the deadline (the run must still be able to close)`);
        else fail(`denied ${survivor} past the deadline — that strands the run with green scopes it cannot ship`);
      }

      // STICKY TRIP. The first version denied politely and could be retried; a measured run
      // re-dispatched task-executor THIRTEEN times and burned the budget the breaker exists to
      // protect. A re-triable denial makes the failure it prevents worse, so the trip is recorded
      // and the language escalates — the second denial must not read like the first.
      const second = fire("task-executor");
      let out2 = null;
      try { out2 = JSON.parse(second.stdout || "{}"); } catch { /* not JSON */ }
      const reason2 = out2?.hookSpecificOutput?.permissionDecisionReason || "";
      if (/DENIAL #2/.test(reason2)) ok("a repeat denial says so, and escalates");
      else fail("the second denial is identical to the first — the retry loop is not addressed");
      if (/STOP TRYING TO BUILD/.test(reason2)) ok("the repeat denial is unambiguous about stopping");
      else fail("the repeat denial does not tell the orchestrator to stop retrying");
      if (existsSync(join(ws, ".shapeup-sdlc", "f3", "deadline-tripped.json"))) {
        const trip = JSON.parse(readFileSync(join(ws, ".shapeup-sdlc", "f3", "deadline-tripped.json"), "utf8"));
        if (trip.denials >= 2) ok(`the trip is a fact on disk, with a retry count (${trip.denials})`);
        else fail("deadline-tripped.json does not count retries");
      } else fail("the trip was not recorded on disk");

      // Non-regression: the whole mechanism is invisible unless a budget is set.
      rec.config.wall_clock_budget_s = null;
      writeFileSync(receiptPath, JSON.stringify(rec, null, 2));
      if (!fire("task-executor").stdout.trim()) ok("defers entirely when no budget is configured");
      else fail("fired without a configured budget — that is a regression on every existing run");
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }

  // =============================================================================
  section("39. Every valued flag in ship.md is stripped by the intake gate");
  // =============================================================================
  // GATE L0.0 decides "is there any requirement text here?" by removing flags and their values
  // and looking at what is left. A valued flag missing from its strip-list therefore leaves its
  // VALUE behind, and the value reads as the spec — so the gate waves through the empty dispatch
  // it exists to deny. Measured: adding `--gate-answers ci --wall-clock-budget 2400` did exactly
  // that, and the next benchmark run reached tech-lead with no requirement text and was allowed.
  // This test couples the two files so the next flag cannot repeat it.
  {
    const gatePath = join(ROOT, "hooks", "gate-intake.mjs");
    const shipPath = join(ROOT, "commands", "ship.md");
    if (!existsSync(gatePath) || !existsSync(shipPath)) {
      fail("gate-intake.mjs or commands/ship.md is missing");
    } else {
      const gate = readFileSync(gatePath, "utf8");
      const m = /const VALUED_FLAGS = \/--\(([^)]+)\)/.exec(gate);
      if (!m) fail("could not find VALUED_FLAGS in gate-intake.mjs");
      else {
        const known = new Set(m[1].split("|"));
        ok(`VALUED_FLAGS parses (${known.size} flags)`);
        // Flags documented in ship.md as taking a value: `--flag <value>` or `--flag N`.
        const ship = readFileSync(shipPath, "utf8");
        const documented = new Set();
        for (const line of ship.split("\n")) {
          const d = /^-\s+`--([a-z0-9-]+)\s+[<\w]/.exec(line.trim());
          if (d) documented.add(d[1]);
        }
        if (documented.size === 0) fail("parsed no valued flags out of commands/ship.md — the coupling is not being checked");
        else ok(`commands/ship.md documents ${documented.size} valued flag(s)`);
        for (const f of documented) {
          if (known.has(f)) ok(`--${f} is stripped by the intake gate`);
          else fail(`--${f} takes a value in commands/ship.md but is NOT in gate-intake.mjs VALUED_FLAGS — its value will read as requirement text and blind GATE L0.0`);
        }
      }
    }
  }

  // The dispatch shape that actually slipped through, asserted end to end.
  {
    const gatePath = join(ROOT, "hooks", "gate-intake.mjs");
    if (existsSync(gatePath)) {
      const fire = (args) => spawnSync("node", [gatePath], {
        encoding: "utf8",
        input: JSON.stringify({ tool_name: "Skill", tool_input: { skill: "shapeup-sdlc-plugin:tech-lead", args } }),
      });
      const flagsOnly = fire("--unattended --gate-answers ci --wall-clock-budget 2400");
      let out = null;
      try { out = JSON.parse(flagsOnly.stdout || "{}"); } catch { /* not JSON */ }
      if (out?.hookSpecificOutput?.permissionDecision === "deny") ok("denies a flags-only dispatch that carries the new v1.4 flags");
      else fail("a flags-only dispatch with --gate-answers/--wall-clock-budget is NOT denied");

      if (!fire("--unattended --gate-answers ci Add category budgets to the CLI").stdout.trim()) {
        ok("still defers when real requirement text follows the flags");
      } else fail("denied a dispatch that carried requirement text");
    }
  }

  // =============================================================================
  section("40. The fit-check separates a small change from a large one, and defaults to full");
  // =============================================================================
  // The root cause the other fixes did not touch: a three-file change was run through eleven gates
  // and never finished, four attempts running. The harness's own L0 note had already called that
  // change small — and the full lane ran anyway, because the lane was a judgment the model could
  // talk itself out of.
  //
  // The first version of this check asked "is there evidence this is BIG?" and defaulted to tiny.
  // It classified ALL THREE benchmark features as tiny, including the five-seam one that needed two
  // evaluation rounds to pass. These cases pin the asymmetry that replaced it: `tiny` must be
  // earned on every axis, `full` is the default, and a wrong `tiny` (skipping gates) is worse than
  // a wrong `full` (spending money).
  {
    const FC = "skills/tech-lead/scripts/fit-check.mjs";
    if (!existsSync(join(ROOT, FC))) {
      fail(`${FC} is missing — the lane is a judgment again`);
    } else {
      const { decideLane } = await import(`file://${join(ROOT, FC)}`);

      const small = decideLane({ intake: "Add a `summary` command that prints the total, the largest expense and the count.", files: 3 });
      if (small.lane === "tiny") ok("a one-module change in a 3-file tree routes to the tiny lane");
      else fail(`small change routed to ${small.lane}`);

      const wide = decideLane({ intake: "Add category budgets. ".repeat(200), files: 6 });
      if (wide.lane === "full") ok("a long multi-seam intake routes to the full lane");
      else fail("a 4000-char intake was called tiny");

      const dep = decideLane({ intake: "Add a flag. Requires a new dependency for date parsing.", files: 3 });
      if (dep.lane === "full") ok("a new dependency forces the full lane regardless of size");
      else fail("a new dependency did not force the full lane");

      const big = decideLane({ intake: "Add a flag.", files: 400 });
      if (big.lane === "full") ok("a large tree forces the full lane");
      else fail("a 400-file tree was called tiny");

      // The failure mode that made version 1 useless: absence of big-signals is not smallness.
      const empty = decideLane({ intake: "", files: 0 });
      if (empty.lane === "full") ok("an empty intake defaults to full, never tiny");
      else fail("an empty intake was routed to the tiny lane — the v1 defect");

      if (/advisory/.test(small.calibration || "")) ok("every verdict carries its calibration caveat (n=3)");
      else fail("the fit-check does not state that it is advisory");
    }
  }
}
