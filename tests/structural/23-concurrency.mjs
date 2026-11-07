// Structural test module: the leg-completion record, and whether a scope's work reached the board.
// Sections: 63, 68 (64 retired with the concurrency probe — see the note where it sat).
//
// THE DEFECT THIS MODULE EXISTS FOR. Fanning the scope loop out has three acceptance questions —
// did two scopes run at once, did shared state survive it, did wall-clock improve — and nothing in
// the repo could answer any of them from evidence. The one claim that WAS made ("3/3 legs green")
// came from a probe that counted green results, which three legs run strictly one after another
// satisfy exactly. A record set with a start and no end cannot tell the two apart.
//
// §63 THE RECORD. `reduce ingest` is the single writer of shared state and the step that closes a
//     leg, so it is where the end belongs. What is asserted here is not that a row appears — it is
//     that the row survives the three things that destroy records in this pipeline: a relaunch
//     re-using an order path, two rounds, and a leg that dies before it ingests. And that it
//     carries the RUN KEY: `order_id` alone repeats across every run of one slug, and the guard
//     that already existed for that property passed for the life of a branch while every real
//     trial row was unattributable — because it supplied its own fixture root and never executed
//     the writer against the root the shipped opener chooses. This one executes the CLI.
//
// §64 THE INSTRUMENT. The house rule the false-green audit produced is that a predicate an ABSENCE
//     can satisfy must report that absence in the same value. `max_concurrent: 1` over four legs
//     and one usable record reads identically to a genuinely sequential run. So: an incomplete
//     record set must not yield a confident number, a speedup that cannot be supported must be
//     refused rather than approximated, and the output must be byte-stable — an instrument whose
//     answer moves between two runs over one unchanged tree is measuring itself.
//
// §68 THE APPLICATION. The record turned out to answer a second question nobody had asked. A green
//     T0 says a scope's fixtures passed; it says nothing about whether its WorkResult was applied,
//     and the BUILD round's confirm stage asked only the first. On a live run one leg skipped its own
//     `reduce ingest` step, reported green, and was accepted — its task left `pending` with zero
//     acceptance criteria ticked while its code sat finished on disk. The leg ledger is what
//     distinguished it from its neighbour, because the row is written BY the writer and so cannot be
//     asserted by the leg that was supposed to run it.

import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** Read a JSONL ledger into rows. */
const rows = (p) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)) : []);

/**
 * Run the kernel in a workspace.
 * @param {string} ROOT - Repo root.
 * @param {string} ws - Workspace directory.
 * @param {...string} argv - Kernel arguments.
 * @returns {{status:number, stdout:string, stderr:string}} The spawn outcome.
 */
function kernel(ROOT, ws, ...argv) {
  const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...argv],
    { cwd: ws, encoding: "utf8", timeout: 60_000 });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

/**
 * Open a run, compile one order, attest it, and answer it — the shortest path that closes a leg.
 *
 * Everything is done through the shipped entry points so the run root is the one `init run` picked,
 * not one the test invented. That distinction is the whole reason the previous run-key guard could
 * pass over a writer that was stripping the key.
 *
 * @param {string} ROOT - Repo root.
 * @param {string} ws - Workspace directory.
 * @param {object} opts - `{slug, compileArgs, receipt}` — `receipt` false writes none.
 * @returns {{order:object, orderPath:string, ingest:object}} The order and the ingest outcome.
 */
