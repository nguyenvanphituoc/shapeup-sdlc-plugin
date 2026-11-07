// A breaker routed the run to GATE H, and GATE H happened after the run had closed: the loop
// returned `gate_h`, the close-out stamped `escalated` and retired the pointers, and the census,
// GATE H, the ship report and GATE L4 all ran afterwards in the tech lead's prose — so the census
// reached no artifact, `gates.jsonl` held no H and no L4, and a later `--close shipped` was refused
// over the `escalated` fact. Measured on three consumer runs. This module pins the census artifact
// the L4 resolver reads, and the workflow routing every breaker return through the census, H, the
// ship report and L4 BEFORE it closes.
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const WORKFLOW = join(ROOT, "skills/tech-lead/workflows/shapeup-run.js");

  section("138. GATE H and L4 happen inside the run — the census is an artifact, and a breaker ships what is green");

  // --- the census artifact is what L4 reads ---------------------------------------------------
  const { hammerCensus } = await import(join(ROOT, "kernel/lib/paths.mjs"));
  const ws = mkdtempSync(join(tmpdir(), "gate-h-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const opened = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    if (opened.status !== 0) { fail(`could not open a run: ${opened.stderr.slice(0, 200)}`); return; }
    const l4 = () => {
      const r = spawnSync("node", [KERNEL, "gate", "--resolve", "L4", "--slug", "f", "--preset", "ci"], { cwd: ws, encoding: "utf8" });
      try { return JSON.parse(r.stdout); } catch { return { raw: (r.stdout || r.stderr).slice(0, 200) }; }
    };
    const none = l4();
    if (none.decision === "ask" && none.refused === "ship") ok("with no census on disk, L4 --preset ci is narrowed to `ask` (refused: ship)");
    else fail(`L4 with no census resolved ${JSON.stringify(none)}`);

    const census = hammerCensus(ws, "f");
    mkdirSync(join(census, ".."), { recursive: true });
    writeFileSync(census, JSON.stringify({ schema_version: 1, order_id: "f/hammer", verdict: "ship-now", cut_list: [], ship_blocking: [], breaker: "outer", baseline: null }));
    const green = l4();
    if (green.decision === "ship") ok("with a census artifact saying ship-now, L4 --preset ci records `ship` — the artifact is the evidence the answer set needed");
    else fail(`L4 over a ship-now census resolved ${JSON.stringify(green)}`);

    writeFileSync(census, JSON.stringify({ schema_version: 1, order_id: "f/hammer", verdict: "cannot-ship", cut_list: ["x"], ship_blocking: ["must-have"], breaker: "outer", baseline: null }));
    const red = l4();
    if (red.decision === "ask" && red.refused === "ship" && red.census === "cannot-ship") ok("with a census saying cannot-ship, L4 refuses `ship` and names the census");
    else fail(`L4 over a cannot-ship census resolved ${JSON.stringify(red)}`);

    // THE CENSUS IS WRITTEN BY THE LOOP, WITH NO ORDER OF ITS OWN. It used to be the one path a hammer
    // order's substrate allowed; now the stop step names the same path and the loop's own edit tool
    // writes it, so the question is whether the real hook lets it. Driven through the real hook, with
    // the verdict AND the ledger's rule read back (a bare allow cannot tell "in the substrate" from
    // "nothing is watching").
    const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");
    const ledger = join(ws, "decisions.jsonl");
    const ask = (rel) => {
      const r = spawnSync("node", [GUARD], {
        encoding: "utf8", env: { ...process.env, SHAPEUP_DECISIONS_PATH: ledger },
        input: JSON.stringify({ tool_name: "Write", cwd: ws, tool_input: { file_path: join(ws, rel) } }),
      });
      let rule = null;
      try { const rows = readFileSync(ledger, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); rule = rows.at(-1)?.rule ?? null; } catch { /* no ledger yet */ }
      return { verdict: (r.stdout || "").includes('"permissionDecision":"deny"') ? "deny" : "allow", rule };
    };
    const rel = ".shapeup/f/reports/hammer-census.json";
    if (hammerCensus(ws, "f").endsWith(rel)) ok("the census path is the one the stop step writes (`reports/hammer-census.json` under the run's local root)");
    else fail(`the census path is ${hammerCensus(ws, "f")}`);
    const main = ask(rel);
    if (main.verdict === "allow") ok(`main path — no live order: the loop's write to the census path is allowed (rule "${main.rule}")`);
    else fail(`main path: the census write was denied (${main.rule})`);
    // The breaker path with a dead session's dispatch still open. Measured, and kept as a fact about the
    // fence rather than a goal: an unanswered `evaluate` order freezes the whole run trace, the census
    // path included, until something answers it. Re-dispatch answers it (the loop asks again before it
    // ever reaches the stop step); an order a dead session left that nothing re-dispatches does not.
    const live = kernel("compile", "--operation", "evaluate", "--slug", "f", "--round", "1");
    if (live.status !== 0) fail(`could not compile a live evaluate order: ${(live.stderr || live.stdout).slice(0, 200)}`);
    else {
      const stuck = ask(rel);
      if (stuck.verdict === "deny" && stuck.rule === "frozen") ok("an unanswered evaluate order still fences the census path (frozen) — a dead session's open dispatch must be answered before the stop step can write");
      else fail(`with an unanswered evaluate order the census write resolved ${stuck.verdict}/${stuck.rule}`);
      writeFileSync(join(ws, ".shapeup/f/results/evaluate-r1.json"), JSON.stringify({ schema_version: 1, order_id: "f/evaluate-r1", status: "failed" }));
      const lifted = ask(rel);
      if (lifted.verdict === "allow") ok("once the order is answered the census write is allowed again");
      else fail(`after the evaluate order was answered the census write resolved ${lifted.verdict}/${lifted.rule}`);
    }
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // --- the workflow: every breaker return goes through the census, H, the report and L4 -------
  const src = readFileSync(WORKFLOW, "utf8");
  const direct = (src.match(/withWarnings\(\{\s*status: "gate_h"/g) || []).length;
  const routed = (src.match(/settleAtGateH\(\{\s*status: "gate_h"/g) || []).length;
  if (/async function settleAtGateH\(/.test(src) && routed >= 4 && direct === 0) ok(`every breaker return (${routed}) is routed through settleAtGateH — none closes the run directly`);
  else fail(`breaker returns: ${routed} routed, ${direct} still closing directly — a gate_h that closes before the census recurs`);
  const fn = src.slice(src.indexOf("async function settleAtGateH("), src.indexOf("\n}\n", src.indexOf("async function settleAtGateH(")) + 3);
  const hammerAt = fn.indexOf('skill: "scope-hammer"'), hAt = fn.indexOf('crossGate("H"'), shipAt = fn.indexOf("reduce ship --slug"), l4At = fn.indexOf('crossGate("L4"'), closeAt = fn.indexOf('status: "shipped"');
  if (hammerAt !== -1 && hammerAt < hAt && hAt < shipAt && shipAt < l4At && l4At < closeAt) ok("inside settleAtGateH: census → GATE H → ship report → GATE L4 → close, in that order");
  else fail(`settleAtGateH's order is wrong (hammer@${hammerAt} H@${hAt} ship@${shipAt} L4@${l4At} shipped@${closeAt})`);
  if (/verdict === "pass" \? "PASS" : verdict === "fail" \? "FAIL" : "not-evaluated"/.test(fn)) ok("the breaker path ships the verdict AS IT IS — FAIL and not-evaluated included, never upgraded");
  else fail("the breaker path does not derive the ship verdict from the round's own verdict");
  if (!/qaFindings|qaRan/.test(fn)) ok("settleAtGateH reads neither qaFindings nor qaRan — both are declared after the loop that calls it");
  else fail("settleAtGateH reads a binding declared after the round loop — a temporal-dead-zone throw on the first breaker");
  const l4Sites = (src.match(/crossGate\("L4"/g) || []).length;
  if (l4Sites >= 2) ok(`GATE L4 has a deterministic call site on both the PASS path and the breaker path (${l4Sites})`);
  else fail(`GATE L4 has ${l4Sites} call site(s) — a ship decision with no ledger row`);
  if (/hammer-census\.json/.test(src) && !/\.shapeup\/<slug>\/reports/.test(src)) ok("every hammer dispatch is told to write the census artifact, by a path relative to the order's substrate");
  else fail("the hammer brief does not name the census artifact, or names it by a hardcoded storage root");
  const skill = readFileSync(join(ROOT, "skills/building/resources/stop.md"), "utf8");
  if (/hammer-census\.json/.test(skill) && /HammerCensus/.test(skill)) ok("the stop resource documents the census artifact and its schema name");
  else fail("skills/building/resources/stop.md does not document the census artifact");
}
