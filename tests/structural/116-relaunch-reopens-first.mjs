// A RELAUNCH OVER A CLOSED RUN REOPENS IT BEFORE ITS FIRST GATE.
//
// A run killed mid-BUILD was closed `aborted`, relaunched and shipped. The reopen was right, but it
// came from the first status write, and a launch that fast-forwards every planning phase makes that
// write only at BUILD — so L1a, L1a.5 and L1b were re-signed four minutes inside a window where the
// run's own record read closed, and the Decisions table listed each twice with nothing to tell a
// second launch from a double sign-off. The resume state now names the open close, the workflow
// reopens on it before any gate, and a row taken after a reopen says which launch took it.
import { mkdtempSync, rmSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pinnedBy } from "../lib/pinned-row.mjs";

/**
 * Run the relaunch-reopen checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { closeRun, setRunStatus } = await import(join(ROOT, "kernel/probe/resume.mjs"));
  const { readRunId } = await import(join(ROOT, "kernel/lib/paths.mjs"));

  section("170. A relaunch reopens a closed run before its first gate, and the ledger says which launch signed what");

  const w = mkdtempSync(join(tmpdir(), "relaunch-"));
  const K = (...a) => spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...a, "--cwd", w], { cwd: w, encoding: "utf8", timeout: 30_000 });
  const gatesFile = join(w, ".shapeup/checkout/gates.jsonl");
  const gateRow = (gate, at) => appendFileSync(gatesFile, JSON.stringify({ at, run_id: readRunId(w, "checkout"), gate, status: "ok",
    decision: "proceed", source: "preset:ci", note: "pre-approved", round: null }) + "\n");
  const resumeState = () => { try { return JSON.parse(K("probe", "resume", "--slug", "checkout").stdout); } catch { return {}; } };
  try {
    const o = K("init", "run", "--slug", "checkout", "--intake-text", "Add checkout flow", "--auto-level", "unattended");
    if (o.status !== 0) throw new Error(`init run failed: ${o.stderr}`);

    if (resumeState().closed_status === null) ok("an open run's resume state carries closed_status: null");
    else fail(`open run closed_status: ${JSON.stringify(resumeState().closed_status)}`);

    gateRow("L1a", "2000-01-01T00:00:01.000Z");
    closeRun(w, "checkout", { status: "aborted", cause: "killed mid-build" });
    if (resumeState().closed_status === "aborted") ok("a closed run's resume state names its close, so a relaunch can reopen it first");
    else fail(`closed run closed_status: ${JSON.stringify(resumeState().closed_status)}`);

    const re = setRunStatus(w, "checkout", "orienting");
    if (re.decision === "reopened" && resumeState().closed_status === null) ok("the reopen clears it before anything else is signed");
    else fail(`reopen: ${JSON.stringify(re)}`);
    // The close retired the run pointer; a resumed run without it keyed no hook row to itself.
    const { resolveRun } = await import(join(ROOT, "kernel/lib/paths.mjs"));
    const key = resolveRun(w);
    if (key.source === "pointer" && key.run_id === readRunId(w, "checkout")) ok("the reopen restores the run pointer, so the resumed run's hook rows carry its key");
    else fail(`after the reopen the hooks resolve ${JSON.stringify(key)}`);

    gateRow("L1a", new Date(Date.now() + 1000).toISOString());
    closeRun(w, "checkout", { status: "shipped", cause: "verdict=pass rounds=1" });
    const table = readFileSync(join(w, ".shapeup/checkout/harness-run.md"), "utf8").split("\n").filter((l) => l.startsWith("| L1a |"));
    if (table.length === 2 && !/launch \d/.test(table[0]) && /launch 2 \(after a reopen\)/.test(table[1])) {
      ok("the Decisions table marks the relaunch's re-signed gate as launch 2 and leaves the first launch's row plain");
    } else fail(`L1a rows: ${JSON.stringify(table)}`);

    // The loop reopens a closed run before it crosses a gate: `probe next` answers `reopen` over any run
    // whose close nobody has taken back, ahead of every gate step, and the loop's own instructions send a
    // relaunch to the resume, never to --force. (The run script that used to carry both is retired.)
    pinnedBy(ctx, ["a closed run is reopened on the record, not resumed over its close"],
      "a relaunch over a closed run reopens it on the record before any gate is shown");
    const skill = readFileSync(join(ROOT, "skills/building/SKILL.md"), "utf8");
    const intake = readFileSync(join(ROOT, "skills/building/resources/intake.md"), "utf8");
    if (/reopened on the record/.test(skill) && /only the PO asks for it/.test(intake) && !/if truly restarting/.test(skill + intake)) {
      ok("the loop tells a relaunch to resume (a close is reopened on the record), and leaves --force to the PO");
    } else fail("the loop's instructions no longer say that a relaunch resumes and that --force is the PO's");
  } finally {
    rmSync(w, { recursive: true, force: true });
  }
}
