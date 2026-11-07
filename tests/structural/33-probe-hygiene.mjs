// 33 — VERIFICATION HYGIENE ON THE MEASURING TOOLS THEMSELVES (Phase 3.5 / S8).
//
// THIS MODULE HOLDS THE INSTRUMENTS TO THE SAME STANDARD PHASE 3.5 HELD THE PRODUCT TO. Nothing
// here re-derives a defect; both claims below were CONFIRMED against the shipped code before this
// module was written (see the stage's own contract notes), and what is added is the test neither
// claim had — an instrument that has never once said no is not evidence.
//
// CLAIM 1 — RETIRED with the concurrency probe. It pinned that `probe concurrency` counted only a
// genuine build leg (an order id carrying an attempt address) and not a mechanical phase dispatch,
// by driving that probe's `addressOf()` and `report()`. The probe is deleted, so there is no leg
// matching left to hold to the standard; nothing survives to retarget.
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

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Run the probe-hygiene checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("77. \"Which run is this\" resolution, watched (Phase 3.5 / S8)");
  // =============================================================================

  // (1a) and (1b) retired with the concurrency probe — see the header's CLAIM 1.

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