function closeOneLeg(ROOT, ws, { slug, compileArgs, receipt = true, resultPatch = {} }) {
  const co = kernel(ROOT, ws, "compile", ...compileArgs, "--cwd", ws);
  if (co.status !== 0) return { error: `compile exited ${co.status}: ${co.stderr.slice(0, 300)}` };
  // `compile` prints the order path it wrote, and nothing else.
  const orderPath = co.stdout.trim().split("\n").pop();
  if (!orderPath || !existsSync(orderPath)) return { error: `compile wrote no order (stdout: ${co.stdout.slice(0, 200)})` };
  const order = JSON.parse(readFileSync(orderPath, "utf8"));
  const suffix = String(order.order_id).split("/").slice(1).join("/");

  if (receipt) {
    const rp = join(ws, ".shapeup", slug, "receipts", "dispatch.jsonl");
    mkdirSync(join(ws, ".shapeup", slug, "receipts"), { recursive: true });
    appendFileSync(rp, JSON.stringify({
      at: order.compiled_at, order_id: order.order_id, run_id: order.run_id,
      worker_declared: order.worker, skill_invoked: order.worker, dispatch_ok: true,
      tool: "Skill", agent_id: "a-test", agent_type: "workflow-subagent",
    }) + "\n");
  }

  mkdirSync(join(ws, ".shapeup", slug, "results"), { recursive: true });
  writeFileSync(join(ws, ".shapeup", slug, "results", `${suffix}.json`), JSON.stringify({
    schema_version: 1, order_id: order.order_id, worker: order.worker, status: "done",
    artifacts: [], task_results: [], discoveries: [], ...resultPatch,
  }));

  const ing = kernel(ROOT, ws, "reduce", "ingest", "--order", orderPath, "--cwd", ws);
  return { order, orderPath, ingest: ing };
}

/**
 * Write a scope contract so `compile --scope` produces a BUILD order.
 * @param {string} ws - Workspace directory.
 * @param {string} slug - Feature slug.
 * @param {string} id - Scope id.
 * @returns {string} The contract path.
 */
function scopeContract(ws, slug, id) {
  const dir = join(ws, "shapeup", slug, "scopes");
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${id}.md`);
  writeFileSync(p, [
    "---", `type: scope-contract`, `scope_id: ${id}`, `feature: ${slug}`,
    "topology_type: ICEBERG", "tasks:", "  - TASK-001",
    "allowed_file_substrate:", `  - src/${id}.js`,
    "e2e_verification_fixtures:", "  - node --test", "---", "", `# Scope ${id}`, "",
  ].join("\n"));
  return p;
}

