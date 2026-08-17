// Structural test module: the leg-completion record, and the instrument that reads it.
// Sections: 63, 64.
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
 * Run the leg-record and instrument checks.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when both section bodies finish.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const probe = await import(join(ROOT, "kernel/probe/concurrency.mjs"));

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
      const first = closeOneLeg(ROOT, ws, { slug: "legs", compileArgs: ["--operation", "analyze", "--slug", "legs"] });
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
        for (const rel of ["kernel/reduce/ingest.mjs", "kernel/probe/concurrency.mjs"]) {
          codeOnly(readFileSync(join(ROOT, rel), "utf8")).split("\n").forEach((line, i) => {
            if (LITERAL.test(line) || SEGMENTS.test(line)) offenders.push(`${rel}:${i + 1} ${line.trim().slice(0, 80)}`);
          });
        }
        if (!offenders.length) ok("neither the leg writer nor the instrument spells a storage root itself");
        else fail(`a storage root is spelled outside lib/paths.mjs:\n    ${offenders.join("\n    ")}`);
      }
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // =============================================================================
  section("64. The instrument reports what it could NOT measure, in the same value as the number");
  // =============================================================================
  {
    // (a) THE CORE RULE. Four legs, one usable record. A predicate an absence can satisfy must
    //     report the absence — `max_concurrent: 1` over this set is the exact shape of the
    //     `runFixtures` false green, and it must not be reachable.
    const starts = [1, 2, 3, 4].map((i) => ({
      order_id: `f/s${i}-r1-a1`, scope_id: `s${i}`, round: 1, attempt: 1,
      start: 1000 * i, start_source: "dispatch-receipt", run_id: "f-20260101T000000Z-abcdef01",
    }));
    const oneLeg = probe.pairLegs(starts, [{ order_id: "f/s1-r1-a1", ingested_at: new Date(9000).toISOString() }], []);
    const usable = oneLeg.filter((l) => l.end !== null);
    if (usable.length === 1 && oneLeg.filter((l) => l.end === null).length === 3) {
      ok("three legs with no completion record are carried as legs with no end, not dropped from the count");
    } else fail(`pairing gave ${usable.length} usable of ${oneLeg.length}`);

    // (b) The same set through the real report, on disk.
    const ws = mkdtempSync(join(tmpdir(), "concur-"));
    try {
      const root = join(ws, ".shapeup", "f");
      mkdirSync(join(root, "receipts"), { recursive: true });
      const base = Date.parse("2026-01-01T00:00:00.000Z");
      const recs = starts.map((s) => ({ at: new Date(base + s.start).toISOString(), order_id: s.order_id, run_id: s.run_id, skill_invoked: "task-executor", worker_declared: "task-executor" }));
      writeFileSync(join(root, "receipts", "dispatch.jsonl"), recs.map((r) => JSON.stringify(r)).join("\n") + "\n");
      writeFileSync(join(root, "legs.jsonl"), JSON.stringify({
        schema_version: 1, run_id: starts[0].run_id, order_id: "f/s1-r1-a1", scope_id: "s1", round: 1, attempt: 1,
        ingested_at: new Date(base + 9000).toISOString(),
      }) + "\n");

      const r = probe.report(root, {});
      if (r.completeness.legs_total === 4 && r.completeness.no_completion_record === 3) {
        ok("the report states 4 legs and 3 with no completion record, beside the concurrency figure");
      } else fail(`completeness reads ${JSON.stringify(r.completeness)}`);
      if (r.concurrency.max_concurrent === 1 && r.completeness.no_completion_record === 3 && r.concurrency.bound === "exact") {
        ok("a concurrency of 1 is never emitted alone — the three unmeasured legs sit in the same document");
      } else fail(`concurrency block ${JSON.stringify(r.concurrency)} does not carry its incompleteness`);

      // (c) NO USABLE LEG AT ALL must be `null`, not 0 and not 1. Both of those read as a real
      //     answer: "nothing ran concurrently". The archive contains this case for real — one run
      //     dispatched eight build legs and wrote no T0 artifact at all.
      rmSync(join(root, "legs.jsonl"));
      const blind = probe.report(root, {});
      if (blind.concurrency.max_concurrent === null && blind.concurrency.two_or_more_concurrent === null) {
        ok("a record set with no usable interval reports null concurrency and an UNKNOWN D1, never 0 or 1");
      } else fail(`a blind record set reported ${JSON.stringify(blind.concurrency)}`);
      if (blind.completeness.legs_total === 4) ok("the blind report still counts the four dispatches it could not close");
      else fail(`blind report lost the dispatch count: ${blind.completeness.legs_total}`);
      if (blind.warnings.some((w) => /legs\.jsonl/.test(w))) ok("the missing completion ledger is named in the report's own warnings");
      else fail(`no warning names the missing ledger: ${JSON.stringify(blind.warnings)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }

    // (d) A SPEEDUP IS REFUSED WHEN IT CANNOT BE SUPPORTED. Truncated legs shorten the work sum once
    //     per leg and the span only for the last one, so the ratio moves in a direction that depends
    //     on the round's shape — measured at 0.90 on a round that ran four scopes at once.
    {
      const lower = [
        { scope_id: "a", round: 1, start: 0, end: 100, bound: "lower" },
        { scope_id: "b", round: 1, start: 50, end: 150, bound: "lower" },
      ];
      const s = probe.summarise(1, lower);
      if (s.speedup === null && /leg-record|completion record/.test(String(s.speedup_refused_because))) {
        ok("a launch with any lower-bound leg refuses a speedup and says why");
      } else fail(`speedup ${s.speedup} on a lower-bound launch (reason: ${s.speedup_refused_because})`);
      const exact = lower.map((l) => ({ ...l, bound: "exact" }));
      const e = probe.summarise(1, exact);
      if (e.speedup === 1.33 && e.speedup_refused_because === null) ok("a launch whose legs all have completion records DOES report a speedup");
      else fail(`exact launch reported speedup ${e.speedup} / ${e.speedup_refused_because}`);
      if (e.max_concurrent === 2 && e.max_concurrent_bound === "exact") ok("overlap over exact legs is reported as exact");
      else fail(`exact launch concurrency ${e.max_concurrent} (${e.max_concurrent_bound})`);
    }

    // (e) Touching ends do not count as an overlap. Two legs that meet at one instant were never
    //     both running, and a scheduler that hands off cleanly must not read as concurrent.
    {
      const touching = probe.maxConcurrent([
        { start: 0, end: 100 }, { start: 100, end: 200 },
      ]);
      if (touching.max === 1) ok("a leg that ends exactly as the next begins is not counted as concurrent");
      else fail(`touching legs reported max_concurrent ${touching.max}`);
      if (probe.maxConcurrent([]).max === null) ok("no legs yields null concurrency, not 0");
      else fail("an empty leg list reported a number");
    }

    // (f) THE DIAL IS READ, NOT ASSUMED. `maxParallelScopes` is absent from every run recorded so
    //     far, so a report asserting 4 would be asserting an operator choice nobody made.
    {
      const ws2 = mkdtempSync(join(tmpdir(), "dial-"));
      try {
        const d0 = probe.dialFrom(ws2);
        if (d0.max_parallel_scopes === probe.DEFAULT_MAX_PARALLEL_SCOPES && /default/.test(d0.source)) {
          ok("a run whose args declare no fan-out width reports the effective default AND says it is one");
        } else fail(`dial without run-args read ${JSON.stringify(d0)}`);
        writeFileSync(join(ws2, "run-args.json"), JSON.stringify({ slug: "x", maxParallelScopes: 2 }));
        const d1 = probe.dialFrom(ws2);
        if (d1.max_parallel_scopes === 2 && d1.source === "run-args") ok("a declared fan-out width is read off run-args.json and sourced to it");
        else fail(`dial with run-args read ${JSON.stringify(d1)}`);
      } finally { rmSync(ws2, { recursive: true, force: true }); }
    }

    // (g) BYTE-STABLE. An instrument whose answer moves between two reads of one unchanged tree is
    //     measuring itself. Run against the committed archive, which cannot change under it.
    const ARCHIVE = join(ROOT, "traces/phase2-criterion1/headless-shipped/shapeup-local/todo-cli");
    if (!existsSync(ARCHIVE)) fail(`the archived run this section measures is missing: ${ARCHIVE}`);
    else {
      const a = JSON.stringify(probe.report(ARCHIVE, { round: 1 }));
      const b = JSON.stringify(probe.report(ARCHIVE, { round: 1 }));
      if (a === b) ok("two reports over one unchanged tree are byte-identical — no clock reading leaks into the output");
      else fail("the concurrency report is not byte-stable across two reads of the same tree");
      if (!/"generated_at"|"now"/.test(a)) ok("the report carries no wall-clock field that would break its stability");
      else fail("the report embeds a clock reading");

      // (h) THE FROZEN BASELINE. Re-derived here rather than trusted: if the archive or the
      //     derivation moves, the recorded numbers stop being the numbers this repo measured.
      const BASELINE = join(ROOT, "traces/phase2-criterion1/CONCURRENCY-BASELINE.json");
      if (!existsSync(BASELINE)) fail(`the committed concurrency baseline is missing: ${BASELINE}`);
      else {
        const frozen = JSON.parse(readFileSync(BASELINE, "utf8"));
        let drift = 0, compared = 0;
        for (const entry of frozen.runs || []) {
          const root = join(ROOT, entry.run_root_repo_relative);
          if (!existsSync(root)) { fail(`baseline names a run root that is not on disk: ${entry.run_root_repo_relative}`); continue; }
          compared++;
          const fresh = probe.report(root, { round: entry.round ?? null });
          // `run_root` is absolute and machine-specific; everything else must match byte for byte.
          const strip = (o) => JSON.stringify({ ...o, run_root: null });
          if (strip(fresh) !== strip(entry.report)) { drift++; fail(`baseline drift for ${entry.label}: the archive no longer yields the recorded report`); }
        }
        if (compared && !drift) ok(`the committed baseline re-derives byte-for-byte from the archive (${compared} run(s))`);
        // The D3 slot is empty ON PURPOSE. A number here would be manufactured: no archived run was
        // executed sequentially, so there is nothing for a fan-out to be 30% faster than.
        if (frozen.d3?.available === false && String(frozen.d3.reason || "").length > 40) {
          ok("the baseline records D3 as unavailable with a reason, rather than filling the slot with a number");
        } else fail("the baseline's D3 block claims an availability it cannot support");
      }
    }
  }
}
