// Structural test module: the gauntlet — the probes this architecture's comments used to describe.
//
// Every one of these was, at some point, a paragraph in a source file saying "the kill/resume probe
// found…" or "a measured run re-dispatched thirteen times". A narrated probe is not a probe: it
// proves something about a tree that no longer exists, and it goes on reading as evidence long
// after the code it describes has changed. These run.
//
// FOUR OF THE SIX RUN HERE, and they are the four whose mechanism is deterministic:
//   G1 kill/resume        — a run killed mid-BUILD re-dispatches nothing already finished
//   G3 parallel safety    — concurrent reducers cannot lose an update to shared state
//   G4 dead worker        — a lost build leg is a spent attempt, never a dead run
//   G5 gate refusal       — a headless lane with no answer aborts, and never proceeds quietly
//
// TWO REQUIRE A LIVE RUN and are deliberately NOT asserted here, because a check that cannot fail
// is worse than a missing one:
//   G2 headless, zero prompts — the GRANT half is proven by execution in `npm run test:grant`
//                               (nine real CLI sessions); the "a full unattended run completes"
//                               half needs a real feature, a real model and real money.
//   G6 baseline comparison    — cost and wall-clock against a v1 fixture needs two live runs.
// Both are named in tests/README.md as Tier-1 work with their status stated, rather than left to
// look like coverage this file has.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync, spawn } from "node:child_process";

const SLUG = "gauntlet";

/**
 * Run one kernel subcommand.
 * @param {string} ROOT - Repo root.
 * @param {string[]} argv - Verb words and flags.
 * @param {string} cwd - Workspace to run in.
 * @returns {{status:number, stdout:string, stderr:string}} The spawn result.
 */
function kernel(ROOT, argv, cwd) {
  const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...argv], {
    cwd, encoding: "utf8", timeout: 60_000,
  });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

