// L4 WAS SIGNED TWICE.
//
// A launched run crosses GATE L4 itself and then closes. The orchestrator's closing step, written
// before the run learned to do that, resolved L4 again — a second `ship` row, a minute after the
// close, for a decision already taken. The gate now returns the run's earlier sign-off instead of
// taking a new one; a paused L4 is not a sign-off, so a relaunch can still answer it.
import { mkdtempSync, rmSync, readFileSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the single-sign-off checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("165. GATE L4 is signed once per run — a second resolve returns the first, a paused one can still be answered");

  const ws = mkdtempSync(join(tmpdir(), "l4-once-"));
  const slug = "signfx";
  const h = (...a) => spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...a, "--cwd", ws], { cwd: ws, encoding: "utf8", timeout: 60_000 });
  const rows = () => { try { return readFileSync(join(ws, ".shapeup", slug, "gates.jsonl"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
  try {
    const opened = h("init", "run", "--slug", slug, "--intake-text", "sign once", "--auto-level", "unattended");
    if (opened.status !== 0) { fail(`(setup) init run failed: ${(opened.stderr || opened.stdout).slice(0, 200)}`); return; }

    // A paused L4 from an earlier launch of this run — not a sign-off.
    const runId = JSON.parse(readFileSync(join(ws, ".shapeup", slug, "receipt.json"), "utf8")).run_id;
    mkdirSync(join(ws, ".shapeup", slug), { recursive: true });
    appendFileSync(join(ws, ".shapeup", slug, "gates.jsonl"), JSON.stringify({ run_id: runId, gate: "L4", status: "ask", decision: "ask" }) + "\n");
    // An earlier run's sign-off — a different key.
    appendFileSync(join(ws, ".shapeup", slug, "gates.jsonl"), JSON.stringify({ run_id: "other-run", gate: "L4", status: "ok", decision: "hold" }) + "\n");

    mkdirSync(join(ws, ".shapeup", slug, "reports"), { recursive: true });
    writeFileSync(join(ws, ".shapeup", slug, "reports", "hammer-census.json"), JSON.stringify({ verdict: "ship-now", cut_list: [] }));

    const first = h("gate", "--resolve", "L4", "--slug", slug, "--preset", "ci");
    const afterFirst = rows().filter((r) => r.gate === "L4" && r.run_id === runId && r.status === "ok").length;
    if (first.status === 0 && afterFirst === 1) ok("a paused L4 and another run's sign-off do not count — the first real resolve writes its row");
    else fail(`first resolve: exit ${first.status}, ok rows ${afterFirst}: ${first.stdout.slice(0, 200)}`);

    const open = h("gate", "--resolve", "L4", "--slug", slug, "--preset", "ci");
    if (open.status === 0 && rows().filter((r) => r.gate === "L4" && r.run_id === runId && r.status === "ok").length === 2) {
      ok("an open run still re-resolves L4 — the census it reads may have changed");
    } else fail(`open-run re-resolve: exit ${open.status}`);

    const closed = h("probe", "resume", "--slug", slug, "--close", "shipped", "--cause", "verdict=pass");
    if (closed.status !== 0) { fail(`(setup) close failed: ${(closed.stderr || closed.stdout).slice(0, 200)}`); return; }
    const second = h("gate", "--resolve", "L4", "--slug", slug, "--preset", "ci");
    let out = {}; try { out = JSON.parse(second.stdout); } catch { /* reported below */ }
    const afterSecond = rows().filter((r) => r.gate === "L4").length;
    if (second.status === 0 && out.decision === "ship" && out.already_resolved_at && afterSecond === 4) {
      ok("over a closed run, a resolve returns the sign-off already on record and writes no row");
    } else fail(`second resolve: exit ${second.status}, L4 rows ${afterSecond}, out ${second.stdout.slice(0, 200)}`);

    const l3a = h("gate", "--resolve", "L3", "--slug", slug, "--preset", "ci", "--round", "1");
    const l3b = h("gate", "--resolve", "L3", "--slug", slug, "--preset", "ci", "--round", "2");
    if (l3a.status === 0 && l3b.status === 0 && rows().filter((r) => r.gate === "L3").length === 2) ok("per-round gates are untouched — L3 still writes a row per round");
    else fail("the once-only rule reached a per-round gate");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // The run's return names the report by path. It carried the ship command's one-line `detail`
  // instead — a sub-agent's sentence where the orchestrator expects a file to open.
  const wf = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
  if (!/report:\s*ship\.detail/.test(wf) && /report: REPORT_PATH/.test(wf)) ok("the RunReturn's report field is the report's path, never the ship command's prose");
  else fail("the RunReturn's report field reads the ship command's detail again");
}
