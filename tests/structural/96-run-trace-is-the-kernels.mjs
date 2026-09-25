// The freeze on a build leg used to be a list of channels a defect had named: the staged pitch,
// then the receipts, the leg ledger and the T0 verdicts, then the board index. Each review found
// more of the same class — the trial ledger, the gate ledger, the round build gates, the graph,
// the run args, the run ledger itself — because a list that grows one defect at a time is not a
// boundary. The boundary is inverted now: the run trace is the kernel's, and `own` carries the
// short derived list of what a build leg authors.
//
// This module walks every entry a real run trace holds and asserts each one is on exactly one side
// of that line, and that the line is DERIVED (`.shapeup/<slug>/**`) rather than restated.
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

/** Every entry an archived run trace was observed to hold, and who authors it. */
const RUN_TRACE = [
  // A build leg authors these — its envelope, its task files, its ledger entries, its spikes.
  ["results/OWN.json", "author"],
  ["tasks/TASK-001.md", "author"],
  ["discovery/ledger.md", "author"],
  ["spikes/probe.md", "author"],
  // Everything else under there is the kernel's or the hook layer's.
  ["receipt.json", "kernel"],
  ["run-args.json", "kernel"],
  ["harness-run.md", "kernel"],
  ["intake.md", "kernel"],
  ["breadboard.md", "kernel"],
  ["legs.jsonl", "kernel"],
  ["gates.jsonl", "kernel"],
  ["graph.jsonl", "kernel"],
  ["receipts/dispatch.jsonl", "kernel"],
  ["orders/other-r1-a1.json", "kernel"],
  ["t0/verdicts/r1-a1-t1.json", "kernel"],
  ["t0/trials.jsonl", "kernel"],
  ["build/r1-t1.json", "kernel"],
  ["evaluation/EVAL-FEATURE-demo.md", "kernel"],
  ["reports/hammer-census.json", "kernel"],
  ["trace/report.json", "kernel"],
  ["orient/code-surface.md", "kernel"],
  ["tasks/_index.md", "kernel"],
  ["exports/run/leg.jsonl", "kernel"],
];

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");
  section("148. The run trace is the kernel's, except the four things a build leg authors");

  const { substrateFor } = await import(join(ROOT, "kernel/compile.mjs"));
  const { matchesAny } = await import(GUARD);

  // The freeze is derived, not listed: one glob over the run trace, which subsumes every channel
  // the earlier lists named. If a future edit reverts to a hand list, this reds.
  for (const op of ["execute", "fix", "spike"]) {
    const s = substrateFor(op, { slug: "demo", ownStem: "alpha-r1-a1" });
    const frozen = s.frozen || [];
    if (frozen.length === 1 && frozen[0] === ".shapeup/demo/**") ok(`substrateFor("${op}") freezes the run trace with one derived glob, not a list of channels`);
    else fail(`substrateFor("${op}") freezes a hand list again: ${JSON.stringify(frozen)}`);
    const subsumed = [".shapeup/demo/intake.md", ".shapeup/demo/breadboard.md", ".shapeup/demo/receipts/dispatch.jsonl",
      ".shapeup/demo/legs.jsonl", ".shapeup/demo/t0/verdicts/r1-a1-t1.json", ".shapeup/demo/tasks/_index.md"];
    const missed = subsumed.filter((p) => !matchesAny(p, frozen));
    if (!missed.length) ok(`substrateFor("${op}")'s freeze still covers every channel the old lists named (${subsumed.length})`);
    else fail(`the derived freeze lost: ${missed.join(", ")}`);
  }

  // --- through the real hook, against a real compiled order -------------------------------------
  const ws = mkdtempSync(join(tmpdir(), "run-trace-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    mkdirSync(join(ws, "shapeup/demo/scopes"), { recursive: true });
    for (const id of ["alpha", "beta"]) {
      writeFileSync(join(ws, `shapeup/demo/scopes/${id}.md`),
        ["---", "schema_version: 1", `scope_id: ${id}`, `title: ${id}`,
          "allowed_file_substrate: [\"src/**\"]", "e2e_verification_fixtures: [\"true\"]", "---", "", `# ${id}`, ""].join("\n"));
    }
    const compiled = spawnSync(process.execPath,
      [KERNEL, "compile", "--scope", join(ws, "shapeup/demo/scopes/alpha.md"), "--round", "1", "--attempt", "1", "--cwd", ws],
      { cwd: ws, encoding: "utf8" });
    if (compiled.status !== 0 || !existsSync(join(ws, ".shapeup/demo/orders/alpha-r1-a1.json"))) {
      fail(`could not compile a real build order (exit ${compiled.status}): ${(compiled.stderr || compiled.stdout).slice(0, 300)}`);
      return;
    }
    ok("compiled a real build order for scope alpha");

    const ask = (rel, tool = "Write") => {
      const payload = JSON.stringify({ tool_name: tool, cwd: ws, tool_input: { file_path: join(ws, rel), content: "x" } });
      const r = spawnSync(process.execPath, [GUARD], { encoding: "utf8", input: payload });
      return { denied: (r.stdout || "").includes('"permissionDecision":"deny"'), out: r.stdout || "" };
    };

    const wrong = [];
    for (const [entry, who] of RUN_TRACE) {
      const rel = `.shapeup/demo/${entry.replace("OWN", "alpha-r1-a1")}`;
      const { denied } = ask(rel);
      if (who === "author" && denied) wrong.push(`${rel} — a build leg authors it and the guard denied it`);
      if (who === "kernel" && !denied) wrong.push(`${rel} — the kernel writes it and the guard let the leg write it`);
    }
    if (!wrong.length) ok(`every one of the ${RUN_TRACE.length} run-trace entries falls on the right side of the line: 4 authored, ${RUN_TRACE.length - 4} the kernel's`);
    else fail(`the line is in the wrong place:\n  ${wrong.join("\n  ")}`);

    // Its own result lands; its own code lands; the run trace does not.
    if (!ask("src/app.ts").denied) ok("the scope's own code substrate is untouched by the run-trace freeze");
    else fail("freezing the run trace denied the scope its own source files");

    // --- HD-051, driven: two live orders, and what `own` can and cannot decide -------------------
    const compiled2 = spawnSync(process.execPath,
      [KERNEL, "compile", "--scope", join(ws, "shapeup/demo/scopes/beta.md"), "--round", "1", "--attempt", "1", "--cwd", ws],
      { cwd: ws, encoding: "utf8" });
    if (compiled2.status !== 0) { fail(`could not compile the sibling order: ${(compiled2.stderr || "").slice(0, 200)}`); return; }
    const sibling = ask(".shapeup/demo/results/beta-r1-a1.json");
    if (!sibling.denied) {
      ok("KNOWN, and recorded rather than claimed closed: with beta's order also live, a write to beta's "
        + "result is permitted — the guard sees a tool call, never which leg made it, so beta's own "
        + "exception answers for anyone. Closing that needs the ingest step to write the envelope "
        + "(see the register); `own` narrows the window to concurrently-live siblings, it does not shut it.");
    } else {
      fail("a sibling's result was denied — if this is now enforced, the register row and this "
        + "expectation are both stale and should be updated together, not silently");
    }
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