/**
 * Run the leg-record checks.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when both section bodies finish.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  // =============================================================================
  section("63. A leg has an END, and the record of it survives a relaunch, a round and a death");
  // =============================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "legrec-"));
    try {
      const opened = kernel(ROOT, ws, "init", "run", "--slug", "legs",
        "--intake-text", "Add category budgets with a monthly rollover", "--auto-level", "unattended", "--cwd", ws);
      const receiptPath = join(ws, ".shapeup", "legs", "receipt.json");
      if (opened.status !== 0 || !existsSync(receiptPath)) {
        fail(`init run did not open a run in the sandbox: exit ${opened.status} ${opened.stderr.slice(0, 200)}`);
        return;
      }
      const runId = JSON.parse(readFileSync(receiptPath, "utf8")).run_id;
      const ledger = join(ws, ".shapeup", "legs", "legs.jsonl");

      // (a) The leg closes and leaves exactly one row.
      const first = closeOneLeg(ROOT, ws, { slug: "legs", compileArgs: ["--operation", "orient", "--slug", "legs"] });
      if (first.error) { fail(`could not close a leg: ${first.error}`); return; }
      if (first.ingest.status !== 0) { fail(`ingest exited ${first.ingest.status}: ${first.ingest.stderr.slice(0, 300)}`); return; }
      const after1 = rows(ledger);
      if (after1.length === 1) ok("reduce ingest appends exactly one leg-completion row when a leg closes");
      else fail(`expected 1 leg row after one ingest, found ${after1.length} at ${ledger}`);

      // (b) THE RUN KEY. The record set's only other join is order_id, which repeats across every
      //     run of one slug — a row without the key is unattributable the moment there are two.
      const row = after1[0] || {};
      if (row.run_id === runId) ok("the leg row carries the run key the shipped opener minted (not order_id alone)");
      else fail(`leg row run_id is "${row.run_id}", the run's receipt says "${runId}"`);

      // (c) …and it is RESOLVED, not merely copied. An order that lost the stamp must not produce
      //     an unkeyed row: the receipt on disk answers the question, and the writer must ask it.
      {
        const stripped = { ...first.order };
        delete stripped.run_id;
        writeFileSync(first.orderPath, JSON.stringify(stripped));
        const r = kernel(ROOT, ws, "reduce", "ingest", "--order", first.orderPath, "--cwd", ws, "--no-receipt-check");
        const last = rows(ledger).at(-1) || {};
        if (r.status === 0 && last.run_id === runId) ok("an order with no run_id still yields a keyed row — the key is resolved from the run receipt");
        else fail(`ingesting a run_id-less order produced run_id "${last.run_id}" (exit ${r.status})`);
        writeFileSync(first.orderPath, JSON.stringify(first.order));
      }

      // (d) A RELAUNCH RE-USES THE ORDER PATH. The ledger must gain a row rather than lose one, and
      //     each row must keep the compiled_at it SAW — an order file is rewritten in place, so a
      //     row that pointed at the file would silently re-date itself to a later dispatch.
      {
        const before = rows(ledger).length;
        const recompiled = { ...first.order, compiled_at: new Date(Date.parse(first.order.compiled_at) + 60_000).toISOString() };
        writeFileSync(first.orderPath, JSON.stringify(recompiled));
        const r = kernel(ROOT, ws, "reduce", "ingest", "--order", first.orderPath, "--cwd", ws, "--no-receipt-check");
        const all = rows(ledger);
        if (r.status === 0 && all.length === before + 1) ok("a re-dispatch over the same order path appends a row rather than replacing one");
        else fail(`re-ingesting the same order path left ${all.length} row(s), expected ${before + 1} (exit ${r.status})`);
        const stamps = new Set(all.filter((x) => x.order_id === first.order.order_id).map((x) => x.compiled_at));
        if (stamps.size >= 2) ok("each row keeps the compiled_at it saw — the later compile did not re-date the earlier row");
        else fail(`every row for ${first.order.order_id} carries the same compiled_at (${[...stamps].join(", ")}) — the snapshot is not a snapshot`);
      }

      // (e) TWO ROUNDS, and the round is on the row. A build order is addressed by scope/round/
      //     attempt; a leg row that dropped the round could not separate round 1 from round 2, which
      //     is the axis every fix-round measurement is taken along.
      {
        scopeContract(ws, "legs", "alpha");
        const r1 = closeOneLeg(ROOT, ws, { slug: "legs", compileArgs: ["--scope", join(ws, "shapeup", "legs", "scopes", "alpha.md"), "--round", "1", "--attempt", "1"] });
        const r2 = closeOneLeg(ROOT, ws, { slug: "legs", compileArgs: ["--scope", join(ws, "shapeup", "legs", "scopes", "alpha.md"), "--round", "2", "--attempt", "1"] });
        if (r1.error || r2.error) {
          fail(`could not close two build legs: ${r1.error || r2.error}`);
        } else {
          const build = rows(ledger).filter((x) => x.scope_id === "alpha");
          const byRound = new Map(build.map((b) => [b.round, b]));
          if (byRound.get(1) && byRound.get(2)) ok("two rounds of one scope produce two rows, each carrying its own round");
          else fail(`build rows do not separate the rounds: ${JSON.stringify(build.map((b) => [b.scope_id, b.round, b.attempt]))}`);
          const one = byRound.get(1);
          if (one && one.attempt === 1 && one.scope_id === "alpha") ok("a build leg row carries scope_id and attempt, derived from the order id");
          else fail(`build row address is ${JSON.stringify(one)}`);
          if (one && one.started_from === "dispatch-receipt" && one.dispatched_at) {
            ok("the leg's start is the hook-attested receipt, not the re-writable order file");
          } else fail(`leg start came from "${one?.started_from}" (dispatched_at=${one?.dispatched_at})`);
        }
      }

      // (f) A LEG THAT DIES LEAVES NO ROW — and that is the design, not a gap. The alternative is
      //     inventing an end for work that never finished, which is the shape of every false green
      //     in this repo's history.
      {
        const before = rows(ledger).length;
        scopeContract(ws, "legs", "beta");
        const co = kernel(ROOT, ws, "compile", "--scope", join(ws, "shapeup", "legs", "scopes", "beta.md"),
          "--round", "1", "--attempt", "1", "--cwd", ws);
        if (co.status !== 0) fail(`compile of the dying leg exited ${co.status}`);
        else if (rows(ledger).length === before) ok("a leg that was dispatched and never ingested leaves NO completion row — the hole is the record");
        else fail("a compiled-but-never-ingested leg produced a completion row");
      }

      // (g) The ledger resolves through lib/paths.mjs, like every other generated path — asserted
      //     BOTH ways, because either half alone is vacuous. A helper that exists proves nothing
      //     about a writer that ignores it, and a row landing in the right place proves nothing
      //     about how the writer got there: a root spelled at the call site produces exactly the
      //     same file until someone renames the root, which is the one moment it matters. Test #45
      //     enforces this over `hooks`, `bin` and `skills` and does not scan `kernel/`, so the two
      //     files this lane adds are checked here.
      const paths = await import(join(ROOT, "kernel/lib/paths.mjs"));
      if (typeof paths.legLedger === "function" && paths.legLedger(ws, "legs") === ledger) {
        ok("the leg ledger's path has one home in lib/paths.mjs, and it is where the row landed");
      } else fail("legLedger is not exported from lib/paths.mjs, or does not resolve to the written path");
      {
        // The two syntaxes #45 documents: a bare literal, and a `join()` chain a find/replace misses.
        const LITERAL = /(?<!["'`\w-])(?:docs\/)?\.?shapeup(?:-sdlc)?\//;
        const SEGMENTS = /join\([^)]*["'](?:docs|\.shapeup-sdlc|shapeup-sdlc|shapeup|\.shapeup)["']/;
        const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
        const offenders = [];
        for (const rel of ["kernel/reduce/ingest.mjs"]) {
          codeOnly(readFileSync(join(ROOT, rel), "utf8")).split("\n").forEach((line, i) => {
            if (LITERAL.test(line) || SEGMENTS.test(line)) offenders.push(`${rel}:${i + 1} ${line.trim().slice(0, 80)}`);
          });
        }
        if (!offenders.length) ok("the leg writer does not spell a storage root itself");
        else fail(`a storage root is spelled outside lib/paths.mjs:\n    ${offenders.join("\n    ")}`);
      }
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // Section 64 retired with the concurrency probe. It pinned that instrument's behaviour — an
  // incomplete record set reports its incompleteness beside the number, no usable leg yields null
  // rather than 0 or 1, the output is byte-stable over an unchanged tree, the fan-out width is read
  // back off the launch record, and the frozen baseline re-derives from the archived traces. All of
  // it was a property of `probe concurrency`, which is deleted; there is no instrument left for the
  // properties to hold of, so nothing survives to retarget. The record it read is still written and
  // still tested: section 63 above asserts the leg row's end, key, round and survival, and section 68
  // below asserts what the ledger says about whether a scope's result reached the board.

  await runLegApplication(ctx);
}

/**
 * Run the leg-application checks (section 68).
 *
 * A green T0 says a scope's fixtures passed. It does not say its WorkResult was ever applied, and
 * the BUILD round's confirm stage asked only the first question.
 * @param {object} ctx - Shared structural-test context from tests/lib/harness.mjs (makeCtx).
 * @returns {Promise<void>} Resolves when section 68 has been recorded on ctx.
 */
