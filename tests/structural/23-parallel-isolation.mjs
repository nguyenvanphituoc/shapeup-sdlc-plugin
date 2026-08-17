// Structural test module: what survives scopes building at the same time.
//
// Fan-out made every shared file in a run reachable by several processes at once, and the failure
// mode of that is not a crash — it is a run that finishes green over state that quietly disagrees
// with itself. Three shapes of write live under `.shapeup/<slug>/`, and only one of them is safe by
// construction:
//
//   PURE APPEND       — `receipts/dispatch.jsonl`, `decisions.jsonl`. One small `O_APPEND` write per
//                       row needs no lock and loses no history.
//   READ-MODIFY-WRITE — the board and the task files. Two reducers interleaving here is a lost
//                       update, which is why `reduce ingest` holds a per-run lock.
//   APPEND WHOSE ROW  — `t0/trials.jsonl`. The row is appended atomically and its `trial` field is
//   IS COMPUTED FROM    computed by reading the file first. That is a read-modify-write wearing an
//   THE FILE            append's clothing, and it was the one that broke.
//
// The last shape is the interesting one because nothing about it looks racy: the file is documented
// append-only, the append IS atomic, and the corruption lands in a FIELD rather than in the file's
// structure. Every line parses; the ordinals are just wrong. It surfaced only in the run graph,
// where two scopes' execution records collapsed onto one node because the node key was the ordinal.
//
// The deterministic sections are the ratchet: they fail on the defect without needing a race to fire.
// The racing sections are here because a static check cannot tell you that a lock works.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";

const SLUG = "parprobe";

/** Write a file, creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
  return p;
}

/** A minimal run trace: receipt, board, four tasks, discovery ledger. */
function plant(root) {
  w(root, `.shapeup/${SLUG}/receipt.json`, JSON.stringify({
    schema_version: 1, slug: SLUG, started_at: "2026-08-17T09:00:00.000Z", intake_sha256: "deadbeef",
  }));
  // The board format `reduce ingest` actually writes: it swaps ⬜ for ✅ and `ready` for `done`.
  w(root, `.shapeup/${SLUG}/tasks/_index.md`,
    "# Board\n\n| Task | State | Status |\n|---|---|---|\n" +
    [1, 2, 3, 4].map((n) => `| TASK-00${n} | ⬜ | ready |`).join("\n") + "\n");
  for (const n of [1, 2, 3, 4]) {
    w(root, `.shapeup/${SLUG}/tasks/TASK-00${n}-x.md`,
      `---\nid: TASK-00${n}\nstatus: ready\n---\n# TASK-00${n}\n\n## Acceptance Criteria\n- [ ] criterion ${n}\n`);
  }
  return root;
}

/**
 * Start every command at once and wait for all of them — the only way to observe a race.
 *
 * Each result carries the interval the process was actually alive for, because a concurrency probe
 * that does not measure overlap is satisfied by processes that ran one after another. That is the
 * same false green as counting only successes and calling it parallelism: the assertions pass, and
 * they passed over a sequential execution.
 */
function race(argvs, cwd) {
  return Promise.all(argvs.map((args) => new Promise((res) => {
    const startedAt = Date.now();
    const p = spawn("node", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", (code) => res({ code, out, err, startedAt, endedAt: Date.now() }));
  })));
}

/**
 * The greatest number of the given intervals that were open at the same instant.
 * @param {Array<{startedAt:number, endedAt:number}>} rows - Observed process lifetimes.
 * @returns {number} Peak overlap; 1 means nothing ever ran beside anything else.
 */
function maxConcurrent(rows) {
  const events = [];
  for (const r of rows) { events.push([r.startedAt, 1], [r.endedAt, -1]); }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, peak = 0;
  for (const [, d] of events) { cur += d; peak = Math.max(peak, cur); }
  return peak;
}

const lines = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter((l) => l.trim()) : []);

