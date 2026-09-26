// TWO FIRST LINES THAT USED TO SAY THE WRONG THING.
//
// 1. THE ENVIRONMENT WAS DISCOVERED AFTER PLANNING. A missing package install, a missing local SDK
//    pointer, a probe outside the grant and a device that was not attached each surfaced at the first
//    round build gate — after most of an hour of planning. `verify build --preflight` runs the same
//    declared steps once, before anything dispatches, and writes nothing: a preflight read back as
//    round 0's gate would reach round 1's orders as bugs. A probe that exits 2 could not run, which
//    is an environment gap, and is reported apart from a red step.
//
// 2. A SHIPPED FAIL READ LIKE A PASS. A run whose verdict failed can ship through GATE H's baseline
//    comparison, and its report put the verdict in a table cell under the title. The report now
//    opens with a line naming the verdict and the cut list that cleared it — and says nothing for a
//    PASS.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Run the preflight and ship-headline checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const { classifyPreflight } = await import(join(ROOT, "kernel/verify/build.mjs"));
  const { shipHeadline, buildReport } = await import(join(ROOT, "kernel/reduce/ship.mjs"));

  section("154. A preflight runs the build and launch probes once and writes nothing; a shipped FAIL says so first");

  const roots = [];
  const project = (build, launch) => {
    const d = mkdtempSync(join(tmpdir(), "preflight-")); roots.push(d);
    const lines = ["---", "schema_version: 1", "archetype: mobile", "entry_point: src/app/Entry.ets"];
    if (build !== undefined) lines.push(`build_probe: "${build}"`);
    if (launch !== undefined) lines.push(`launch_probe: "${launch}"`);
    lines.push("---", "", "# profile", "");
    const p = join(d, "shapeup/demo/project-profile.md");
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, lines.join("\n"));
    return d;
  };
  const verify = (cwd, ...flags) => {
    const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "verify", "build", "--slug", "demo", ...flags, "--cwd", cwd], { encoding: "utf8" });
    let out = {}; try { out = JSON.parse(r.stdout); } catch { /* reported by the caller */ }
    return { exit: r.status, out, stderr: r.stderr };
  };
  const buildDir = (cwd) => join(cwd, ".shapeup/demo/build");
  const wroteNothing = (cwd) => !existsSync(buildDir(cwd)) || readdirSync(buildDir(cwd)).length === 0;

  try {
    // --- (a) the classifier -------------------------------------------------------------------
    const cls = [
      classifyPreflight({ steps: [{ kind: "build_probe", exit: 0, pass: true }, { kind: "launch_probe", exit: 0, pass: true }] }).status,
      classifyPreflight({ steps: [{ kind: "build_probe", exit: 1, pass: false }, { kind: "launch_probe", skipped: true }] }).status,
      classifyPreflight({ steps: [{ kind: "build_probe", exit: 0, pass: true }, { kind: "launch_probe", exit: 2, pass: false }] }).status,
    ];
    if (JSON.stringify(cls) === JSON.stringify(["green", "red", "cannot-run"])) ok("classifyPreflight reads green, red, and a probe that exited 2 as could-not-run");
    else fail(`classifyPreflight returned ${JSON.stringify(cls)}`);

    // --- (b) each outcome, through the real CLI, and nothing written ---------------------------
    const g = project("exit 0", "exit 0"); const vg = verify(g, "--preflight");
    if (vg.exit === 0 && vg.out.status === "green" && vg.out.preflight === true && wroteNothing(g)) ok("a green preflight exits 0 and writes no gate artifact");
    else fail(`green preflight: exit ${vg.exit} ${JSON.stringify(vg.out)} wroteNothing=${wroteNothing(g)}`);

    const r = project("echo boom >&2; exit 1", "exit 0"); const vr = verify(r, "--preflight");
    if (vr.exit === 1 && vr.out.status === "red" && vr.out.failed_step === "build_probe" && /boom/.test(vr.out.stderr_tail || "") && wroteNothing(r)) {
      ok("a red build probe exits 1, names the step and carries its output, and writes nothing");
    } else fail(`red preflight: exit ${vr.exit} ${JSON.stringify(vr.out)}`);

    const c = project("exit 0", "echo no device >&2; exit 2"); const vc = verify(c, "--preflight");
    if (vc.exit === 4 && vc.out.status === "cannot-run" && vc.out.failed_step === "launch_probe" && wroteNothing(c)) {
      ok("a launch probe that could not run exits 4 — an environment gap, apart from a red build");
    } else fail(`cannot-run preflight: exit ${vc.exit} ${JSON.stringify(vc.out)}`);

    const n = project(); const vn = verify(n, "--preflight");
    if (vn.exit === 3 && vn.out.status === "undeclared" && wroteNothing(n)) ok("nothing declared is exit 3 and 'undeclared', never green");
    else fail(`undeclared preflight: exit ${vn.exit} ${JSON.stringify(vn.out)}`);

    // --- (c) the round gate is unchanged: it still writes, and needs its round -----------------
    const rg = verify(g, "--round", "1");
    if (rg.exit === 0 && existsSync(join(buildDir(g), "r1-t1.json"))) ok("the round gate still writes r<N>-t<T>.json (non-regression)");
    else fail(`the round gate no longer writes its artifact: exit ${rg.exit}`);
    const neither = verify(g); const both = verify(g, "--round", "1", "--preflight");
    if (neither.exit === 2 && both.exit === 2) ok("verify build refuses neither and both of --round / --preflight");
    else fail(`argv: neither exit ${neither.exit}, both exit ${both.exit}`);

    // --- (d) the ship headline --------------------------------------------------------------
    if (shipHeadline("PASS", { verdict: "ship-now", cut_list: [] }) === null) ok("a PASS ship gets no headline — the title stands alone");
    else fail("a PASS ship grew a warning headline");
    const h = shipHeadline("FAIL", { verdict: "ship-after-fixes", cut_list: [1, 2, 3] });
    if (/Shipped with a FAIL verdict/.test(h) && /3 items cut/.test(h) && /ship-after-fixes/.test(h)) ok("a shipped FAIL names the verdict, the census and the number of items cut");
    else fail(`FAIL headline: ${h}`);
    const h1 = shipHeadline("FAIL", { cut_list: [1] });
    if (/1 item cut/.test(h1)) ok("one cut item reads '1 item', not '1 items'");
    else fail(`singular: ${h1}`);
    const hn = shipHeadline("not-evaluated", null);
    if (/without a passing verdict \(not-evaluated\)/.test(hn) && /no GATE H census/.test(hn) && !/criterion passed/.test(hn.replace("No criterion was graded as passing", ""))) {
      ok("a ship with no verdict does not claim criteria failed — it says none was graded, and that no census was on record");
    } else fail(`no-verdict headline: ${hn}`);
    if (![h, h1, hn].some((x) => /\.shapeup\/|TASK-\d/.test(x))) ok("no headline names a run-trace path or a board id — the report is committed");
    else fail("a headline carries a local-tier reference into a committed file");

    const base = { slug: "demo", at: "2026-09-26", qa: "run", rounds: 1, board: { done: 1, total: 1, unfinished: [] }, t0: [], artifacts: 0, ratchet: null };
    const failed = buildReport({ ...base, verdict: "FAIL", census: { verdict: "ship-now", cut_list: [1, 2] } }).split("\n");
    const t = failed.indexOf("# demo — ship report");
    if (t >= 0 && /^> \*\*Shipped with a FAIL verdict\.\*\*/.test(failed[t + 2] || "")) ok("in the report, the headline is the first thing under the title");
    else fail(`report opening: ${JSON.stringify(failed.slice(t, t + 4))}`);
    const passed = buildReport({ ...base, verdict: "PASS", census: null });
    if (!/Shipped with/.test(passed)) ok("a PASS report is unchanged — no headline");
    else fail("a PASS report carries the shipped-FAIL headline");
  } finally {
    for (const d of roots) rmSync(d, { recursive: true, force: true });
  }

  // =============================================================================
  section("155. A regenerated board gets its mechanical fields from the kernel — unlocks, and status: todo only where absent");
  // =============================================================================
  const { readFileSync } = await import("node:fs");
  const b = mkdtempSync(join(tmpdir(), "board-defaults-"));
  try {
    const task = (id, extra) => {
      const f = join(b, ".shapeup/demo/tasks", `${id}.md`);
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, ["---", `id: ${id}`, "type: task", "feature: demo", ...extra, "---", "", `# ${id}`, ""].join("\n"));
      return f;
    };
    const f1 = task("TASK-001", ["use_case_refs: [UC-01]", "depends_on: []"]);
    const f2 = task("TASK-002", ["use_case_refs: [UC-01]", "depends_on: [TASK-001]"]);
    const f3 = task("TASK-003", ["use_case_refs: [UC-01]", "status: done", "depends_on: [TASK-001]"]);
    const write = () => spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "reduce", "board", "--slug", "demo", "--write", "--cwd", b], { encoding: "utf8" });
    const r1 = write();
    const [t1, t2, t3] = [f1, f2, f3].map((f) => readFileSync(f, "utf8"));
    if (r1.status === 0 && /^status: todo$/m.test(t1) && /^status: todo$/m.test(t2)) ok("a task written with no status line gets status: todo");
    else fail(`status not defaulted (exit ${r1.status}): ${t1.split("\n").slice(0, 8).join(" / ")}`);
    if (/^status: done$/m.test(t3) && !/^status: todo$/m.test(t3)) ok("an existing status is never touched — a done task stays done");
    else fail(`an existing status was rewritten: ${t3.split("\n").slice(0, 8).join(" / ")}`);
    if (/^unlocks: \[TASK-002, TASK-003\]$/m.test(t1)) ok("unlocks is still derived as the inverse of depends_on");
    else fail(`unlocks not derived: ${t1.split("\n").slice(0, 8).join(" / ")}`);
    let out2 = {}; const r2 = write(); try { out2 = JSON.parse(r2.stdout); } catch { /* reported below */ }
    if (r2.status === 0 && Array.isArray(out2.unlocks_written) && out2.unlocks_written.length === 0) ok("a second --write changes nothing — the defaults are idempotent");
    else fail(`a second --write rewrote ${JSON.stringify(out2.unlocks_written)}`);
  } finally {
    rmSync(b, { recursive: true, force: true });
  }
}
