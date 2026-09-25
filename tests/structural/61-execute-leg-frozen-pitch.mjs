// 61 — HD-012: A BUILD LEG'S OWN SUBSTRATE FREEZES THE STAGED PITCH, EXECUTED.
//
// THE DEFECT THIS CLOSES. `substrateFor()`'s `FROZEN_INTAKE` (`.shapeup/<slug>/intake.md`,
// `breadboard.md`) reached `coverage`, `analyze`, `map-scopes`, `wire`, `evaluate` and `hunt` — every
// operation that READS the staged pitch — but the `execute`/`fix`/`spike` arm returned `{allowed,
// shared}` with no `frozen` key at all. `hooks/sandbox-guard.mjs` checks `frozen` first and then
// waves any unfrozen path inside the run trace through its carve-out, so a build leg could overwrite
// the run's own input truth. Build legs are the most numerous and longest-lived dispatches in a run
// — the widest window, not the narrowest. Measured 2026-09-18 by executing the guard against a
// fixture carrying one live `execute` order: `intake.md` and `breadboard.md` both PERMITTED.
//
// WHAT THIS MODULE PROVES, over the REAL `substrateFor("execute"|"fix"|"spike")` return value —
// never a hand-typed stand-in — so a revert of the one-line fix in `kernel/compile.mjs` (adding
// `frozen: [...FROZEN_INTAKE]` to that arm) turns this module red without anything here changing:
//
//   DENIED    the staged pitch — `.shapeup/<slug>/intake.md`, `.shapeup/<slug>/breadboard.md`
//   PERMITTED the scope's own `allowed_file_substrate` and `shared_substrate`, this leg's
//             `spikes/**`, and the run-trace files a doer must legitimately write (the task board,
//             the P3.7 discovery ledger) — so the fix is proven to narrow the fence to the pitch
//             alone, never to widen it past what the plan calls "a write no legitimate worker makes".
//
// Both directions are read off `hooks/sandbox-guard.mjs`'s own decision ledger
// (`SHAPEUP_DECISIONS_PATH` redirected to a per-run temp path, as the rest of the suite does), not
// just the host-facing allow/deny — tests/structural/56-hook-decision-table.mjs's own convention: a
// decision and its RULE are different facts, and only the rule says the fence looked and cleared
// rather than never having fired. tests/structural/52-breadboard-intake.mjs is the other model this
// follows — execute the real machinery against a temp checkout, read the artifact back, never assert
// against a narrated behaviour.
//
// A NEW FILE, not an extension of 03-hooks.mjs's existing sandbox-guard section or
// 56-hook-decision-table.mjs's fixture table: both of those prove the GUARD enforces whatever a
// `substrate` block declares, which is unchanged by this defect and already covered (including a
// `frozen` staged-pitch row for `evaluate`). This defect is specifically that `substrateFor` declared
// nothing for the build operations, so the check that catches a regression has to call the real
// function, not restate its output — which is a different shape of test from either file's own data.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SLUG = "hd012-demo";

/** Write a JSON (or raw string) file, creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

/**
 * Run the HD-012 build-leg fence checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("95. HD-012 — a build leg's own substrate freezes the staged pitch, executed");
  // =============================================================================

  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");
  if (!existsSync(GUARD)) {
    fail("hooks/sandbox-guard.mjs is missing — cannot exercise the fence");
    return;
  }

  const { substrateFor } = await import(join(ROOT, "kernel/compile.mjs"));

  const scope = {
    scope_id: "scope-a",
    allowed_file_substrate: ["src/scopeA/**"],
    shared_substrate: ["packages/shared/http.ts"],
  };

  // execute/fix/spike share one arm in substrateFor — the defect and the fix are the same line for
  // all three, so all three get the full walk rather than treating "execute" as the representative.
  for (const operation of ["execute", "fix", "spike"]) {
    const ws = mkdtempSync(join(tmpdir(), `struct-hd012-${operation}-`));
    const ledger = join(ws, "decisions.jsonl");
    try {
      // THE REAL FUNCTION. A hand-typed substrate block here would test only that the guard obeys
      // whatever `frozen` list it is handed — already proven elsewhere — and would stay green
      // through a revert of the actual fix, which is the one failure this module exists to catch.
      const substrate = substrateFor(operation, { slug: SLUG, scope });

      const orderPath = w(ws, `.shapeup/${SLUG}/orders/leg-a.json`, {
        schema_version: 1, order_id: `${SLUG}/leg-a`, worker: "task-executor", operation,
        compiled_at: "2026-08-17T09:00:00.000Z",
        substrate,
      });
      w(ws, ".shapeup/active-order", { slug: SLUG, order_path: orderPath });

      const ask = (relPath, toolName = "Edit") => {
        const env = { ...process.env, SHAPEUP_DECISIONS_PATH: ledger };
        const payload = JSON.stringify({ tool_name: toolName, cwd: ws, tool_input: { file_path: join(ws, relPath) } });
        const r = spawnSync("node", [GUARD], { encoding: "utf8", input: payload, env });
        const decision = (r.stdout || "").includes('"permissionDecision":"deny"') ? "deny" : "allow";
        let rule = null;
        try {
          const rows = readFileSync(ledger, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
          rule = rows.length ? rows[rows.length - 1].rule : null;
        } catch { /* no ledger yet, or unreadable — rule stays null, which fails the assertion below */ }
        return { decision, rule, out: r.stdout || "" };
      };
      const expect = (label, relPath, wantDecision, wantRule) => {
        const { decision, rule, out } = ask(relPath);
        if (decision === wantDecision && rule === wantRule) ok(`${operation}: ${label} → ${wantDecision}, rule "${wantRule}"`);
        else fail(`${operation}: ${label} — expected ${wantDecision}/"${wantRule}", got ${decision}/"${rule}"\n${out}`);
      };

      // --- DENIED: the staged pitch is the run's own input truth, both halves ---
      expect("the staged intake (the run's own input truth)", `.shapeup/${SLUG}/intake.md`, "deny", "frozen");
      expect("the staged breadboard", `.shapeup/${SLUG}/breadboard.md`, "deny", "frozen");

      // --- PERMITTED: no legitimate write is newly denied ---
      expect("the scope's own allowed_file_substrate", "src/scopeA/Widget.tsx", "allow", "in-substrate");
      expect("the scope's declared shared_substrate", "packages/shared/http.ts", "allow", "in-substrate");
      expect("this leg's own spikes/** scratch space", `.shapeup/${SLUG}/spikes/notes.md`, "allow", "in-substrate");
      // The doer's bookkeeping is the TASK FILE (P3 status/AC ticks). The index is ingest's projection
      // of the task results, which the executor's own contract forbids it to edit — and since a
      // substring match on the index once ticked a skipped task's row ✅ through its Depends On
      // column, the hook enforces that rule rather than the contract merely stating it.
      expect("the task board (task-executor P3 status/AC ticks)", `.shapeup/${SLUG}/tasks/TASK-001.md`, "allow", "in-substrate");
      expect("the board index (ingest's projection, never the doer's)", `.shapeup/${SLUG}/tasks/_index.md`, "deny", "frozen");
      expect("the P3.7 discovery ledger", `.shapeup/${SLUG}/discovery/ledger.md`, "allow", "in-substrate");
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }
}