/**
 * Run the parallel-safety and isolation checks.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section bodies finish.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");

  // =============================================================================
  section("63. Shared run state survives scopes building at the same time");
  // =============================================================================

  // --- (a) DETERMINISTIC: a trial ordinal is counted within its scope, never across the file ----
  // The defect this pins: `readTrials(path).length + 1` counts every row in the run, so concurrent
  // scopes read the same length and mint the same ordinal. Planting another scope's rows is enough
  // to catch it with no race at all — the ordinal simply must not move when a NEIGHBOUR appends.
  {
    const ws = mkdtempSync(join(tmpdir(), "struct-par-a-"));
    try {
      plant(ws);
      w(ws, `shapeup/${SLUG}/scopes/SC-A.json`, JSON.stringify({
        schema_version: 1, scope_id: "SC-A", title: "a",
        substrate: { allowed: ["src/a/**"] }, e2e_verification_fixtures: ["node -e \"\""],
      }));
      // Three rows already on disk, only ONE of them SC-A's.
      w(ws, `.shapeup/${SLUG}/t0/trials.jsonl`, [
        { schema_version: 1, trial: 1, round: 1, attempt: 1, scope_id: "SC-A", status: "kept", score: {}, baseline_trial: null },
        { schema_version: 1, trial: 1, round: 1, attempt: 1, scope_id: "SC-B", status: "kept", score: {}, baseline_trial: null },
        { schema_version: 1, trial: 2, round: 1, attempt: 1, scope_id: "SC-C", status: "kept", score: {}, baseline_trial: null },
      ].map((r) => JSON.stringify(r)).join("\n") + "\n");

      const r = spawnSync("node", [KERNEL, "verify", "t0", join(ws, `shapeup/${SLUG}/scopes/SC-A.json`),
        "--round", "1", "--attempt", "2", "--cwd", ws, "--out", join(ws, ".shapeup", SLUG),
        "--no-seesaw", "--no-ratchet"], { cwd: ws, encoding: "utf8" });
      const rows = lines(join(ws, `.shapeup/${SLUG}/t0/trials.jsonl`)).map((l) => JSON.parse(l));
      const mine = rows.filter((t) => t.scope_id === "SC-A");
      const fresh = mine[mine.length - 1];
      if (r.status === 0 || r.status === 1) {
        if (fresh && fresh.trial === 2) ok("a trial ordinal counts the scope's OWN prior trials (2nd trial of SC-A is 2, with 2 neighbours on disk)");
        else fail(`SC-A's 2nd trial was numbered ${fresh?.trial} — the ordinal is counted across the whole file, so concurrent scopes mint colliding ordinals`);
        // And the parent link has to stay inside the scope it belongs to.
        if (fresh && fresh.baseline_trial === 1) ok("`baseline_trial` points at the same scope's previous trial");
        else fail(`baseline_trial is ${fresh?.baseline_trial} — the ratchet's parent link left its own scope`);
      } else fail(`verify t0 exited ${r.status} on a planted contract: ${(r.stderr || "").slice(0, 200)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (b) DETERMINISTIC: the run graph keeps two scopes' trials apart --------------------------
  // The consequence that made the ordinal race matter. A trial node keyed by the ordinal alone
  // collapses every scope's Nth trial onto one node, and the graph is read back into a Map — so the
  // last writer wins and a scope's whole execution record disappears without an error.
  {
    const ws = mkdtempSync(join(tmpdir(), "struct-par-b-"));
    try {
      plant(ws);
      w(ws, `.shapeup/${SLUG}/t0/trials.jsonl`, [
        { schema_version: 1, trial: 1, round: 1, attempt: 1, scope_id: "SC-A", status: "kept", artifact: "t0/verdicts/r1-a1-t1.json", baseline_trial: null },
        { schema_version: 1, trial: 1, round: 1, attempt: 1, scope_id: "SC-B", status: "kept", artifact: "t0/verdicts/r1-a1-t2.json", baseline_trial: null },
        { schema_version: 1, trial: 2, round: 1, attempt: 2, scope_id: "SC-A", status: "kept", artifact: "t0/verdicts/r1-a2-t1.json", baseline_trial: 1 },
      ].map((r) => JSON.stringify(r)).join("\n") + "\n");

      const { appendGraph, readGraph } = await import(`file://${join(ROOT, "kernel/reduce/graph.mjs")}`);
      appendGraph(ws, SLUG);
      const g = readGraph(ws, SLUG);
      const trialNodes = [...g.nodes.values()].filter((n) => n.t === "Trial");
      if (trialNodes.length === 3) ok("three trial rows over two scopes project to three distinct graph nodes");
      else fail(`3 trial rows projected to ${trialNodes.length} node(s) — scopes sharing an ordinal collapse onto one node and an execution record is lost`);

      const scopes = new Set(trialNodes.map((n) => n.scope_id));
      if (scopes.size === 2) ok(`both scopes survive the projection (${[...scopes].sort().join(", ")})`);
      else fail(`the graph kept trials for scope(s) [${[...scopes]}] — a scope's execution record vanished`);

      // The parent link must resolve, and must resolve WITHIN its scope.
      const sup = [...g.edges.keys()].filter((k) => k.includes("|SUPERSEDES|"));
      const dangling = sup.filter((k) => !g.nodes.has(k.split("|")[2]));
      if (sup.length === 1 && dangling.length === 0) ok("the SUPERSEDES edge resolves to a real node in the same scope");
      else fail(`SUPERSEDES edges=${sup.length}, dangling=${dangling.length} — the ratchet lineage points at a node that is not there`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (c) RACING: four `verify t0` at once, and the trial identity has to stay unique ----------
  {
    const ws = mkdtempSync(join(tmpdir(), "struct-par-c-"));
    try {
      plant(ws);
      const ids = ["P-01", "P-02", "P-03", "P-04"];
      for (const id of ids) {
        w(ws, `shapeup/${SLUG}/scopes/${id}.json`, JSON.stringify({
          schema_version: 1, scope_id: id, title: id,
          substrate: { allowed: [`src/${id}/**`] }, e2e_verification_fixtures: ["node -e \"\""],
        }));
      }
      const res = await race(ids.map((id) => [KERNEL, "verify", "t0", join(ws, `shapeup/${SLUG}/scopes/${id}.json`),
        "--round", "1", "--attempt", "1", "--cwd", ws, "--out", join(ws, ".shapeup", SLUG),
        "--no-seesaw", "--no-ratchet"]), ws);
      const crashed = res.filter((r) => r.code !== 0 && r.code !== 1);
      if (crashed.length === 0) ok("four concurrent `verify t0` processes all completed");
      else fail(`${crashed.length}/4 concurrent verify t0 processes failed: ${crashed[0].err.slice(0, 200)}`);

      // THE PROBE HAS TO PROVE IT RACED. Every assertion below is satisfied by four processes that
      // ran one after another, so without this the whole arm can go green over a sequential run and
      // report that concurrency is safe on evidence that contains no concurrency.
      const peak = maxConcurrent(res);
      if (peak >= 2) ok(`the four verify-t0 processes really did overlap (peak ${peak} alive at once)`);
      else fail(`peak overlap was ${peak} — these processes ran sequentially, so nothing below tested concurrency at all`);

      const rows = lines(join(ws, `.shapeup/${SLUG}/t0/trials.jsonl`)).map((l) => JSON.parse(l));
      if (rows.length === 4) ok("every concurrent trial row reached the ledger — no append was lost");
      else fail(`${rows.length}/4 trial rows landed — a concurrent append was lost`);

      const keys = rows.map((r) => `${r.scope_id}#${r.trial}`);
      const dupes = [...new Set(keys.filter((v, i) => keys.indexOf(v) !== i))];
      if (dupes.length === 0) ok("no two trial rows share a (scope_id, trial) identity under concurrency");
      else fail(`colliding trial identities under concurrency: ${dupes.join(", ")} — the ratchet's parent link is ambiguous`);

      // THE SHARP ONE. Every scope here is fresh, so every scope's FIRST trial must be numbered 1.
      // A cross-scope counter numbers them by arrival — [1,1,1,4] — and each of those rows still
      // carries a distinct `scope_id`, so a uniqueness check on (scope_id, trial) is satisfied by
      // the defect and proves nothing. The ordinal's own value is what carries the evidence.
      const misnumbered = rows.filter((r) => r.trial !== 1).map((r) => `${r.scope_id}=${r.trial}`);
      if (misnumbered.length === 0) ok("each concurrent scope's first trial is numbered 1 — the ordinal counts within the scope, not across the file");
      else fail(`first trials numbered ${misnumbered.join(", ")} under concurrency — the ordinal is a shared counter, so it is assigned by arrival order and two scopes can collide`);

      // The verdict artifacts are `wx`-guarded; concurrency must not cost one.
      const vdir = join(ws, `.shapeup/${SLUG}/t0/verdicts`);
      const verdicts = existsSync(vdir) ? readdirSync(vdir).filter((f) => f.endsWith(".json")) : [];
      if (verdicts.length === 4) ok("four distinct T0 verdict artifacts survive four concurrent writers (the `wx` address holds)");
      else fail(`${verdicts.length}/4 verdict artifacts on disk — concurrent writers clobbered the artifact the evaluator must cite`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (d) RACING: four `reduce ingest` at once, and the board must agree with its task files ----
  // The single-writer invariant is a claim about the CODE; with four legs finishing together it is a
  // claim about the PROCESS, and only the lock makes the two the same. This is the D2 probe.
  {
    const ws = mkdtempSync(join(tmpdir(), "struct-par-d-"));
    try {
      plant(ws);
      for (let k = 1; k <= 4; k++) {
        const oid = `${SLUG}/SC-0${k}`;           // ingest reads the slug off the order_id
        w(ws, `.shapeup/${SLUG}/orders/w${k}.json`, JSON.stringify({
          schema_version: 1, order_id: oid, slug: SLUG, worker: "task-executor",
          operation: "execute", compiled_at: "2026-08-17T09:00:00.000Z",
          substrate: { allowed: ["src/**"] },
        }));
        w(ws, `.shapeup/${SLUG}/results/w${k}.json`, JSON.stringify({
          schema_version: 1, order_id: oid, worker: "task-executor", status: "done",
          task_results: [{ task_id: `TASK-00${k}`, status: "done",
            ac_results: [{ ac: `criterion ${k}`, result: "pass", evidence: "probe" }] }],
          discoveries: [{ marker: "+", line: `discovered by writer ${k}` }],
        }));
      }
      const res = await race([1, 2, 3, 4].map((k) =>
        [KERNEL, "reduce", "ingest", "--order", join(ws, `.shapeup/${SLUG}/orders/w${k}.json`),
          "--cwd", ws, "--no-receipt-check"]), ws);
      const failed = res.filter((r) => r.code !== 0);
      if (failed.length === 0) ok("four concurrent `reduce ingest` processes all completed");
      else fail(`${failed.length}/4 concurrent ingests failed — the run lock refuses work it should serialise: ${failed[0].err.slice(0, 200)}`);

      const peakIngest = maxConcurrent(res);
      if (peakIngest >= 2) ok(`the four ingest processes really did overlap (peak ${peakIngest} alive at once)`);
      else fail(`peak overlap was ${peakIngest} — the ingests ran sequentially, so the board/ledger result below says nothing about contention`);

      const board = readFileSync(join(ws, `.shapeup/${SLUG}/tasks/_index.md`), "utf8");
      const stale = [];
      for (let k = 1; k <= 4; k++) {
        const id = `TASK-00${k}`;
        const body = readFileSync(join(ws, `.shapeup/${SLUG}/tasks/${id}-x.md`), "utf8");
        if (!/^status:\s*done/m.test(body)) continue;
        const row = board.split("\n").find((l) => l.includes(id));
        if (!row || !row.includes("✅")) stale.push(id);
      }
      if (stale.length === 0) ok("after four concurrent ingests the board agrees with every task file it describes");
      else fail(`board rows still unticked for done task(s) ${stale.join(", ")} — a concurrent read-modify-write lost an update`);

      const ledger = readFileSync(join(ws, `.shapeup/${SLUG}/discovery/ledger.md`), "utf8");
      const sections = (ledger.match(/^## Discovered — /gm) || []).length;
      if (sections === 4) ok("every concurrent writer's discovery section reached the ledger");
      else fail(`${sections}/4 discovery sections in the ledger — a concurrent append was lost`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (e) DETERMINISTIC: the ingest lock is really taken --------------------------------------
  // (d) above only catches a missing lock when the race actually fires, and measured with the lock
  // deliberately removed it fired 1 run in 5 — a guard that green-lights the defect 80% of the time
  // is not a guard. So the property is pinned directly instead: hold the lock from outside and the
  // reducer must WAIT. An unlocked reducer finishes immediately, which is the observable difference.
  {
    const ws = mkdtempSync(join(tmpdir(), "struct-par-e-"));
    try {
      plant(ws);
      const oid = `${SLUG}/solo`;
      w(ws, `.shapeup/${SLUG}/orders/solo.json`, JSON.stringify({
        schema_version: 1, order_id: oid, slug: SLUG, worker: "task-executor",
        operation: "execute", compiled_at: "2026-08-17T09:00:00.000Z", substrate: { allowed: ["src/**"] },
      }));
      w(ws, `.shapeup/${SLUG}/results/solo.json`, JSON.stringify({
        schema_version: 1, order_id: oid, worker: "task-executor", status: "done",
        task_results: [{ task_id: "TASK-001", status: "done", ac_results: [] }],
      }));
      // Take the lock the reducer uses, with a fresh mtime so it is not treated as stale.
      const lock = join(ws, ".shapeup", SLUG, ".ingest.lock");
      mkdirSync(lock, { recursive: true });

      const started = Date.now();
      const proc = spawn("node", [KERNEL, "reduce", "ingest", "--order",
        join(ws, `.shapeup/${SLUG}/orders/solo.json`), "--cwd", ws, "--no-receipt-check"],
        { cwd: ws, stdio: ["ignore", "pipe", "pipe"] });
      let done = false, code = null;
      proc.on("close", (c) => { done = true; code = c; });
      await new Promise((r) => setTimeout(r, 400));

      if (!done) ok("a second reducer BLOCKS while the run's ingest lock is held — shared-state writes are serialised, not merely intended to be");
      else fail(`the reducer completed in ${Date.now() - started}ms while the ingest lock was held (exit ${code}) — it takes no lock, so two legs finishing together interleave a read-modify-write`);

      rmSync(lock, { recursive: true, force: true });
      await new Promise((r) => { proc.on("close", r); if (done) r(); });
      if (code === 0) ok("and it proceeds once the lock is released — the wait is a wait, not a deadlock");
      else fail(`the reducer exited ${code} after the lock was released — a released lock must let the waiter through`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (e2) A stale lock is broken only when its OWNER is gone ---------------------------------
  // The lock breaks a holding lock after 30s so a crashed reducer cannot wedge the run forever. But
  // `mkdir` stamps the mtime once and the critical section is synchronous, so a holder cannot
  // refresh it — which made "working for 31s" and "died 31s ago" the same observation, and a waiter
  // then entered the section beside a live holder. Age is not evidence of abandonment; liveness is.
  {
    const ws = mkdtempSync(join(tmpdir(), "struct-par-e2-"));
    try {
      plant(ws);
      const oid = `${SLUG}/solo`;
      w(ws, `.shapeup/${SLUG}/orders/solo.json`, JSON.stringify({
        schema_version: 1, order_id: oid, slug: SLUG, worker: "task-executor",
        operation: "execute", compiled_at: "2026-08-17T09:00:00.000Z", substrate: { allowed: ["src/**"] },
      }));
      w(ws, `.shapeup/${SLUG}/results/solo.json`, JSON.stringify({
        schema_version: 1, order_id: oid, worker: "task-executor", status: "done",
        task_results: [{ task_id: "TASK-001", status: "done", ac_results: [] }],
      }));
      const lock = join(ws, ".shapeup", SLUG, ".ingest.lock");
      const stale = new Date(Date.now() - 45_000);

      /** Start an ingest against a stale lock of the given ownership and see if it breaks in. */
      const raceStaleLock = async (ownerBody) => {
        rmSync(lock, { recursive: true, force: true });
        mkdirSync(lock, { recursive: true });
        if (ownerBody) writeFileSync(join(lock, "owner.json"), ownerBody);
        utimesSync(lock, stale, stale);
        const p = spawn("node", [KERNEL, "reduce", "ingest", "--order",
          join(ws, `.shapeup/${SLUG}/orders/solo.json`), "--cwd", ws, "--no-receipt-check"],
          { cwd: ws, stdio: ["ignore", "pipe", "pipe"] });
        let finished = false;
        p.on("close", () => { finished = true; });
        await new Promise((r) => setTimeout(r, 600));
        p.kill("SIGKILL");
        return finished;
      };

      // A live owner keeps its lock however old the stamp is.
      if (!(await raceStaleLock(JSON.stringify({ pid: process.pid, at: stale.toISOString() })))) {
        ok("a stale lock whose owner is STILL ALIVE is not broken — a slow reducer keeps the section to itself");
      } else fail("a waiter broke a stale lock held by a live process and entered the critical section beside it — two reducers write at once, which is the failure the lock exists to prevent");

      // A dead owner must not wedge the run — the stale break still has to work.
      if (await raceStaleLock(JSON.stringify({ pid: 999999, at: stale.toISOString() }))) {
        ok("a stale lock whose owner is GONE is still broken — a crashed reducer cannot wedge the run");
      } else fail("a stale lock left by a dead process was not broken — one crash wedges every later ingest");

      // Locks written before an owner was recorded keep the old age-only behaviour.
      if (await raceStaleLock(null)) ok("a stale lock with no recorded owner is broken, as before — an older lock file is not a deadlock");
      else fail("a stale ownerless lock was not broken — the compatibility path regressed into a wedge");
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (f) The T0 ratchet's revert cannot reach outside the scope that triggered it -------------
  // The one cross-scope write path no hook can see. `sandbox-guard` fences Edit/Write; the ratchet
  // reverts through a `git` subprocess, so an unbounded revert destroys a neighbour's work with
  // every control still green.
  {
    const ws = mkdtempSync(join(tmpdir(), "struct-par-f-"));
    try {
      const { snapshot, restore, isRepo } = await import(`file://${join(ROOT, "kernel/verify/ratchet-tree.mjs")}`);
      const g = (args) => spawnSync("git", args, { cwd: ws, encoding: "utf8" });
      g(["init", "-q", "-b", "main"]);
      g(["config", "user.email", "probe@example.invalid"]);
      g(["config", "user.name", "probe"]);
      mkdirSync(join(ws, "src", "a"), { recursive: true });
      mkdirSync(join(ws, "src", "b"), { recursive: true });
      writeFileSync(join(ws, "src", "a", "index.js"), "// A baseline\n");
      writeFileSync(join(ws, "src", "b", "index.js"), "// B baseline\n");
      g(["add", "-A"]);
      g(["commit", "-q", "-m", "baseline"]);

      if (!isRepo(ws)) {
        // An absence reported in the same value, never a silent skip.
        fail("git is unavailable in this environment, so the ratchet's revert bound could not be executed — this check proved nothing");
      } else {
        writeFileSync(join(ws, "src", "a", "index.js"), "// A attempt 1, kept\n");
        const snap = snapshot("SC-A", ws);
        if (snap.ok) ok("the ratchet takes a kept-tree snapshot for a scope");
        else fail(`snapshot failed: ${snap.reason}`);

        // Neighbour does its own work, then SC-A's next attempt goes red and reverts.
        writeFileSync(join(ws, "src", "b", "index.js"), "// B'S REAL WORK\n");
        writeFileSync(join(ws, "src", "a", "index.js"), "// A attempt 2, red\n");
        const rest = restore("SC-A", ws, ["src/a/**"]);

        if (rest.ok) ok("a bounded revert succeeds against the scope's own substrate");
        else fail(`bounded revert failed: ${rest.reason}`);
        if (readFileSync(join(ws, "src", "a", "index.js"), "utf8").includes("attempt 1")) ok("the reverting scope's own file is rolled back to its kept tree");
        else fail("the ratchet did not roll back the scope's own file — the revert is not reverting");
        if (readFileSync(join(ws, "src", "b", "index.js"), "utf8").includes("B'S REAL WORK")) ok("a neighbouring scope's work SURVIVES another scope's revert");
        else fail("one scope's revert destroyed a neighbouring scope's work — the ratchet rolls back the whole tree, and no hook can see it because it reverts through git");

        // And with nothing to bound it, it must refuse rather than roll the repo back.
        const unbounded = restore("SC-A", ws, []);
        if (!unbounded.ok && /pathspec|refus/i.test(unbounded.reason || "")) ok("with no substrate to bound it the revert REFUSES, instead of falling back to the whole repo");
        else fail(`an unbounded revert returned ${JSON.stringify(unbounded)} — the repo-wide fallback is still reachable`);
        if (readFileSync(join(ws, "src", "b", "index.js"), "utf8").includes("B'S REAL WORK")) ok("the refused revert changed nothing");
        else fail("the refused revert still rewrote the tree");
      }
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // --- (g) A `shared` path is legal for two scopes and unsafe for two scopes AT ONCE -----------
  // DISJOINT's escape hatch: an entry point both scopes declare `shared` passes the lint on purpose.
  // The permission is right and the concurrency is not, and nothing connected the two — so the fact
  // has to reach the scheduler as a finding rather than as a collision in the file.
  {
    const { lintScopes } = await import(`file://${join(ROOT, "kernel/verify/spec.mjs")}`);
    // Two layer directories each, so the PA1 directory-thinking rule is not what fires here.
    const repoFiles = ["bin/todo.js", "src/a/x.js", "src/b/x.js"];
    const scopes = [
      { scope_id: "SC-A", allowed_file_substrate: ["bin/todo.js", "src/a/x.js"], shared_substrate: ["bin/todo.js"], e2e_verification_fixtures: ["node --test"] },
      { scope_id: "SC-B", allowed_file_substrate: ["bin/todo.js", "src/b/x.js"], shared_substrate: ["bin/todo.js"], e2e_verification_fixtures: ["node --test"] },
    ];
    const found = lintScopes(scopes, repoFiles);
    const reds = found.filter((f) => f.rule === "DISJOINT");
    const warned = found.filter((f) => f.rule === "SHARED-CONCURRENT");
    if (reds.length === 0) ok("a path both scopes declare `shared` is NOT a disjointness failure — the escape hatch still opens");
    else fail("a properly declared shared path was reported as a disjointness violation — the escape hatch is welded shut");
    if (warned.length === 1 && warned[0].scope === "SC-A+SC-B") ok("...but it IS reported as SHARED-CONCURRENT, so the scheduler can keep the two scopes out of one wave");
    else fail(`a shared writable path produced ${warned.length} SHARED-CONCURRENT finding(s) — two scopes can be co-scheduled onto one file with nothing naming the hazard`);
    if (warned.every((f) => f.level === "warn")) ok("SHARED-CONCURRENT is advisory — it informs the scheduler without failing a legal contract");
    else fail("SHARED-CONCURRENT is red, which fails a contract the escape hatch explicitly permits");

    // Scopes that share nothing must not be flagged, or the signal is noise.
    const clean = lintScopes([
      { scope_id: "SC-A", allowed_file_substrate: ["src/a/x.js", "bin/a.js"], shared_substrate: [], e2e_verification_fixtures: ["node --test"] },
      { scope_id: "SC-B", allowed_file_substrate: ["src/b/x.js", "bin/b.js"], shared_substrate: [], e2e_verification_fixtures: ["node --test"] },
    ], ["src/a/x.js", "src/b/x.js", "bin/a.js", "bin/b.js"]);
    if (clean.filter((f) => f.rule === "SHARED-CONCURRENT").length === 0) ok("scopes with no shared surface produce no co-scheduling finding");
    else fail("disjoint scopes were reported as sharing a writable path — the finding fires on everything and means nothing");
  }

  // =============================================================================
  section("64. The substrate wall is rooted at the cwd it is handed, and says which state it is in");
  // =============================================================================
  //
  // `sandbox-guard` resolves the order set from the cwd in its payload. Run a leg anywhere that has
  // no `.shapeup/` — a fresh git worktree is the case that matters, because a worktree carries the
  // COMMITTED tree and none of the gitignored run state — and the guard finds no pointer and defers.
  // That is the correct fail-open, and it is also indistinguishable from "no run is happening"
  // unless the decision row says which. This section pins the distinguishability, because that is
  // what makes running a leg outside the run root a detectable condition rather than a silent one.
  {
    const ws = mkdtempSync(join(tmpdir(), "struct-guard-"));
    try {
      const withRoot = join(ws, "withroot");
      const noRoot = join(ws, "noroot");          // the shape a fresh worktree has
      mkdirSync(join(noRoot, "src", "rules"), { recursive: true });
      writeFileSync(join(noRoot, "src", "rules", "index.js"), "// no run state here\n");
      plant(withRoot);
      mkdirSync(join(withRoot, "src", "rules"), { recursive: true });
      writeFileSync(join(withRoot, "src", "rules", "index.js"), "// outside the order's substrate\n");
      w(withRoot, `.shapeup/${SLUG}/orders/build.json`, JSON.stringify({
        schema_version: 1, order_id: `${SLUG}/build`, slug: SLUG, worker: "task-executor",
        operation: "execute", compiled_at: "2026-08-17T09:00:00.000Z",
        substrate: { allowed: ["src/parse/**"] },
      }));
      w(withRoot, ".shapeup/active-order", JSON.stringify({
        slug: SLUG, order_path: `.shapeup/${SLUG}/orders/build.json`,
      }));
      // Written so that step 2's DELETION is the discriminating act. Without it there, "delete the
      // pointer and the guard still works" is satisfied by a pointer that was never there.
      w(withRoot, ".shapeup/active-scope", JSON.stringify({ slug: SLUG }));

      // The runner redirects every decision row to one shared file so the suite does not litter.
      // This section is ABOUT those rows landing per-cwd, so it opts out for its own spawns —
      // the same way the hook-receipt module does.
      const env = { ...process.env };
      delete env.SHAPEUP_DECISIONS_PATH;
      const ask = (cwd, rel) => {
        const payload = JSON.stringify({ tool_name: "Edit", cwd, tool_input: { file_path: join(cwd, rel) } });
        const r = spawnSync("node", [GUARD], { encoding: "utf8", input: payload, env });
        return { denied: (r.stdout || "").includes('"permissionDecision":"deny"'), exit: r.status };
      };
      const rows = (cwd) => lines(join(cwd, ".shapeup", "decisions.jsonl")).map((l) => JSON.parse(l));

      // 1. With the run root under cwd, the wall is a wall.
      const a = ask(withRoot, "src/rules/index.js");
      if (a.denied) ok("with the run root under cwd, a write outside the order's substrate is DENIED");
      else fail("the sandbox guard permitted an out-of-substrate write with a live order on disk — the wall is not enforcing");

      // 2. The pointer this guard does NOT read: deleting `active-scope` must change nothing.
      //    The risk register said the guard reads it; it reads `active-order` and the live order set,
      //    and pinning that stops a future change from re-coupling them.
      rmSync(join(withRoot, ".shapeup", "active-scope"), { force: true });
      const b = ask(withRoot, "src/rules/index.js");
      if (b.denied) ok("the substrate wall is unaffected by the `active-scope` run pointer (it reads the live orders)");
      else fail("removing `active-scope` disarmed the sandbox guard — the substrate wall is coupled to the run pointer");

      // 3. Outside any run root the guard defers — fail-open, which is right — but the decision row
      //    must name that state, so "wall not present" is never read as "wall passed".
      const c = ask(noRoot, "src/rules/index.js");
      if (!c.denied) ok("outside a run root the guard fails OPEN — an ordinary edit is never blocked by a hook that has nothing to enforce");
      else fail("the sandbox guard denied a write in a tree with no run state — it fails closed, and ordinary editing breaks");

      const nr = rows(noRoot);
      const deferred = nr.find((r) => r.verdict === "allow" && r.rule === "no-round");
      if (deferred) ok("that fail-open is recorded as `no-round` — a leg running outside the run root is a detectable state, not a silent one");
      else fail(`no \`no-round\` decision row was written outside the run root (rows: ${JSON.stringify(nr.map((r) => r.rule))}) — an unenforced write is indistinguishable from an inspected one`);

      const wr = rows(withRoot);
      const permitted = wr.find((r) => r.verdict === "allow" && r.rule === "in-substrate");
      const denied = wr.find((r) => r.verdict === "deny");
      const inside = ask(withRoot, "src/parse/mod.js");
      const wr2 = rows(withRoot).find((r) => r.verdict === "allow" && r.rule === "in-substrate");
      if (wr2 && denied && !inside.denied) ok("`in-substrate` (inspected and permitted) and `no-round` (nothing to inspect) are different rows — the two allows are told apart");
      else fail("an inspected-and-permitted write is not distinguishable from a write nobody inspected — the enforcement layer cannot report its own coverage");
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }
}