export async function runLegApplication(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("68. A scope is not finished because its T0 is green — its result has to have reached the board");
  // =============================================================================

  // Measured on a live run, dial 1, three scopes. One build leg wrote its code, a green T0 verdict
  // and a kept trial row, wrote its WorkResult to disk — and skipped step 3 of its own script,
  // `reduce ingest`. It reported green; the confirm stage re-verified the T0 artifact, agreed, and
  // the round walked on:
  //
  //     TASK-001 (env-parsing)   status: pending   ACs ticked: 0     ← skipped its ingest
  //     TASK-002 (schema-rules)  status: done      ACs ticked: 12
  //
  // Ingesting the same file afterwards succeeded, attested, and ticked nine criteria — so nothing was
  // wrong with the order, the receipt or the result. The single writer just never ran, and the board
  // GATE L2 reads as "100% ✅" disagreed with a scope that was genuinely finished.
  const probe = await import(join(ROOT, "kernel/probe/leg.mjs"));
  const ws = mkdtempSync(join(tmpdir(), "legapply-"));
  try {
    const root = join(ws, ".shapeup", "f");
    mkdirSync(join(root, "orders"), { recursive: true });
    mkdirSync(join(root, "results"), { recursive: true });
    const order = (scope, attempt) => {
      const name = `${scope}-r1-a${attempt}.json`;
      writeFileSync(join(root, "orders", name), JSON.stringify({ order_id: `f/${scope}-r1-a${attempt}`, slug: "f", worker: "task-executor" }));
      return name;
    };
    const a = order("alpha", 1);
    const b = order("beta", 1);
    writeFileSync(join(root, "results", a), JSON.stringify({ order_id: "f/alpha-r1-a1", worker: "task-executor", status: "done" }));
    writeFileSync(join(root, "results", b), JSON.stringify({ order_id: "f/beta-r1-a1", worker: "task-executor", status: "done" }));
    // Only beta's ingest ran. This is the live shape exactly.
    writeFileSync(join(root, "legs.jsonl"), JSON.stringify({
      schema_version: 1, run_id: "f-20260101T000000Z-abcdef01", order_id: "f/beta-r1-a1",
      scope_id: "beta", round: 1, attempt: 1, ingested_at: "2026-01-01T00:00:05.000Z",
    }) + "\n");

    const alpha = probe.legState(ws, "f", "alpha", 1);
    if (alpha.closed === false && alpha.unapplied.length === 1) {
      ok("a scope whose result is on disk and was never ingested reports closed:false and names the order");
    } else {
      fail(`a result that never reached the board reported ${JSON.stringify({ closed: alpha.closed, unapplied: alpha.unapplied.length })}. ` +
        `This is the live defect: the round accepted the scope on its T0 verdict alone while its task stayed pending.`);
    }
    const beta = probe.legState(ws, "f", "beta", 1);
    if (beta.closed === true && beta.unapplied.length === 0) ok("a scope whose ingest ran reports closed:true — the check discriminates");
    else fail(`an applied scope reported ${JSON.stringify({ closed: beta.closed, unapplied: beta.unapplied.length })}`);

    // "Nothing ran" must not read the same as "ran and was not applied". Both are `closed: false`,
    // and a caller has to answer them differently — one is a leg still in flight or dead, which the
    // round already handles as a spent attempt; the other is finished work the board cannot see.
    const absent = probe.legState(ws, "f", "gamma", 1);
    if (absent.closed === false && absent.orders.length === 0 && absent.unapplied.length === 0) {
      ok("a scope with no orders at all reports closed:false with an empty order list, distinguishable from unapplied work");
    } else fail(`an unstarted scope reported ${JSON.stringify(absent)}`);

    // The row must belong to THIS round. A leg row from round 1 satisfying round 2 would let a fix
    // round inherit its predecessor's application — the same shape as the resume filter that read a
    // round-1 green as a round-2 green.
    const wrongRound = probe.legState(ws, "f", "beta", 2);
    if (wrongRound.closed === false) ok("a leg row from another round does not close this one");
    else fail("a round-1 leg row closed round 2 — the ingest record is not round-keyed");

    // And the CLI's exit code has to carry it, because that is the only part a workflow leg reads.
    const K = join(ROOT, "kernel", "harness.mjs");
    const red = spawnSync("node", [K, "probe", "leg", "--slug", "f", "--scope", "alpha", "--round", "1", "--cwd", ws], { encoding: "utf8" });
    const green = spawnSync("node", [K, "probe", "leg", "--slug", "f", "--scope", "beta", "--round", "1", "--cwd", ws], { encoding: "utf8" });
    if (red.status === 1 && green.status === 0) ok("probe leg exits 1 on unapplied work and 0 when the board has it");
    else fail(`probe leg exits: unapplied=${red.status} (want 1), applied=${green.status} (want 0)`);
  } finally { rmSync(ws, { recursive: true, force: true }); }
}
