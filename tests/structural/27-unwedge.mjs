// 27 — UNWEDGING A DISPATCHED-BUT-UNANSWERED ORDER (Phase 3.5 / S2).
//
// THE DEFECT THIS CLOSES. `hooks/sandbox-guard.mjs`'s `liveOrders()` treats every file under
// `orders/` with no same-named file under `results/` as LIVE, and constrains every subsequent
// Edit/Write to what some live order's substrate permits. If a worker never returns a result for a
// dispatched order (crash, kill, abandoned run), nothing anywhere removes the order file or
// synthesizes a result for it — so that order stays live FOREVER, constraining writes across
// unrelated later work in the same cwd. `kernel/init/run.mjs --force` used to `mkdirSync(...,
// {recursive:true})` over `orders/`/`results/`/`discovery/` and stop — a no-op on directories that
// already exist and already hold the stale order — so the wedge survived `--force` exactly as
// described. `--force` now resolves every such order first (`resolveAbandonedOrders()`), writing a
// same-named, plainly-marked record under `results/` — never deleting the order file, which is this
// codebase's own audit trail of what was dispatched.
//
// WHAT THIS MODULE PROVES, by EXECUTING the shipped hook and the shipped CLI entry point rather
// than reading either's source: a write that lands ONLY inside the abandoned order's substrate (and
// nowhere else the run's other live orders cover) is PERMITTED before `--force` — proving
// `liveOrders()` really does count it live, not just that the fixture claims to — and DENIED after
// `--force` runs, against the exact same fixture and the exact same probe path. The order file
// itself survives, and a same-named record appears under `results/`.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SLUG = "wedge-demo";

/** Write a JSON (or raw string) file, creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

/**
 * Run the unwedge checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("70. `--force` unwedges a dispatched-but-unanswered order (Phase 3.5 / S2)");
  // =============================================================================

  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");
  if (!existsSync(KERNEL) || !existsSync(GUARD)) {
    fail("kernel/harness.mjs or hooks/sandbox-guard.mjs is missing — cannot exercise the unwedge path");
    return;
  }

  const ws = mkdtempSync(join(tmpdir(), "struct-unwedge-"));
  try {
    // The abandoned order: dispatched, never answered — no matching file under results/. Its
    // substrate ("src/parse/**") is disjoint from the live pointer order's below, so a write inside
    // ONLY this order's substrate isolates its own liveness from the pointer's.
    const abandonedPath = w(ws, `.shapeup/${SLUG}/orders/legA.json`, {
      schema_version: 1, order_id: `${SLUG}/legA`, worker: "task-executor", operation: "execute",
      compiled_at: "2026-08-17T09:00:00.000Z",
      substrate: { allowed: ["src/parse/**"] },
    });

    // The CURRENT run pointer's order: unrelated later work in the same cwd, already answered.
    // Its substrate never covers "src/parse/**", so it cannot confound the probe below either way.
    const pointerPath = w(ws, `.shapeup/${SLUG}/orders/legB.json`, {
      schema_version: 1, order_id: `${SLUG}/legB`, worker: "task-executor", operation: "execute",
      compiled_at: "2026-08-17T09:05:00.000Z",
      substrate: { allowed: ["src/other/**"] },
    });
    w(ws, `.shapeup/${SLUG}/results/legB.json`, {
      schema_version: 1, order_id: `${SLUG}/legB`, status: "done",
    });
    w(ws, ".shapeup/active-order", { slug: SLUG, order_path: pointerPath });

    // A receipt, so this fixture is the field case: a run that is already open, exactly what
    // `--force` is documented to abandon and start over.
    w(ws, `.shapeup/${SLUG}/receipt.json`, {
      receipt_version: 1, type: "harness-run-receipt", slug: SLUG,
      run_id: `${SLUG}/deadbeef`, started: true, intake_sha256: "0".repeat(64),
    });

    const ask = (filePath) => {
      const payload = JSON.stringify({ tool_name: "Edit", cwd: ws, tool_input: { file_path: filePath } });
      const r = spawnSync("node", [GUARD], { encoding: "utf8", input: payload });
      return { denied: (r.stdout || "").includes('"permissionDecision":"deny"'), out: r.stdout || "" };
    };
    const probePath = join(ws, "src/parse/thing.js");

    // (a) Before --force: sandbox-guard's own liveOrders() logic counts the abandoned order live —
    // a write inside ONLY its substrate is permitted (it would be denied, per the live pointer
    // order's own narrower substrate, if the abandoned order were not being counted).
    const before = ask(probePath);
    if (!before.denied) {
      ok("sandbox-guard's liveOrders() counts the dispatched-but-unanswered order LIVE before --force");
    } else {
      fail(`fixture order was not live before --force — this probe is not testing the wedge\n${before.out}`);
    }

    // The unwedge path itself: `harness init run --force` against the SAME run root.
    const r = spawnSync("node", [
      KERNEL, "init", "run",
      "--slug", SLUG, "--intake-text", "second pass at the same feature",
      "--force", "--cwd", ws,
    ], { encoding: "utf8" });
    if (r.status === 0) ok("`harness init run --force` exits 0 over a run root with a wedged order");
    else fail(`init-run --force failed: exit ${r.status}\n${r.stderr || r.stdout}`);

    const resolvedPath = join(ws, `.shapeup/${SLUG}/results/legA.json`);
    if (existsSync(resolvedPath)) {
      ok("--force writes a resolving record under results/ for the abandoned order");
    } else {
      fail("--force did not write a results/ record for the abandoned order — the wedge is not cleared on disk");
    }

    if (existsSync(abandonedPath)) {
      ok("--force preserves the abandoned order file itself (the dispatch audit trail survives)");
    } else {
      fail("--force deleted the abandoned order file — the dispatch record is lost, not just resolved");
    }

    // (b) After --force: the exact same hook, same fixture, same probe path — but the abandoned
    // order is no longer counted live.
    const after = ask(probePath);
    if (after.denied) {
      ok("sandbox-guard's liveOrders() no longer counts the order live after --force — the wedge is cleared");
    } else {
      fail(`the order is still live after --force — --force did not actually unwedge it\n${after.out}`);
    }
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
