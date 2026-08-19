// 33 — VERIFICATION HYGIENE ON THE MEASURING TOOLS THEMSELVES (Phase 3.5 / S8).
//
// THIS MODULE HOLDS THE INSTRUMENTS TO THE SAME STANDARD PHASE 3.5 HELD THE PRODUCT TO. Nothing
// here re-derives a defect; both claims below were CONFIRMED against the shipped code before this
// module was written (see the stage's own contract notes), and what is added is the test neither
// claim had — an instrument that has never once said no is not evidence.
//
// CLAIM 1 — the concurrency probe's leg-matching does not count a non-leg dispatch as a build leg.
// There is no OS-level process/command-line matching anywhere in this repo (`probe concurrency`
// reads only `receipts/dispatch.jsonl` + `legs.jsonl` + `t0/trials.jsonl`); the analogous surface is
// `addressOf()`/`startsFrom()` in `kernel/probe/concurrency.mjs`, which decide "is this dispatch a
// build leg" from the order id's shape alone. A leg qualifies ONLY by carrying an attempt address
// (`-r<N>-a<M>`), and `kernel/compile.mjs`'s own `buildSuffix` computation is the only path that can
// produce that shape — every non-BUILD operation (orient, analyze, wire, map-scopes, evaluate, hunt,
// hammer) compiles to `{operation}[-scopeId]-r{round}` with NO attempt segment, because the live
// dispatch pipeline (`skills/tech-lead/workflows/shapeup-run.js`'s `worker()`) never threads
// `--attempt` for any of them (confirmed by reading every call site — S5's own module, 30, pins the
// same fact about the id shape). So a mechanical, non-leg dispatch — e.g. an `evaluate` round —
// structurally CANNOT produce an order id `addressOf()` reads as having an attempt, and
// `startsFrom()` excludes exactly that: `attempt === null` rows are counted in `phase_dispatches`,
// never in `starts`. This module proves that against the shipped `report()`, not a hand-kept copy of
// the rule: a fixture with two genuine build legs AND a mechanical `evaluate-r<N>` row must count and
// pair only the two build legs, and must exclude the third from `legs_total` and from `concurrency`.
//
// CLAIM 2 — "which run is this" (`resolveRunId(cwd, null)`) does not cross two run directories.
// `resolveRunId` is the only no-slug-fallback resolver in the codebase; with no slug given it reads
// the SINGLE global `active-scope` pointer, pulls its `slug` field, and calls `readRunId(cwd, slug)`
// — which reads exactly ONE receipt (`.shapeup/<slug>/receipt.json`). It never globs or scans
// `.shapeup/*`, so it is structurally incapable of blending two runs' records into one answer; the
// residual risk is resolving CONFIDENTLY to the wrong run if the pointer is stale, which is a
// legitimate discovered follow-up and not what this stage's own text asks to be fixed here ("confirm
// … the plan's own verb is 'confirm', not 'necessarily fix'"). No source change was needed for
// either claim — this module is the test that was missing, proving both structurally-safe-by-reading
// claims against the shipped code with a fixture that could have falsified them.

import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";

/** Append one JSON row as a line, creating the parent directory. */
function appendRow(path, row) {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(row) + "\n");
}

