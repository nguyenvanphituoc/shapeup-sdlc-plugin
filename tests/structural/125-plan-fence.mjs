// Structural test module: the planning activity's fence — a `plan` order, driven through the real hook.
// Section: 178.
//
// WHY THIS MODULE EXISTS.
//
// Planning runs in the loop's own context, so no sub-agent is dispatched and — before this order
// existed — no order was live while the spec tree, the wiring map and the scope contracts were being
// written. A fixture showed what that leaves: with no live order the substrate guard answers `allow`,
// rule `no-round`, for every write, so the pitch the run is measured against and the project profile
// the seams resolve against were open to any edit. A fence-only `plan` order restores the write
// contract the three planners had, per substep.
//
// WHAT IS DRIVEN, never read off the source: `compile --operation plan` through the real CLI, then the
// real `hooks/sandbox-guard.mjs` fed a tool call, with the verdict AND the ledger's `rule` read back
// (the host's allow/deny alone cannot tell "outside the substrate" from "nothing is watching").
// `reduce ingest --close-plan` is run for real too, because it is what lifts the fence — and the
// check that the loop cannot lift it by writing the result itself is a write the hook must refuse.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SLUG = "demo";

/**
 * Run the plan-fence checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  section("178. A live `plan` order fences the planning writes — driven through the real hook, closed by the kernel");

  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");
  if (!existsSync(KERNEL) || !existsSync(GUARD)) { fail("the kernel or the sandbox guard is missing"); return; }

  const ws = mkdtempSync(join(tmpdir(), "struct-plan-fence-"));
  const ledger = join(ws, "decisions.jsonl");
  const sh = (verbs, args) => spawnSync("node", [KERNEL, ...verbs.split(" "), ...args], { encoding: "utf8", cwd: ws });
  const put = (rel, text) => { const p = join(ws, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); return p; };
  try {
    const open = sh("init run", ["--slug", SLUG, "--intake-text", "Add a todo list", "--auto-level", "interactive", "--cwd", ws]);
    if (open.status !== 0) { fail(`could not open the fixture run: ${open.stderr}`); return; }
    put(`shapeup/${SLUG}/project-profile.md`, "---\nschema_version: 1\narchetype: cli\nentry_point: bin/todo.js\n---\n");

    /** Ask the real guard about one write; read the verdict and the ledger's rule. */
    const ask = (rel, tool = "Write") => {
      const env = { ...process.env, SHAPEUP_DECISIONS_PATH: ledger };
      const r = spawnSync("node", [GUARD], {
        encoding: "utf8", env,
        input: JSON.stringify({ tool_name: tool, cwd: ws, tool_input: { file_path: join(ws, rel) } }),
      });
      let rule = null;
      try { const rows = readFileSync(ledger, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l)); rule = rows.length ? rows[rows.length - 1].rule : null; } catch { /* no ledger yet */ }
      return { verdict: (r.stdout || "").includes('"permissionDecision":"deny"') ? "deny" : "allow", rule };
    };
    const expect = (label, rel, verdict, rule, tool) => {
      const got = ask(rel, tool);
      if (got.verdict === verdict && (rule === undefined || got.rule === rule)) ok(`${label}: ${verdict}${rule ? `, rule "${rule}"` : ""}`);
      else fail(`${label}: expected ${verdict}${rule ? `/"${rule}"` : ""}, got ${got.verdict}/"${got.rule}"`);
    };
    const open1 = (payload) => sh("compile", ["--operation", "plan", "--slug", SLUG, "--cwd", ws, "--payload", JSON.stringify(payload)]);
    const orderOf = (step) => JSON.parse(readFileSync(join(ws, ".shapeup", SLUG, "orders", `plan-${step}.json`), "utf8"));
    const spec = `shapeup/${SLUG}`;

    // ---- before any plan order: the state the fence exists to end ----------------------------------------
    expect("(before) no order is live, so a write to the project profile is not watched", `${spec}/project-profile.md`, "allow", "no-round");

    // ---- the order itself -----------------------------------------------------------------------------------
    const bad = open1({ step: "bogus" });
    if (bad.status === 2) ok("compile --operation plan with a step outside requirements|spec|wire|scopes exits 2 and writes no order");
    else fail(`a bogus plan step exited ${bad.status}, not 2`);
    if (!existsSync(join(ws, ".shapeup", SLUG, "orders", "plan-bogus.json"))) ok("…and no order file exists for it");
    else fail("a bogus plan step left an order behind");
    const noStep = open1({});
    if (noStep.status === 2) ok("a plan order with no step exits 2 — the step is what the fence is stamped from");
    else fail(`a plan order with no step exited ${noStep.status}, not 2`);
    const wrongMode = open1({ step: "wire", mode: "board-only" });
    if (wrongMode.status === 2) ok("payload.mode is for the spec step only — wire with a mode exits 2");
    else fail(`wire with a mode exited ${wrongMode.status}, not 2`);

    const wire = open1({ step: "wire" });
    if (wire.status !== 0) { fail(`compile --operation plan (wire) exited ${wire.status}: ${wire.stderr}`); return; }
    const o = orderOf("wire");
    if (o.order_id === `${SLUG}/plan-wire` && o.worker === "building" && o.operation === "plan") ok("the order is `<slug>/plan-wire`, addressed to `building`, operation plan");
    else fail(`unexpected order identity: ${JSON.stringify({ id: o.order_id, w: o.worker, op: o.operation })}`);
    if (o.mode === "standalone") ok("the order is mode standalone, so ingest asks it for no dispatch receipt (nothing was dispatched)");
    else fail(`a plan order is mode ${o.mode}; ingest would demand a receipt for a dispatch that never happened`);
    if (Array.isArray(o.payload.kb_rules_paths) && ["plan", "ba-pitch-analyzer", "scope-architect", "solution-architect"].every((n) => o.payload.kb_rules_paths.includes(`shapeup/knowledge-base/${n}.md`))) {
      ok("the order carries all four knowledge-base paths the planning activity reads, so a consumer's old rules reach it");
    } else fail(`kb_rules_paths is ${JSON.stringify(o.payload.kb_rules_paths)}`);
    if (!(o.substrate.own || []).length) ok("the order names no `own` path: nothing the loop's edit tool writes may answer it");
    else fail(`a plan order names own paths ${JSON.stringify(o.substrate.own)} — the loop could write the result that lifts its own fence`);

    // ---- the fence, per the wire substep ---------------------------------------------------------------------
    expect("(wire) a Write to the staged pitch", ".shapeup/demo/intake.md", "deny", "frozen");
    expect("(wire) a Write to the project profile", `${spec}/project-profile.md`, "deny", "frozen");
    expect("(wire) a Write to the order itself", ".shapeup/demo/orders/plan-wire.json", "deny", "frozen");
    expect("(wire) a Write that forges the result which would lift the fence", ".shapeup/demo/results/plan-wire.json", "deny", "frozen");
    expect("(wire) a Write to the leg ledger", ".shapeup/demo/legs.jsonl", "deny", "frozen");
    expect("(wire) a Write to the dispatch receipts", ".shapeup/demo/receipts/dispatch.jsonl", "deny", "frozen");
    expect("(wire) a Write to a spec core file", `${spec}/spec/domain-model.md`, "deny", "frozen");
    expect("(wire) a Write to a scope contract", `${spec}/scopes/alpha.md`, "deny", "frozen");
    expect("(wire) a Write to the registry, which belongs to another substep", `${spec}/requirements.md`, "deny", "outside-substrate");
    expect("(wire) a Write to product code", "src/engine.mjs", "deny", "outside-substrate");
    expect("(wire) a Write to the wiring map — the substep's own artifact", `${spec}/wiring-map.md`, "allow", "in-substrate");

    // ---- the close lifts it, and a close over nothing is recorded, not refused ---------------------------------
    const noMap = sh("reduce ingest", ["--order", join(ws, ".shapeup", SLUG, "orders", "plan-wire.json"), "--close-plan", "--cwd", ws]);
    const failedResult = JSON.parse(readFileSync(join(ws, ".shapeup", SLUG, "results", "plan-wire.json"), "utf8"));
    if (noMap.status === 0 && failedResult.status === "failed" && /no artifact on disk/.test(failedResult.deviations?.[0] ?? "")) {
      ok("closing a wire order over no wiring map is not refused: it records a failed result naming what is missing");
    } else fail(`a close over nothing: exit ${noMap.status}, result ${JSON.stringify(failedResult)}`);
    expect("(after the close) the fence is down: the project profile is not watched again", `${spec}/project-profile.md`, "allow", "no-order");
    const legRows = readFileSync(join(ws, ".shapeup", SLUG, "legs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    if (legRows.filter((r) => r.order_id === `${SLUG}/plan-wire`).length === 1) ok("the close left exactly one leg row — the single writer's mark");
    else fail(`leg rows for plan-wire: ${legRows.filter((r) => r.order_id === `${SLUG}/plan-wire`).length}`);

    // ---- re-opening: a new fence over the same name, the old result retired -------------------------------------
    const again = open1({ step: "wire" });
    if (again.status === 0 && !existsSync(join(ws, ".shapeup", SLUG, "results", "plan-wire.json"))) ok("re-opening the substep retires the previous close's result — it must not read as an answer to the new opening");
    else fail("re-opening left the previous result in place");
    expect("(re-opened) the fence is up again over the same order name", `${spec}/project-profile.md`, "deny", "frozen");
    put(`${spec}/wiring-map.md`, "---\nschema_version: 1\n---\n\n## Wiring\n");
    const closed = sh("reduce ingest", ["--order", join(ws, ".shapeup", SLUG, "orders", "plan-wire.json"), "--close-plan", "--cwd", ws]);
    const doneResult = JSON.parse(readFileSync(join(ws, ".shapeup", SLUG, "results", "plan-wire.json"), "utf8"));
    if (closed.status === 0 && doneResult.status === "done" && doneResult.artifacts.includes(`${spec}/wiring-map.md`) && doneResult.worker === "building") {
      ok("a close over the wiring map records a done result naming it, from the files");
    } else fail(`close over the map: exit ${closed.status}, ${JSON.stringify(doneResult)}`);
    const twice = sh("reduce ingest", ["--order", join(ws, ".shapeup", SLUG, "orders", "plan-wire.json"), "--close-plan", "--cwd", ws]);
    const rowsNow = readFileSync(join(ws, ".shapeup", SLUG, "legs.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.order_id === `${SLUG}/plan-wire`);
    if (twice.status === 0 && rowsNow.length === 2) ok("closing an opening twice is a no-op: two openings, two leg rows, never three");
    else fail(`a second close: exit ${twice.status}, ${rowsNow.length} leg rows for two openings`);
    const closeStep = (step) => sh("reduce ingest", ["--order", join(ws, ".shapeup", SLUG, "orders", `plan-${step}.json`), "--close-plan", "--cwd", ws]);

    // ---- every substep has a contract of its own ----------------------------------------------------------------
    open1({ step: "scopes" });
    expect("(scopes) a Write to a scope contract", `${spec}/scopes/alpha.md`, "allow", "in-substrate");
    expect("(scopes) a Write to the scope board", `${spec}/scope-board.md`, "allow", "in-substrate");
    expect("(scopes) a Write to the wiring map, now frozen", `${spec}/wiring-map.md`, "deny", "outside-substrate");
    expect("(scopes) a Write to a board task", ".shapeup/demo/tasks/TASK-001.md", "deny", "frozen");
    expect("(scopes) a Write to the staged breadboard", ".shapeup/demo/breadboard.md", "deny", "frozen");
    closeStep("scopes");
    open1({ step: "requirements" });
    expect("(requirements) a Write to the registry", `${spec}/requirements.md`, "allow", "in-substrate");
    expect("(requirements) a Write to a use case", `${spec}/spec/usecases/UC-01.md`, "deny", "outside-substrate");
    closeStep("requirements");
    open1({ step: "spec" });
    expect("(spec, full) a Write to the domain model", `${spec}/spec/domain-model.md`, "allow", "in-substrate");
    expect("(spec, full) a Write to a board task", ".shapeup/demo/tasks/TASK-001.md", "allow");
    expect("(spec, full) a Write to the wiring map", `${spec}/wiring-map.md`, "deny", "outside-substrate");
    expect("(spec, full) a Write to the staged pitch", ".shapeup/demo/intake.md", "deny", "frozen");
    closeStep("spec");
    open1({ step: "spec", mode: "board-only" });
    expect("(spec, board-only) a Write to a use case — the tree is committed and frozen", `${spec}/spec/usecases/UC-01.md`, "deny", "frozen");
    expect("(spec, board-only) a Write to a board task", ".shapeup/demo/tasks/TASK-001.md", "allow");
    closeStep("spec");
    open1({ step: "spec", mode: "retrofit-surface" });
    expect("(spec, retrofit-surface) a Write to a use case file is outside the substrate — sections are not path-addressable", `${spec}/spec/usecases/UC-01.md`, "deny", "outside-substrate");
    expect("(spec, retrofit-surface) …and the domain model stays frozen", `${spec}/spec/domain-model.md`, "deny", "frozen");
    closeStep("spec");
    expect("(all closed) nothing is fenced any more", `${spec}/project-profile.md`, "allow", "no-order");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
