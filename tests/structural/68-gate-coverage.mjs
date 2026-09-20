// 68 — HD-019: every gate id resolves SOMEWHERE, and the decision that crosses one is a record, not
// a memory (defect-sweep Stage 8, part 2 of 2). Sections: 109, 110, 111.
//
// THE DEFECT, measured. `GATE_IDS` (kernel/gate.mjs) names ten gates. `shapeup-run.js` calls
// `crossGate` for seven of them; L0 sits before the workflow's own range (it is pinned by the
// orchestrating SKILL, before `Workflow(...)` is ever invoked) and L4/COACH-1 after it ("this
// skill's own gate; the workflow never sees it" — SKILL.md's own words). No skill instruction ever
// called `harness gate --resolve` for any of the three, so a real run's ledger carried only
// `[L1a, L1a.5, L1b, …]` — never L0, L4 or COACH-1 — and the decision that actually SHIPPED the run
// left no row at all, while AGENTS.md makes exactly that the point: "Sign-off is a file … the
// decision's source is ledgered."
//
// WHAT THIS MODULE CAN AND CANNOT PROVE. The three missing calls now live in prose
// (`references/gates.md`, `skills/coach/SKILL.md`) rather than in the workflow script, because both
// L0 and L4/COACH-1 are explicitly outside the script's own range — see the file headers this
// module reads. A structural suite cannot execute prose. What it CAN do, and does: (a) prove every
// one of the ten ids has AT LEAST ONE call site, script or prose, so "the answer set is a superset
// of what any call site can emit" is checkable without hand-maintaining the roster twice; (b) prove
// the MECHANISM those call sites now invoke — `harness gate --resolve`, the export's gate_decision
// and build_gate tables — actually produces a ledgered, exported row when exercised exactly as the
// prose instructs. The prose being followed is not this suite's to prove; the prose having
// something real to call, and that call landing in the trace and the export, is.