/**
 * Run the probe-hygiene checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("77. The concurrency probe's leg-matching and \"which run is this\" resolution, watched (Phase 3.5 / S8)");
  // =============================================================================

  const { report, addressOf } = await import(join(ROOT, "kernel/probe/concurrency.mjs"));

  // --- (1a) addressOf() itself: a mechanical, non-leg order id never reads as having an attempt ---
  {
    const build = addressOf("demo/sc-a-r1-a1");
    const mech = addressOf("demo/evaluate-r1");
    if (build.attempt === 1 && build.round === 1 && build.name === "sc-a") {
      ok("addressOf() reads a genuine build-leg id (scope-r<N>-a<M>) as attempt-bearing");
    } else fail(`addressOf("demo/sc-a-r1-a1") = ${JSON.stringify(build)}, expected {name:"sc-a", round:1, attempt:1}`);
    if (mech.attempt === null) {
      ok("addressOf() reads a mechanical non-BUILD dispatch id (operation-r<N>, no attempt segment) as attempt-less — the only signal startsFrom() uses to exclude it");
    } else fail(`addressOf("demo/evaluate-r1") = ${JSON.stringify(mech)}, expected attempt:null`);
  }

  // --- (1b) report(): a fixture mixing two genuine build legs with one mechanical dispatch must
  //     count and pair only the two build legs, excluding the mechanical row from legs_total and
  //     from the concurrency figure it drives.
  {
    const runRoot = mkdtempSync(join(tmpdir(), "struct-probe-hygiene-"));
    try {
      const t0 = Date.parse("2026-08-19T10:00:00.000Z");
      const iso = (ms) => new Date(t0 + ms).toISOString();

      // Two real build legs for the same round, overlapping — the fan-out the probe exists to
      // measure. Plus a mechanical `evaluate` dispatch shaped exactly the way the live pipeline
      // actually compiles one (operation-r<N>, no scope, no attempt) — the case CLAIM 1 concerns.
      appendRow(join(runRoot, "receipts", "dispatch.jsonl"),
        { at: iso(0), order_id: "probe-demo/sc-a-r1-a1", run_id: "probe-demo-run" });
      appendRow(join(runRoot, "receipts", "dispatch.jsonl"),
        { at: iso(1000), order_id: "probe-demo/sc-b-r1-a1", run_id: "probe-demo-run" });
      appendRow(join(runRoot, "receipts", "dispatch.jsonl"),
        { at: iso(2000), order_id: "probe-demo/evaluate-r1", run_id: "probe-demo-run" });

      appendRow(join(runRoot, "legs.jsonl"),
        { order_id: "probe-demo/sc-a-r1-a1", scope_id: "sc-a", round: 1, ingested_at: iso(10_000) });
      appendRow(join(runRoot, "legs.jsonl"),
        { order_id: "probe-demo/sc-b-r1-a1", scope_id: "sc-b", round: 1, ingested_at: iso(10_500) });
      // Deliberately no legs.jsonl row for `evaluate-r1` — a real mechanical dispatch has no leg
      // completion at all, since it was never a leg to begin with.

      const r = report(runRoot, {});

      if (r.completeness.legs_total === 2) {
        ok("probe concurrency counts exactly the two genuine build legs (legs_total=2), not the mechanical evaluate dispatch alongside them");
      } else fail(`legs_total = ${r.completeness.legs_total}, expected 2 — the mechanical evaluate-r1 row was counted as a leg`);

      if (r.completeness.phase_dispatches_excluded === 1) {
        ok("the mechanical evaluate-r1 dispatch is reported as an excluded phase dispatch, not silently dropped");
      } else fail(`phase_dispatches_excluded = ${r.completeness.phase_dispatches_excluded}, expected 1`);

      if (r.legs.every((l) => l.order_id !== "probe-demo/evaluate-r1")) {
        ok("the mechanical evaluate-r1 dispatch never appears in the reported legs array");
      } else fail("evaluate-r1 appears in report().legs — a non-leg dispatch was paired and reported as a build leg");

      if (r.concurrency.max_concurrent === 2 && r.concurrency.bound === "exact") {
        ok("max_concurrent is computed from the two real build legs alone (2, exact) — unperturbed by the mechanical dispatch mixed into the same record set");
      } else fail(`concurrency = ${JSON.stringify(r.concurrency)}, expected max_concurrent:2 bound:"exact"`);
    } finally { rmSync(runRoot, { recursive: true, force: true }); }
  }

  // --- (2) resolveRunId(cwd, null): two `.shapeup/<slug>/` run directories on disk at once; the
  //     pointer names one of them, and the resolver must return exactly that one's run id — never
  //     the other's, and never a value that could only have come from reading both (it returns a
  //     single RUN_ID_PATTERN string or null; there is no third shape it could blend into).
  {
    const { resolveRunId, activeScope, localRoot, RECEIPT_FILE } = await import(join(ROOT, "kernel/lib/paths.mjs"));
    const cwd = mkdtempSync(join(tmpdir(), "struct-probe-hygiene-runid-"));
    try {
      const RUN_A = "slug-a-20260101T000000Z-aaaaaaaa";
      const RUN_B = "slug-b-20260215T000000Z-bbbbbbbb";
      mkdirSync(localRoot(cwd, "slug-a"), { recursive: true });
      mkdirSync(localRoot(cwd, "slug-b"), { recursive: true });
      writeFileSync(join(localRoot(cwd, "slug-a"), RECEIPT_FILE), JSON.stringify({ run_id: RUN_A }));
      writeFileSync(join(localRoot(cwd, "slug-b"), RECEIPT_FILE), JSON.stringify({ run_id: RUN_B }));

      // Pointer names slug-a: the resolver must answer slug-a's id, with slug-b's receipt present
      // and readable on disk the whole time.
      writeFileSync(activeScope(cwd), JSON.stringify({ slug: "slug-a", started_at: "2026-01-01T00:00:00.000Z" }));
      const resolvedA = resolveRunId(cwd, null);
      if (resolvedA === RUN_A) {
        ok("resolveRunId(cwd, null) resolves to the run named by the active-scope pointer (slug-a) with a second run directory (slug-b) present on disk");
      } else fail(`resolveRunId(cwd, null) = ${JSON.stringify(resolvedA)}, expected ${JSON.stringify(RUN_A)} — the pointer names slug-a`);
      if (resolvedA !== RUN_B) {
        ok("resolveRunId(cwd, null) never returns the OTHER run directory's id");
      } else fail("resolveRunId(cwd, null) returned slug-b's run id while the pointer named slug-a");

      // Re-point at slug-b and repeat — proves the answer tracks the pointer rather than, say,
      // whichever receipt sorts first or was written first (both are still on disk, unmoved).
      writeFileSync(activeScope(cwd), JSON.stringify({ slug: "slug-b", started_at: "2026-02-15T00:00:00.000Z" }));
      const resolvedB = resolveRunId(cwd, null);
      if (resolvedB === RUN_B) {
        ok("re-pointing active-scope at slug-b flips the answer to slug-b's run id — the resolver reads the pointer, not directory order or a cached value");
      } else fail(`resolveRunId(cwd, null) after re-pointing = ${JSON.stringify(resolvedB)}, expected ${JSON.stringify(RUN_B)}`);
      if (resolvedB !== RUN_A) {
        ok("resolveRunId(cwd, null) does not fall back to the previously-active run once the pointer moves");
      } else fail("resolveRunId(cwd, null) kept returning slug-a's id after the pointer moved to slug-b");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
}
