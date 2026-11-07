// 63 — THE LAUNCH RECORD, WRITTEN BY `init run`, AND THE MODEL FLOOR ENFORCED THERE.
//
// `.shapeup/<slug>/run-args.json` is the only artifact that records what a run was launched with. It was
// once produced by prose telling a session to `Write` a JSON object by hand, then by a dedicated verb a
// run script called; the script and the verb are gone, and what survives is the record and the two
// guards that read or precede it: `reduce ship` refuses to freeze a PASS report for a run launched with
// no evaluation (it reads this record), and an `exec` or `eval` model below the floor refuses the launch.
// So the record is written in the same act as the receipt, from the same parsed argv, and this module
// executes the shipped CLI end to end against a real run root.
//
// §97 is the deadline breaker's own path: it reads the receipt and needs no record field at all.
// §98 is the launch record itself — every switch typed lands in it, a below-floor model is refused with
// the role named and nothing written, the tiny lane is refused with the way forward, and an already-open
// run keeps the record it has. §100 pins that the auto-level set the launch accepts is the schema's.

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

/**
 * Run the launch-record checks (sections 97-100).
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when every section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read } = ctx;

  // =============================================================================
  section("97. The deadline breaker reads the receipt directly and needs no launch-record field, executed");
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
        "--intake-text", "prove the deadline breaker needs no launch-record field",
        "--auto-level", "unattended", "--wall-clock-budget", "5", "--cwd", ws);
      const receiptPath = join(ws, ".shapeup/deadline/receipt.json");
      if (opened.status !== 0 || !existsSync(receiptPath)) {
        fail(`init run did not open a run: exit ${opened.status} ${opened.stderr.slice(0, 200)}`);
      } else {
        const startedAt = JSON.parse(readFileSync(receiptPath, "utf8")).started_at;
        // 20s past a 5s budget, computed from the receipt's own clock — no sleep, no launch
        // record field, no run-args.json anywhere in this workspace at all.
        const future = new Date(Date.parse(startedAt) + 20_000).toISOString();
        const trip = kernel(ROOT, ws, "verify", "budget", "--slug", "deadline", "--strict", "--at", future, "--cwd", ws);
        if (trip.status === 6 && /"status":\s*"trip"/.test(trip.stdout)) {
          ok("verify budget --strict trips (exit 6) purely off the receipt's wall_clock_budget_s — the launch record never entered it");
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
  section("98. `init run` writes the launch record, carrying every switch typed, and refuses a model below the floor");
  // =============================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "launch-record-"));
    const recordOf = (slug) => JSON.parse(readFileSync(join(ws, ".shapeup", slug, "run-args.json"), "utf8"));
    try {
      // (a) A below-floor exec model is refused (exit 2), names the role, and writes NOTHING — no receipt,
      //     no record, no pointer. A refusal that leaves a half-opened run behind is a second defect.
      const low = kernel(ROOT, ws, "init", "run", "--slug", "low", "--intake-text", "x", "--exec-model", "claude-haiku-4", "--cwd", ws);
      if (low.status === 2 && /models\.exec/.test(low.stderr) && /model floor/.test(low.stderr)) ok("a below-floor --exec-model is refused at init run (exit 2), naming the exec role");
      else fail(`a haiku exec model was not refused with exit 2 naming exec: exit ${low.status}\n${low.stderr.slice(0, 300)}`);
      if (!existsSync(join(ws, ".shapeup", "low"))) ok("…and the refusal wrote nothing: no run root, so no half-opened run");
      else fail("a refused launch left a run root behind");

      const lowEval = kernel(ROOT, ws, "init", "run", "--slug", "low-eval", "--intake-text", "x", "--eval-model", "claude-3-5-haiku", "--cwd", ws);
      if (lowEval.status === 2 && /models\.eval/.test(lowEval.stderr)) ok("a below-floor --eval-model is refused, naming the eval role");
      else fail(`a haiku eval model was not refused naming eval: exit ${lowEval.status}\n${lowEval.stderr.slice(0, 300)}`);

      const noEvalLow = kernel(ROOT, ws, "init", "run", "--slug", "no-eval-low", "--intake-text", "x", "--eval-model", "haiku", "--no-eval", "--cwd", ws);
      if (noEvalLow.status === 0) ok("under --no-eval the eval model is not checked: a run that skips evaluation never resolves a judge");
      else fail(`--no-eval still checked the eval model: exit ${noEvalLow.status}\n${noEvalLow.stderr.slice(0, 200)}`);
      const qaLow = kernel(ROOT, ws, "init", "run", "--slug", "qa-low", "--intake-text", "x", "--qa-model", "haiku", "--cwd", ws);
      if (qaLow.status === 0) ok("the qa model is not checked: a hunt discovers and never decides");
      else fail(`a cheap qa model was refused: exit ${qaLow.status}\n${qaLow.stderr.slice(0, 200)}`);

      // (b) The tiny lane is retired and refused with the way forward, not run as a full run.
      for (const flag of [["--tiny"], ["--lane", "tiny"]]) {
        const tiny = kernel(ROOT, ws, "init", "run", "--slug", "tiny", "--intake-text", "x", ...flag, "--cwd", ws);
        if (tiny.status === 2 && /no longer served/.test(tiny.stderr) && /appetite/.test(tiny.stderr)) ok(`${flag.join(" ")} is refused (exit 2) and says what to do instead`);
        else fail(`${flag.join(" ")} was not refused with the way forward: exit ${tiny.status}\n${tiny.stderr.slice(0, 200)}`);
      }

      // (c) The real launch: every switch typed lands in the record, from the same argv as the receipt.
      const opened = kernel(ROOT, ws, "init", "run", "--slug", "fanout", "--intake-text", "prove the record carries what was typed",
        "--auto-level", "unattended", "--gate-answers", "ci", "--exec-model", "claude-sonnet-5", "--eval-model", "claude-opus-5", "--qa-model", "opus",
        "--max-rounds", "3", "--attempts", "5", "--parallel-scopes", "2", "--no-qa", "--adversarial-verify", "--lane", "full", "--cwd", ws);
      const receiptPath = join(ws, ".shapeup/fanout/receipt.json");
      if (opened.status !== 0 || !existsSync(receiptPath)) { fail(`init run did not open a run: exit ${opened.status} ${opened.stderr.slice(0, 200)}`); return; }
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      const rec = recordOf("fanout");
      const want = {
        slug: "fanout", runId: receipt.run_id, autoLevel: "unattended", answers: "ci", lane: "full",
        models: { exec: "claude-sonnet-5", eval: "claude-opus-5", qa: "opus" },
        budgets: { maxRounds: 3, attemptBudget: 5 }, noQa: true, adversarialVerify: true, maxParallelScopes: 2,
        pluginRoot: ROOT, startedAt: receipt.started_at,
      };
      const diff = Object.entries(want).filter(([k, v]) => JSON.stringify(rec[k]) !== JSON.stringify(v)).map(([k]) => k);
      if (!diff.length) ok("the record carries every switch typed — models, budgets, dial, answers, lane, --no-qa, --adversarial-verify — plus the receipt's run id, plugin root and start time");
      else fail(`the launch record disagrees with what was typed on: ${diff.join(", ")}\n  record: ${JSON.stringify(rec)}`);
      if (!("noEval" in rec)) ok("a switch not typed is absent from the record, never a guessed false");
      else fail(`noEval appeared in the record though --no-eval was not typed: ${JSON.stringify(rec)}`);
      const printed = JSON.parse(opened.stdout);
      if (JSON.stringify(printed.launch) === JSON.stringify(rec) && printed.launch_record === ".shapeup/fanout/run-args.json") ok("the record printed by init run is the record on disk — one construction, not two");
      else fail("the printed launch record and the one on disk disagree");
      const ledger = readFileSync(join(ws, ".shapeup/fanout/harness-run.md"), "utf8");
      if (new RegExp(`max_rounds: ${rec.budgets.maxRounds}\\b`).test(ledger) && new RegExp(`attempt_budget: ${rec.budgets.attemptBudget}\\b`).test(ledger) && /gate_answers: ci/.test(ledger)) ok("the ledger's dials and the record's come from the same argv: rounds, attempts and the answer set agree");
      else fail("the run ledger and the launch record disagree about the dials");
      if (!("wallClockS" in (rec.budgets || {}))) ok("the record carries no wallClockS — the deadline breaker reads the receipt, and a third field nothing reads stays removed");
      else fail("the record carries budgets.wallClockS");

      // (d) Defaults, from the same single resolution: no flags names sonnet for exec and eval, qa follows exec.
      const plain = kernel(ROOT, ws, "init", "run", "--slug", "plain", "--intake-text", "defaults", "--cwd", ws);
      const prec = plain.status === 0 ? recordOf("plain") : null;
      if (prec && prec.models.exec === "sonnet" && prec.models.eval === "sonnet" && prec.models.qa === "sonnet" && prec.budgets.maxRounds === 3 && prec.budgets.attemptBudget === 5 && !("maxParallelScopes" in prec)) {
        ok("a launch with no switches records sonnet for every role, 3 rounds, 5 attempts, and no invented dial");
      } else fail(`defaults are wrong: ${plain.status} ${JSON.stringify(prec)}`);
      const envd = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "init", "run", "--slug", "envd", "--intake-text", "env", "--cwd", ws],
        { cwd: ws, encoding: "utf8", env: { ...process.env, SHAPEUP_EXEC_MODEL: "claude-opus-5" } });
      if (envd.status === 0 && recordOf("envd").models.exec === "claude-opus-5" && recordOf("envd").models.qa === "claude-opus-5") ok("SHAPEUP_EXEC_MODEL names the exec model when no flag does, and qa follows it");
      else fail(`the environment knob was not read: exit ${envd.status} ${envd.stderr.slice(0, 200)}`);
      const envLow = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "init", "run", "--slug", "env-low", "--intake-text", "env", "--cwd", ws],
        { cwd: ws, encoding: "utf8", env: { ...process.env, SHAPEUP_EXEC_MODEL: "haiku" } });
      if (envLow.status === 2) ok("the floor applies to a model taken from the environment too");
      else fail(`a below-floor model from the environment opened a run: exit ${envLow.status}`);

      // (e) An already-open run keeps the record it was launched with; switches typed to the refusal are not applied.
      const before = readFileSync(join(ws, ".shapeup/fanout/run-args.json"), "utf8");
      const again = kernel(ROOT, ws, "init", "run", "--slug", "fanout", "--intake-text", "again", "--exec-model", "opus", "--no-eval", "--cwd", ws);
      const after = readFileSync(join(ws, ".shapeup/fanout/run-args.json"), "utf8");
      if (again.status === 3 && before === after && /LAUNCH RECORD \(kept/.test(again.stderr)) ok("exit 3 over an open run leaves the record byte-for-byte as it was, and says the typed switches were not applied");
      else fail(`an already-open run's record changed or the refusal did not say so: exit ${again.status}`);
      const forced = kernel(ROOT, ws, "init", "run", "--slug", "fanout", "--intake-text", "again", "--exec-model", "claude-opus-5", "--no-eval", "--force", "--cwd", ws);
      if (forced.status === 0 && recordOf("fanout").noEval === true && recordOf("fanout").models.exec === "claude-opus-5") ok("--force re-opens with the new switches: the record is written fresh with the new receipt");
      else fail(`--force did not rewrite the record: exit ${forced.status} ${forced.stderr.slice(0, 200)}`);
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }

  // Section 99 retired with the concurrency probe that carried it. It asserted that a run with no launch
  // record is caught by the probe's Preflight flag; the loop that drives a run asserts it now, as the
  // `probe next` row that aborts at preflight over a missing record.

  // =============================================================================
  section("100. The auto levels a launch accepts are the schema's — two lists, one set");
  // =============================================================================
  {
    const schema = JSON.parse(read(join(ROOT, "kernel/schemas/domain.schema.json")));
    const schemaLevels = schema?.$defs?.RunArgs?.properties?.autoLevel?.enum;
    const { AUTO_LEVELS } = await import(join(ROOT, "kernel/lib/floor.mjs"));
    if (Array.isArray(schemaLevels) && JSON.stringify([...AUTO_LEVELS].sort()) === JSON.stringify([...schemaLevels].sort())) {
      ok(`the launch's auto-level list (${AUTO_LEVELS.join(", ")}) is exactly domain.schema.json's RunArgs.autoLevel enum`);
    } else {
      fail(`the launch's auto levels ${JSON.stringify(AUTO_LEVELS)} disagree with the schema's ${JSON.stringify(schemaLevels)}`);
    }
    const runSrc = read(join(ROOT, "kernel/init/run.mjs"));
    if (!/new Set\(\s*\[\s*["']interactive["']/.test(runSrc)) ok("init run carries no second hand-typed auto-level list — it takes the one the launch check reads");
    else fail("init run hand-types its own auto-level Set beside the one in kernel/lib/floor.mjs");
    const ws = mkdtempSync(join(tmpdir(), "launch-level-"));
    try {
      const bad = kernel(ROOT, ws, "init", "run", "--slug", "x", "--intake-text", "x", "--auto-level", "supervised", "--cwd", ws);
      if (bad.status === 2) ok("an auto level outside the set is refused (exit 2)");
      else fail(`an unknown auto level opened a run: exit ${bad.status}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }
}