/**
 * Run the gauntlet.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("21. The gauntlet — kill/resume, parallel safety, a dead worker, a refused gate");
  // =============================================================================

  // ---------------------------------------------------------------------------------------------
  // G1 — KILL/RESUME. A session killed mid-BUILD must resume where it died, and must re-dispatch
  // nothing that finished. The failure this is written against is specific and was measured: the
  // ORIENT skip once read the ledger's stored `status` instead of its own artifacts, so a completed
  // phase was re-dispatched on every relaunch while the artifact sat on disk the whole time.
  // ---------------------------------------------------------------------------------------------
  {
    const ws = mkdtempSync(join(tmpdir(), "gauntlet-resume-"));
    try {
      spawnSync("git", ["init", "-q"], { cwd: ws });
      const local = join(ws, ".shapeup", SLUG);
      const shared = join(ws, "shapeup", SLUG);
      mkdirSync(join(local, "orient"), { recursive: true });
      mkdirSync(join(local, "t0", "verdicts"), { recursive: true });
      mkdirSync(join(shared, "spec", "usecases"), { recursive: true });
      mkdirSync(join(shared, "scopes"), { recursive: true });

      writeFileSync(join(local, "receipt.json"), JSON.stringify({
        schema_version: 1, slug: SLUG, started_at: "2026-08-14T10:00:00.000Z", intake_sha256: "abc",
      }));
      // A run killed DURING round 1: orient/analyze/wire/map-scopes all landed, scope A went green,
      // scope B never did. The ledger still says "orienting" — the stale value a killed session
      // leaves, and the exact trap the artifact-first derivation exists to survive.
      writeFileSync(join(local, "harness-run.md"), "---\nstatus: orienting\nrounds_used: 1\n---\n\n# run\n");
      // The names the derivation actually requires, imported rather than guessed.
      const { ORIENT_REQUIRED } = await import(join(ROOT, "kernel/probe/resume.mjs"));
      for (const f of [...ORIENT_REQUIRED, "spike-cart.md"]) writeFileSync(join(local, "orient", f), "# orient\n");
      writeFileSync(join(shared, "spec", "usecases", "UC-01.md"), "# UC-01\n");
      writeFileSync(join(shared, "spec", "domain-model.md"), "# domain\n");
      writeFileSync(join(shared, "wiring-map.md"), "---\nschema_version: 1\n---\n\n# wiring\n");
      for (const id of ["sc-a", "sc-b"]) {
        writeFileSync(join(shared, "scopes", `${id}.md`),
          `---\nschema_version: 1\nscope_id: ${id}\ntitle: ${id}\n---\n\n# ${id}\n`);
      }
      writeFileSync(join(local, "t0", "verdicts", "r1-a1-t1.json"), JSON.stringify({
        scope_id: "sc-a", round: 1, attempt: 1, overall: "green", regression: false,
      }));

      // (a) the fast-forward reads ARTIFACTS, so a stale ledger cannot re-open a finished phase.
      const resume = kernel(ROOT, ["probe", "resume", "--slug", SLUG, "--cwd", ws], ws);
      let state = null;
      try { state = JSON.parse(resume.stdout); } catch { /* asserted below */ }
      if (state?.has_orient_artifacts === true && state?.next_phase === "build") {
        ok("G1: a run killed mid-BUILD resumes at build — the stale ledger status does not re-open ORIENT");
      } else {
        fail(`G1: the fast-forward resumed at "${state?.next_phase}" over a complete upstream tree — a relaunch would re-dispatch finished phases`);
      }
      for (const phase of ["orient", "analyze", "wire", "map-scopes"]) {
        const req = kernel(ROOT, ["probe", "resume", "--slug", SLUG, "--cwd", ws, "--require", phase], ws);
        if (req.status === 0) ok(`G1: --require ${phase} passes, so the relaunch skips it`);
        else fail(`G1: --require ${phase} failed over an artifact that is on disk — the phase would be re-dispatched`);
      }

      // (b) the round's own resume: scope A is green in the graph, so the round skips it; scope B
      //     is not, so it is still work. One bounded query answers for every scope.
      const graph = kernel(ROOT, ["reduce", "graph", "--slug", SLUG, "--cwd", ws, "--subgraph", "run"], ws);
      let sub = null;
      try { sub = JSON.parse(graph.stdout); } catch { /* asserted below */ }
      const greenR1 = sub?.green_scopes_by_round?.["1"] || [];
      if (greenR1.includes("sc-a") && !greenR1.includes("sc-b")) {
        ok("G1: the round resumes with sc-a green and sc-b outstanding — the killed round re-attempts only what it must");
      } else {
        fail(`G1: the graph reports round 1 green scopes as ${JSON.stringify(greenR1)} — a relaunch would either re-build finished work or skip unfinished work`);
      }

      // (c) and the per-scope probe agrees with the graph. Two readings that can disagree about
      //     "is this scope done" is the defect class, not a safeguard against it.
      const a = kernel(ROOT, ["probe", "t0", "--slug", SLUG, "--cwd", ws, "--scope", "sc-a", "--round", "1"], ws);
      const b = kernel(ROOT, ["probe", "t0", "--slug", SLUG, "--cwd", ws, "--scope", "sc-b", "--round", "1"], ws);
      if (a.status === 0 && b.status === 1) ok("G1: probe t0 and the graph agree on which scope is green (exit 0 vs 1)");
      else fail(`G1: probe t0 disagrees with the graph — sc-a exit ${a.status} (want 0), sc-b exit ${b.status} (want 1)`);
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // G3 — PARALLEL SAFETY. This probe found a real defect the moment it was first run: three
  // concurrent reducers over three different tasks left all three TASK files `done` and the BOARD
  // showing two. The middle write read the index before the first had written it and overwrote it.
  // The single-writer rule was true of the code and false of the process the moment there were two
  // processes, which is exactly what fanning the scopes out created.
  // ---------------------------------------------------------------------------------------------
  {
    const ws = mkdtempSync(join(tmpdir(), "gauntlet-par-"));
    try {
      spawnSync("git", ["init", "-q"], { cwd: ws });
      const tasks = join(ws, ".shapeup", SLUG, "tasks");
      const results = join(ws, ".shapeup", SLUG, "results");
      mkdirSync(tasks, { recursive: true });
      mkdirSync(results, { recursive: true });
      writeFileSync(join(ws, ".shapeup", SLUG, "receipt.json"), JSON.stringify({ schema_version: 1, slug: SLUG }));

      const IDS = ["TASK-001", "TASK-002", "TASK-003"];
      for (const id of IDS) {
        writeFileSync(join(tasks, `${id}.md`), `---\nid: ${id}\nstatus: ready\n---\n# ${id}\n\n- [ ] AC1 does the thing\n`);
        writeFileSync(join(results, `${id}.json`), JSON.stringify({
          schema_version: 1, order_id: `${SLUG}/${id}`, worker: "task-executor", status: "done",
          task_results: [{ task_id: id, status: "done", ac_results: [{ ac: "AC1 does the thing", result: "pass" }] }],
        }));
      }
      writeFileSync(join(tasks, "_index.md"),
        `# Board — ${SLUG}\n\n| Task | Scope | Status |\n|---|---|---|\n` +
        IDS.map((id) => `| ${id} | s | ready |`).join("\n") + "\n");

      // Genuinely concurrent: three processes started before any has finished.
      await Promise.all(IDS.map((id) => new Promise((res) => {
        const p = spawn(process.execPath,
          [join(ROOT, "kernel/harness.mjs"), "reduce", "ingest", join(results, `${id}.json`), "--cwd", ws],
          { cwd: ws, stdio: "ignore" });
        p.on("close", res);
        p.on("error", res);
      })));

      const board = readFileSync(join(tasks, "_index.md"), "utf8");
      const missed = IDS.filter((id) => !new RegExp(`\\|\\s*${id}\\s*\\|[^|]*\\|\\s*done\\s*\\|`).test(board));
      if (missed.length === 0) {
        ok("G3: three concurrent reducers all reach the board — no lost update to shared state");
      } else {
        fail(`G3: the board is missing ${missed.join(", ")} after three concurrent ingests — a read-modify-write was lost, and the board now disagrees with its own task files`);
      }
      const staleTasks = IDS.filter((id) => !/status:\s*done/.test(readFileSync(join(tasks, `${id}.md`), "utf8")));
      if (staleTasks.length === 0) ok("G3: every task file records its own completion");
      else fail(`G3: ${staleTasks.join(", ")} did not reach status done`);

      // The graph is a projection, so it must agree with what the reducer wrote.
      kernel(ROOT, ["reduce", "graph", "--slug", SLUG, "--cwd", ws], ws);
      const sub = JSON.parse(kernel(ROOT, ["reduce", "graph", "--slug", SLUG, "--cwd", ws, "--subgraph", "run"], ws).stdout);
      if (sub.pending_orders.length === 0) ok("G3: the graph reports no pending orders — board, results and graph agree after the fan-out");
      else fail(`G3: the graph still reports ${sub.pending_orders.join(", ")} pending after every result was ingested`);

      // The lock releases. A reducer that crashed holding it would wedge every later one.
      if (!existsSync(join(ws, ".shapeup", SLUG, ".ingest.lock"))) ok("G3: the ingest lock is released, not leaked");
      else fail("G3: the ingest lock is still on disk — the next reducer would wait 30 s and then refuse");
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // G4 — DEAD WORKER. A build leg whose sub-agent is skipped, blocked or dies returns `null` from
  // the runtime. That must cost the scope its attempt, not the run its life: killing the round here
  // would discard every other scope's green work, and `status: "failed"` is not a member of the
  // RunReturn union, so an unhandled null crashes into a shape the tech lead cannot branch on.
  //
  // A Workflow script cannot be imported, so this is a source assertion — narrow on purpose.
  // ---------------------------------------------------------------------------------------------
  {
    const wf = join(ROOT, "skills/tech-lead/workflows/shapeup-run.js");
    const src = existsSync(wf) ? readFileSync(wf, "utf8") : "";
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

    if (/__failed/.test(code) && /nullFail/.test(code)) ok("G4: a null sub-agent return is converted into a named failure, never left to crash");
    else fail("G4: shapeup-run.js has no marker for a dead sub-agent — a null return would surface as an unhandled shape");

    // The build leg's own branch: a dead builder goes to the hammer census and the loop continues.
    const buildArm = /res\.__failed[\s\S]{0,400}?roundHammer\.push/.test(code);
    if (buildArm) ok("G4: a dead build leg is pushed to the GATE H census and the round continues — a spent attempt, not a dead run");
    else fail("G4: a dead build leg does not route to the hammer census — the round either aborts or silently drops the scope");

    // And the contrast: a dead PHASE worker DOES abort, because there is nothing to continue with.
    if (/diedAt\("ORIENT"/.test(code) && /diedAt\("ANALYZE"/.test(code)) {
      ok("G4: a dead phase worker aborts by name — the asymmetry with a build leg is deliberate and present");
    } else {
      fail("G4: a dead phase worker does not abort — a run would proceed past a phase whose worker never reported");
    }

    // QA is a level-up: losing its worker costs the findings, not the ship.
    if (/q\.__failed[\s\S]{0,200}?log\(/.test(code)) ok("G4: a dead QA worker logs and ships — QA is a level-up, not a gate");
    else fail("G4: a dead QA worker is not handled as a level-up — losing the hunt would stop a run that already passed EVAL");
  }

  // ---------------------------------------------------------------------------------------------
  // G5 — GATE REFUSAL. A headless lane that reaches a gate it has no answer for must ABORT. The
  // failure it guards is the one that reads like success: proceeding quietly, and shipping a run
  // no human ever signed off.
  // ---------------------------------------------------------------------------------------------
  {
    const ws = mkdtempSync(join(tmpdir(), "gauntlet-gate-"));
    try {
      // An answer set that deliberately omits L4 and says what to do about that.
      const set = join(ws, "answers.json");
      writeFileSync(set, JSON.stringify({
        version: 1, preset: "custom", authorized_by: "gauntlet",
        on_missing: "abort",
        answers: { L1a: { decision: "proceed" } },
      }));

      const missing = kernel(ROOT, ["gate", "--resolve", "L4", "--file", set, "--cwd", ws], ws);
      if (missing.status === 5) ok("G5: a gate with no answer under on_missing:abort exits 5 — the run aborts rather than proceeding");
      else fail(`G5: an unanswered gate exited ${missing.status}, expected 5 — a headless run would proceed past a decision nobody made`);

      const present = kernel(ROOT, ["gate", "--resolve", "L1a", "--file", set, "--cwd", ws], ws);
      if (present.status === 0) ok("G5: an answered gate still crosses (exit 0) — the refusal discriminates");
      else fail(`G5: an answered gate exited ${present.status}, expected 0 — the gate refuses everything, which is not enforcement`);

      // The decision's SOURCE travels with it. A headless run that ships must be able to name the
      // human behind its sign-off, or the answer set is just a way to turn the gates off.
      let out = null;
      try { out = JSON.parse(present.stdout); } catch { /* asserted below */ }
      if (out?.source && /gauntlet|file:/.test(`${out.source}${out.authorized_by || ""}`)) {
        ok("G5: the crossing names its source — a headless sign-off is attributable, not anonymous");
      } else {
        fail(`G5: the gate crossed without naming a source: ${present.stdout.slice(0, 160)}`);
      }

      // And the preset lane, which is what `--unattended` actually uses.
      const ci = kernel(ROOT, ["gate", "--verify", "--preset", "ci", "--auto-level", "unattended", "--cwd", ws], ws);
      if (ci.status === 0) ok("G5: the ci preset verifies clean for an unattended lane — the headless path has answers for every required gate");
      else fail(`G5: the ci preset does not satisfy an unattended run (exit ${ci.status}) — the lane would abort at its first gate`);
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }
}