import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section, read } = ctx;

  const { GATE_IDS, VALID_BY_GATE } = await import(join(ROOT, "kernel/gate.mjs"));

  // ===============================================================================================
  section("109. Every GATE_ID resolves somewhere — the script's own range, or the skill's prose");
  // ===============================================================================================
  {
    const workflowSrc = read(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"));
    const scriptIds = new Set([...workflowSrc.matchAll(/crossGate\("([^"]+)"/g)].map((m) => m[1]));

    // Every prose file that may resolve a gate outside the script's own range — L0 pins the run
    // before the script launches, L4/COACH-1 after it returns.
    const proseFiles = [
      "skills/tech-lead/SKILL.md",
      "skills/tech-lead/references/gates.md",
      "skills/coach/SKILL.md",
    ];
    const proseIds = new Set();
    for (const rel of proseFiles) {
      const text = read(join(ROOT, rel));
      for (const m of text.matchAll(/gate --resolve ([A-Za-z0-9.\-]+)/g)) proseIds.add(m[1]);
    }

    const allCovered = new Set([...scriptIds, ...proseIds]);
    const missing = GATE_IDS.filter((g) => !allCovered.has(g));
    if (!missing.length) {
      ok(`every one of the ${GATE_IDS.length} GATE_IDS (kernel/gate.mjs) has a call site — ${scriptIds.size} in the workflow script, ${proseIds.size} in the orchestrating skill's own prose`);
    } else {
      fail(`GATE_IDS names a gate no call site can emit: ${missing.join(", ")} — resolved by neither shapeup-run.js's crossGate nor any "gate --resolve" in ${proseFiles.join(", ")}`);
    }

    // The reverse direction: a call site naming an id GATE_IDS does not know about is a typo that
    // would resolve, get validated, and silently mean nothing (gate.mjs's own resolve() rejects an
    // unknown id at runtime — this just says the SOURCE agrees before that ever has to fire).
    const unknownScript = [...scriptIds].filter((g) => !GATE_IDS.includes(g));
    const unknownProse = [...proseIds].filter((g) => !GATE_IDS.includes(g));
    if (!unknownScript.length && !unknownProse.length) {
      ok("no call site (script or prose) names a gate id outside GATE_IDS — the roster and the call sites cannot drift apart silently");
    } else {
      fail(`a call site names an id GATE_IDS does not declare: script=[${unknownScript.join(", ")}] prose=[${unknownProse.join(", ")}]`);
    }

    // Specifically the three this stage closes — named so a regression here fails legibly rather
    // than as a generic "missing" entry in the list above.
    for (const gid of ["L0", "L4", "COACH-1"]) {
      if (scriptIds.has(gid) || proseIds.has(gid)) ok(`${gid} — the gate the workflow never sees — now has a call site`);
      else fail(`${gid} still has no call site anywhere — HD-019's own three`);
    }
  }

  // ===============================================================================================
  section("110. The mechanism L0/L4/COACH-1's prose now calls: a real ledger row, a real export row");
  // ===============================================================================================
  {
    const ws = mkdtempSync(join(tmpdir(), "gate-coverage-"));
    try {
      const init = spawnSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "init", "run",
        "--slug", "widgets", "--intake-text", "Add a widgets page", "--auto-level", "unattended", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 30_000 });
      if (init.status !== 0) throw new Error(`init run failed: ${init.stderr || init.stdout}`);

      // Exactly the call the prose now spells for L0 and L4 — --preset ci resolves both to
      // "proceed"/"ship" without a human, same as a real unattended lane.
      for (const gid of ["L0", "L4", "COACH-1"]) {
        const r = spawnSync(process.execPath, [
          join(ROOT, "kernel/harness.mjs"), "gate", "--resolve", gid,
          "--slug", "widgets", "--preset", "ci", "--cwd", ws,
        ], { cwd: ws, encoding: "utf8", timeout: 15_000 });
        if (r.status !== 0) fail(`gate --resolve ${gid} --preset ci exited ${r.status}: ${r.stderr || r.stdout}`);
      }

      const ledgerPath = join(ws, ".shapeup/widgets/gates.jsonl");
      const rows = readFileSync(ledgerPath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const gatesSeen = rows.map((r) => r.gate);
      if (["L0", "L4", "COACH-1"].every((g) => gatesSeen.includes(g))) {
        ok("(a) a run crossing L0, L4 and COACH-1 records a row for each — the decision that shipped the run is now ledgered, per AGENTS.md's own claim");
      } else fail(`(a) gates.jsonl is missing a row: saw [${gatesSeen.join(", ")}]`);

      const l4row = rows.find((r) => r.gate === "L4");
      if (l4row?.decision === "ship" && l4row?.source === "preset:ci") {
        ok("(a) the L4 row names the actual decision (ship) and its source (preset:ci), not a narrated summary");
      } else fail(`(a) the L4 row is malformed: ${JSON.stringify(l4row)}`);

      // --- (b) the export carries gate data — TABLES had nine entries and none was gate data -----
      const exp = spawnSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "report", "export", "--slug", "widgets", "--cwd", ws,
      ], { cwd: ws, encoding: "utf8", timeout: 15_000 });
      if (exp.status !== 0) throw new Error(`report export failed: ${exp.stderr || exp.stdout}`);
      const manifest = JSON.parse(exp.stdout);
      const gateTable = manifest.tables.find((t) => t.name === "gate_decision");
      if (gateTable && gateTable.rows === 3) {
        ok("(b) the export's gate_decision table carries all three rows — L0, L4 and COACH-1 included");
      } else fail(`(b) gate_decision table wrong: ${JSON.stringify(gateTable)}`);
      if (manifest.tables.find((t) => t.name === "build_gate")) {
        ok("(b) the export declares a build_gate table too — the round build gate ends a round exactly as EVAL does, and had none");
      } else fail("(b) no build_gate table in the manifest — TABLES and the manifest have drifted");

      // --- (c) the round build gate's own artifact reaches the export as a row, not just a file ---
      const buildDir = join(ws, ".shapeup/widgets/build");
      mkdirSync(buildDir, { recursive: true });
      writeFileSync(join(buildDir, "r1-t1.json"), JSON.stringify({
        round: 1, trial: 1, at: new Date().toISOString(), overall: "red", archetype: "web",
        steps: [{ kind: "run_cmd", pass: false }], warnings: ["fixture coverage warning"],
      }));
      const exp2 = spawnSync(process.execPath, [
        join(ROOT, "kernel/harness.mjs"), "report", "export", "--slug", "widgets", "--cwd", ws, "--out", join(ws, ".shapeup/exports2"),
      ], { cwd: ws, encoding: "utf8", timeout: 15_000 });
      if (exp2.status !== 0) throw new Error(`report export (2) failed: ${exp2.stderr || exp2.stdout}`);
      const manifest2 = JSON.parse(exp2.stdout);
      const bgTable = manifest2.tables.find((t) => t.name === "build_gate");
      if (bgTable?.rows === 1) ok("(c) a round build-gate artifact on disk becomes one build_gate export row");
      else fail(`(c) the round build-gate artifact did not reach the export: ${JSON.stringify(bgTable)}`);
    } finally { rmSync(ws, { recursive: true, force: true }); }
  }

  // ===============================================================================================
  section("111. VALID_BY_GATE answers L0/L4/COACH-1 the same way every other gate is answered");
  // ===============================================================================================
  {
    // The three gates this stage adds a call site for must already be first-class members of the
    // SAME answer-set contract every other gate uses (the ci/guarded/interactive presets, the
    // --file/--preset resolution order) — nothing about "the skill resolves this one" is a special
    // case at the schema level, only at the call-site level.
    const missingFromSchema = ["L0", "L4", "COACH-1"].filter((g) => !Array.isArray(VALID_BY_GATE[g]) || !VALID_BY_GATE[g].length);
    if (!missingFromSchema.length) {
      ok("L0, L4 and COACH-1 each have a real VALID_BY_GATE decision set — resolving them is not a special case bolted on beside the other seven");
    } else fail(`VALID_BY_GATE is missing a decision set for: ${missingFromSchema.join(", ")}`);
  }
}
