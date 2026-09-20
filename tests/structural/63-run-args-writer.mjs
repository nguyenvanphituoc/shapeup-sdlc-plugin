// 63 — HD-020 (and HD-010's executed half): `run-args.json` HAS A KERNEL WRITER, EXECUTED.
//
// THE DEFECT THIS CLOSES. `domain.schema.json` called `.shapeup/<slug>/run-args.json` "the only
// artifact that records what a run was configured with", and `kernel/probe/concurrency.mjs`'s
// `dialFrom()` read it for the fan-out dial while its own comment admitted "it is absent from every
// run recorded so far". Outside a test fixture, nothing wrote it — the file was produced by prose
// telling a session to `Write` a JSON object it assembled by hand, with no kernel writer and no
// guard. This module executes the shipped CLI end to end: opens a real run, writes the launch
// record through `harness init run-args`, and reads it back through the shipped reader — never
// asserting against a narrated behaviour.
//
// §98 is HD-020 itself. §97 is the other half of HD-010: the deadline breaker's OWN path (the row
// `tests/structural/62-run-args-surface.mjs` marks exempt) actually works end to end, independent
// of RunArgs and of anything this module writes — proving the exemption is a working alternate
// path, not just a documented excuse.

// §99 is HD-020's positive enforcer: a run with no launch record cannot proceed unremarked, because
// `probe concurrency --require-run-args` — the check `shapeup-run.js` calls at Preflight, before
// ORIENT — reds on a real run root that genuinely has none. §100 is the sibling defect one level
// down: `kernel/init/run-args.mjs`'s `autoLevel` enum is DERIVED from `domain.schema.json`, not
// hand-typed beside it — proven the same way Stage 5's own decisive test proves §96's fields are
// derived, by mutating the SOURCE and watching the result change with no line here touched.

import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Run the kernel in a workspace.
 * @param {string} ROOT - Repo root.
 * @param {string} ws - Workspace directory.
 * @param {...string} argv - Kernel arguments.
 * @returns {{status:number, stdout:string, stderr:string}} The spawn outcome.
 */
function kernel(ROOT, ws, ...argv) {
  const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...argv],
    { cwd: ws, encoding: "utf8", timeout: 30_000 });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

const RUN_ARGS_BASE = ["--auto-level", "unattended", "--exec-model", "claude-sonnet-5",
  "--eval-model", "claude-sonnet-5", "--max-rounds", "3", "--attempts", "5"];

/**
 * Run the run-args writer checks (sections 97-100).
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when every section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read } = ctx;

  // =============================================================================
  section("97. The deadline breaker reads the receipt directly and needs no RunArgs field, executed");
  // =============================================================================
  {
    const runMod = await import(join(ROOT, "kernel/init/run.mjs"));
    if (Object.hasOwn(runMod.ARGV_SPEC || {}, "wall-clock-budget")) {
      ok('"harness init run"\'s own ARGV_SPEC declares --wall-clock-budget — the flag gates.md documents exists where it says it does');
    } else {
      fail('"harness init run" no longer declares --wall-clock-budget in its ARGV_SPEC — gates.md L0.9b\'s exemption row now names a flag nothing accepts');
    }
    const budgetSrc = read(join(ROOT, "kernel/verify/budget.mjs"));
    if (/wall_clock_budget_s/.test(budgetSrc)) {
      ok("kernel/verify/budget.mjs reads wall_clock_budget_s — the exact receipt field harness init run writes");
    } else {
      fail("kernel/verify/budget.mjs no longer mentions wall_clock_budget_s — the deadline breaker's own reader has moved with nothing tracking it");
    }

    const ws = mkdtempSync(join(tmpdir(), "hd010-deadline-"));
    try {
      const opened = kernel(ROOT, ws, "init", "run", "--slug", "deadline",
        "--intake-text", "prove the deadline breaker needs no RunArgs field",
        "--auto-level", "unattended", "--wall-clock-budget", "5", "--cwd", ws);
      const receiptPath = join(ws, ".shapeup/deadline/receipt.json");
      if (opened.status !== 0 || !existsSync(receiptPath)) {
        fail(`init run did not open a run: exit ${opened.status} ${opened.stderr.slice(0, 200)}`);
      } else {
        const startedAt = JSON.parse(readFileSync(receiptPath, "utf8")).started_at;
        // 20s past a 5s budget, computed from the receipt's own clock — no sleep, no RunArgs, no
        // run-args.json anywhere in this workspace at all.
        const future = new Date(Date.parse(startedAt) + 20_000).toISOString();
        const trip = kernel(ROOT, ws, "verify", "budget", "--slug", "deadline", "--strict", "--at", future, "--cwd", ws);
        if (trip.status === 6 && /"status":\s*"trip"/.test(trip.stdout)) {
          ok("verify budget --strict trips (exit 6) purely off the receipt's wall_clock_budget_s — RunArgs never entered it");
        } else {
          fail(`verify budget --strict did not trip: exit ${trip.status}\n${trip.stdout}${trip.stderr}`);
        }
      }

      // The non-regression half: no --wall-clock-budget at all still reports "off", exactly as
      // before this stage touched anything.
      const off = kernel(ROOT, ws, "init", "run", "--slug", "no-deadline",
        "--intake-text", "no budget configured at all", "--auto-level", "unattended", "--cwd", ws);
      if (off.status !== 0) {
        fail(`init run (no wall-clock-budget) failed: exit ${off.status}`);
      } else {
        const offCheck = kernel(ROOT, ws, "verify", "budget", "--slug", "no-deadline", "--strict", "--cwd", ws);
        if (offCheck.status === 0 && /"status":\s*"off"/.test(offCheck.stdout)) {
          ok('a run opened with no --wall-clock-budget reports status "off" and exit 0 (non-regression)');
        } else {
          fail(`expected status "off" / exit 0 with no budget configured, got exit ${offCheck.status}\n${offCheck.stdout}`);
        }
      }
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }

  // =============================================================================
  section("98. `run-args.json` has a kernel writer, executed, and the reader agrees with what it emits");
  // =============================================================================
  {
    const concurrency = await import(join(ROOT, "kernel/probe/concurrency.mjs"));
    const ws = mkdtempSync(join(tmpdir(), "hd020-runargs-"));
    try {
      // (a) Refusing to write with no run open — the file is meaningless without a receipt behind it.
      const orphan = kernel(ROOT, ws, "init", "run-args", "--slug", "ghost", ...RUN_ARGS_BASE,
        "--plugin-root", ROOT, "--cwd", ws);
      if (orphan.status === 3) ok("harness init run-args refuses (exit 3) when no run is open at --slug — no orphaned launch record");
      else fail(`expected exit 3 with no open run, got ${orphan.status}\n${orphan.stderr}`);

      // (b) Open the run for real.
      const opened = kernel(ROOT, ws, "init", "run", "--slug", "fanout",
        "--intake-text", "prove run-args.json has a kernel writer", "--auto-level", "unattended", "--cwd", ws);
      const receiptPath = join(ws, ".shapeup/fanout/receipt.json");
      if (opened.status !== 0 || !existsSync(receiptPath)) {
        fail(`init run did not open a run: exit ${opened.status} ${opened.stderr.slice(0, 200)}`);
        return;
      }
      const receiptRunId = JSON.parse(readFileSync(receiptPath, "utf8")).run_id;

      // (c) --eval-model is required unless --no-eval is set.
      const noEvalModel = kernel(ROOT, ws, "init", "run-args", "--slug", "fanout",
        "--auto-level", "unattended", "--exec-model", "claude-sonnet-5",
        "--max-rounds", "3", "--attempts", "5", "--plugin-root", ROOT, "--cwd", ws);
      if (noEvalModel.status === 2) ok("harness init run-args refuses (exit 2) with no --eval-model and no --no-eval");
      else fail(`expected exit 2 with --eval-model omitted and EVAL not skipped, got ${noEvalModel.status}`);

      // (d) The real write: exec+eval models, parallel-scopes declared, no --run-id (auto-filled).
      const written = kernel(ROOT, ws, "init", "run-args", "--slug", "fanout", ...RUN_ARGS_BASE,
        "--plugin-root", ROOT, "--parallel-scopes", "2", "--cwd", ws);
      const runArgsPath = join(ws, ".shapeup/fanout/run-args.json");
      if (written.status !== 0 || !existsSync(runArgsPath)) {
        fail(`init run-args did not write the file: exit ${written.status}\n${written.stderr}`);
        return;
      }
      ok("harness init run-args exits 0 and writes .shapeup/<slug>/run-args.json for an open run");

      let stdoutObj, fileObj;
      try { stdoutObj = JSON.parse(written.stdout); } catch { fail(`init run-args stdout is not JSON: ${written.stdout.slice(0, 200)}`); return; }
      try { fileObj = JSON.parse(readFileSync(runArgsPath, "utf8")); } catch { fail("run-args.json on disk is not valid JSON"); return; }

      if (JSON.stringify(stdoutObj) === JSON.stringify(fileObj)) {
        ok("the object printed on stdout is byte-identical to the object written to run-args.json — one construction, not two");
      } else {
        fail(`stdout and the written file disagree:\n  stdout: ${JSON.stringify(stdoutObj)}\n  file:   ${JSON.stringify(fileObj)}`);
      }

      if (stdoutObj.runId === receiptRunId) {
        ok("--run-id, omitted, is auto-filled from the run's own receipt — never invented");
      } else {
        fail(`expected runId "${receiptRunId}" auto-filled from the receipt, got "${stdoutObj.runId}"`);
      }

      if (!("wallClockS" in (stdoutObj.budgets || {}))) {
        ok("the written RunArgs object carries no wallClockS — the field HD-010 removed stays removed at the writer too");
      } else {
        fail("the writer emitted budgets.wallClockS — HD-010 chose removal and the writer was not updated to match");
      }

      // (e) THE READER, EXECUTED: probe concurrency's dialFrom() against the run root this call
      // actually wrote into — never a hand-typed fixture standing in for it.
      const runRoot = join(ws, ".shapeup/fanout");
      const dial = concurrency.dialFrom(runRoot);
      if (dial.max_parallel_scopes === 2 && dial.source === "run-args") {
        ok("probe concurrency's dialFrom() reads maxParallelScopes=2 straight off the file this writer just produced");
      } else {
        fail(`dialFrom() disagreed with the writer: expected {max_parallel_scopes:2, source:"run-args"}, got ${JSON.stringify(dial)}`);
      }

      // (f) The absence case: no --parallel-scopes declared, the reader must say so rather than
      // asserting an operator choice nobody made.
      const noDial = kernel(ROOT, ws, "init", "run-args", "--slug", "fanout", ...RUN_ARGS_BASE,
        "--plugin-root", ROOT, "--cwd", ws);
      if (noDial.status !== 0) {
        fail(`init run-args (no --parallel-scopes) failed: exit ${noDial.status}`);
      } else {
        const noDialObj = JSON.parse(noDial.stdout);
        if (!("maxParallelScopes" in noDialObj)) {
          ok("omitting --parallel-scopes omits maxParallelScopes from the written object (never a guessed default)");
        } else {
          fail(`expected maxParallelScopes omitted when --parallel-scopes was not passed, got ${noDialObj.maxParallelScopes}`);
        }
        const dialDefault = concurrency.dialFrom(runRoot);
        if (dialDefault.max_parallel_scopes === 4 && dialDefault.source === "default (run-args.json declares none)") {
          ok("dialFrom() falls back to the documented default and says so, over a run-args.json that declares no dial");
        } else {
          fail(`expected the "declares none" default, got ${JSON.stringify(dialDefault)}`);
        }
      }
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }

  // =============================================================================
  section("99. HD-020's positive enforcer — a run with no launch record cannot proceed unremarked, executed");
  // =============================================================================
  {
    // (a) STATIC — the enforcer is actually wired into the workflow, not just available as a kernel
    // flag nobody calls. `shapeup-run.js` cannot be executed by this suite (its own header: no
    // import seam — it runs only on the Workflow runtime), so this is the same kind of source
    // assertion §96 already makes for wallClockS's non-regression.
    const workflowSrc = read(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"));
    if (/--require-run-args/.test(workflowSrc) && /requireLaunchRecord/.test(workflowSrc)) {
      ok("shapeup-run.js calls probe concurrency --require-run-args (via requireLaunchRecord()) — the enforcer is wired into Preflight, not merely available");
    } else {
      fail("shapeup-run.js no longer calls --require-run-args — HD-020's enforcer exists in the kernel but nothing dispatches it, which is the exact prose-only defect this stage closed");
    }
    // It must run BEFORE Orient, not after — an enforcer checked once work is already underway is a
    // diagnostic, not a gate.
    const preflightIdx = workflowSrc.indexOf('phase("Preflight")');
    // The CALL, not the declaration: "await requireLaunchRecord()" appears only at the call site —
    // the function's own `async function requireLaunchRecord() {` line has no `await` before it.
    const requireIdx = workflowSrc.indexOf("await requireLaunchRecord()");
    const orientIdx = workflowSrc.indexOf('phase("Orient")');
    if (preflightIdx !== -1 && requireIdx !== -1 && orientIdx !== -1 && preflightIdx < requireIdx && requireIdx < orientIdx) {
      ok("requireLaunchRecord() is called inside Preflight, before phase(\"Orient\") — the record is required before any real work dispatches");
    } else {
      fail(`requireLaunchRecord()'s call site is not positioned between Preflight and Orient (preflight=${preflightIdx}, call=${requireIdx}, orient=${orientIdx})`);
    }

    // (b) EXECUTED — the kernel side of the enforcer, against a real run root with genuinely no
    // launch record, then a real one after harness init run-args writes it.
    const ws = mkdtempSync(join(tmpdir(), "hd020-enforcer-"));
    try {
      const opened = kernel(ROOT, ws, "init", "run", "--slug", "unrecorded",
        "--intake-text", "prove a run with no launch record is caught", "--auto-level", "unattended", "--cwd", ws);
      if (opened.status !== 0) {
        fail(`init run did not open a run: exit ${opened.status} ${opened.stderr.slice(0, 200)}`);
      } else {
        const before = kernel(ROOT, ws, "probe", "concurrency", "--slug", "unrecorded", "--require-run-args", "--cwd", ws);
        if (before.status === 6 && /"ok":false/.test(before.stdout)) {
          ok("probe concurrency --require-run-args exits 6 (ok:false) on a real run root with no run-args.json — the exact state HD-020 named");
        } else {
          fail(`expected exit 6 / ok:false with no launch record, got exit ${before.status}\n${before.stdout}${before.stderr}`);
        }

        const wrote = kernel(ROOT, ws, "init", "run-args", "--slug", "unrecorded", ...RUN_ARGS_BASE, "--plugin-root", ROOT, "--cwd", ws);
        if (wrote.status !== 0) {
          fail(`init run-args did not write the record: exit ${wrote.status}\n${wrote.stderr}`);
        } else {
          const after = kernel(ROOT, ws, "probe", "concurrency", "--slug", "unrecorded", "--require-run-args", "--cwd", ws);
          if (after.status === 0 && /"ok":true/.test(after.stdout)) {
            ok("probe concurrency --require-run-args exits 0 (ok:true) once harness init run-args has written the record — the same run root, the same check, the opposite answer");
          } else {
            fail(`expected exit 0 / ok:true once the record was written, got exit ${after.status}\n${after.stdout}${after.stderr}`);
          }
        }
      }
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }

  // =============================================================================
  section("100. `autoLevel` is derived from the schema inside run-args.mjs, not hand-typed beside it — proven by growth");
  // =============================================================================
  {
    const runArgsMod = await import(join(ROOT, "kernel/init/run-args.mjs"));
    if (typeof runArgsMod.autoLevels !== "function") {
      fail("kernel/init/run-args.mjs exports no autoLevels() — the auto-level set has no derivable seam a test can check");
    } else {
      const schema = JSON.parse(read(join(ROOT, "kernel/schemas/domain.schema.json")));
      const schemaLevels = schema?.$defs?.RunArgs?.properties?.autoLevel?.enum;
      const modLevels = runArgsMod.autoLevels(ROOT);
      if (Array.isArray(schemaLevels) && JSON.stringify(modLevels) === JSON.stringify(schemaLevels)) {
        ok(`run-args.mjs's autoLevels() reads back exactly domain.schema.json's own enum (${modLevels.join(", ")}) — one declaration, not two`);
      } else {
        fail(`autoLevels() (${JSON.stringify(modLevels)}) disagrees with the schema's own enum (${JSON.stringify(schemaLevels)})`);
      }

      // THE DECISIVE PROOF — mutate the SOURCE (a scratch copy of the schema), never this test's own
      // expectations, and confirm the module's answer moves with it. A hand-typed Set beside the
      // schema would report the same three values regardless of what this scratch schema says.
      const scratch = mkdtempSync(join(tmpdir(), "hd010-autolevel-"));
      try {
        mkdirSync(join(scratch, "kernel/schemas"), { recursive: true });
        const grown = JSON.parse(JSON.stringify(schema));
        grown.$defs.RunArgs.properties.autoLevel.enum = [...schemaLevels, "supervised"];
        writeFileSync(join(scratch, "kernel/schemas/domain.schema.json"), JSON.stringify(grown), "utf8");
        const grownLevels = runArgsMod.autoLevels(scratch);
        if (grownLevels.includes("supervised") && grownLevels.length === schemaLevels.length + 1) {
          ok('autoLevels() grows to include "supervised" the instant the schema does, over a scratch copy this test built — no line in run-args.mjs was touched');
        } else {
          fail(`autoLevels() did not grow with the mutated schema: expected ${schemaLevels.length + 1} values including "supervised", got ${JSON.stringify(grownLevels)}`);
        }

        const shrunk = JSON.parse(JSON.stringify(schema));
        shrunk.$defs.RunArgs.properties.autoLevel.enum = schemaLevels.filter((l) => l !== "unattended");
        writeFileSync(join(scratch, "kernel/schemas/domain.schema.json"), JSON.stringify(shrunk), "utf8");
        const shrunkLevels = runArgsMod.autoLevels(scratch);
        if (!shrunkLevels.includes("unattended") && shrunkLevels.length === schemaLevels.length - 1) {
          ok('autoLevels() loses "unattended" the instant the schema does — the set is read fresh, never cached from a prior call');
        } else {
          fail(`autoLevels() did not shrink with the mutated schema: got ${JSON.stringify(shrunkLevels)}`);
        }
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }

    // Non-regression: the hand-typed Set this stage removed does not come back.
    const runArgsSrc = read(join(ROOT, "kernel/init/run-args.mjs"));
    if (!/new Set\(\s*\[\s*["']interactive["']/.test(runArgsSrc)) {
      ok("kernel/init/run-args.mjs carries no hand-typed auto-level Set literal");
    } else {
      fail("kernel/init/run-args.mjs still hand-types the auto-level set as a Set literal — the derivation this section proves was reverted");
    }
  }
}
