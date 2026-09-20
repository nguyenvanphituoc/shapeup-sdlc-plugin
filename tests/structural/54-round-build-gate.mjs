// 54 — the loop builds and launches the feature, hooks file under the project root, and ownership
// is a query.
//
// Five findings from one consumer run, each pinned here by executing the shipped code against a
// fixture rather than by reading what the docs say about it:
//
//   (a) `hooks/lib/decision.mjs#projectRoot` finds the project root above a sub-folder cwd, and a
//       bare `.shapeup/` directory (what a stray ledger creates) is NOT a marker.
//   (b) A hook fired from a sub-folder files its receipt in the ROOT ledger, and `sandbox-guard`
//       still DENIES an out-of-substrate write from that shell — it used to defer at `no-round`.
//   (c) `harness verify build` runs run_cmd → build_probe → launch_probe, stops at the first
//       failure, writes an immutable artifact, exits 3 with nothing declared, and warns on a
//       `mobile` profile with no launch_probe.
//   (d) `harness compile` turns a red gate into `payload.bugs` for the next round, addressed by the
//       files the tool's output names.
//   (e) `reduce hill` withholds DOWNHILL_EXECUTION from a T0-green verdict in a round whose gate is
//       red, and leaves a round with no gate artifact exactly as before.
//   (f) `harness probe owner` elects an owner from the contracts and reports an unowned seam.
//   (g) The workflow runs the gate before L2 and never dispatches EVAL over a red one; the
//       scope-hammer skill cites the probe for ownership claims.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/** Write a file (JSON object or raw string), creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

/** Run a kernel subcommand with SHAPEUP_DECISIONS_PATH left as the runner set it. */
function kernel(ROOT, argv, cwd) {
  return spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...argv], { cwd, encoding: "utf8", timeout: 60_000 });
}

/** Fire a hook with the runner's ledger redirect REMOVED — the root resolution is what is under test. */
function fire(ROOT, hook, payload, cwd) {
  const env = { ...process.env };
  delete env.SHAPEUP_DECISIONS_PATH;
  return spawnSync(process.execPath, [join(ROOT, "hooks", hook)], {
    input: JSON.stringify(payload), cwd, encoding: "utf8", timeout: 30_000, env,
  });
}

const SLUG = "gate-demo";

/**
 * A project fixture: a git boundary, one scope contract owning `src/app/**`, a run ledger with a
 * `run_cmd`, and (optionally) a project profile.
 */
function project(opts = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "struct-build-gate-"));
  mkdirSync(join(cwd, ".git"), { recursive: true });
  w(cwd, `shapeup/${SLUG}/scopes/app-shell.md`, [
    "---", "type: scope-contract", "scope_id: app-shell", `feature: ${SLUG}`,
    "topology_type: CHOWDER", "use_cases: [UC-01]",
    "allowed_file_substrate: [src/app/**, test/app/**]", "shared_substrate: []",
    "hill_phase: UPHILL_UNKNOWN", "e2e_verification_fixtures: [exit 0]", "---", "", "# app-shell", "",
  ].join("\n"));
  w(cwd, `shapeup/${SLUG}/scopes/pages.md`, [
    "---", "type: scope-contract", "scope_id: pages", `feature: ${SLUG}`,
    "topology_type: CHOWDER", "use_cases: [UC-02]",
    "allowed_file_substrate: [src/pages/**]", "shared_substrate: []",
    "hill_phase: UPHILL_UNKNOWN", "e2e_verification_fixtures: [exit 0]", "---", "", "# pages", "",
  ].join("\n"));
  w(cwd, "src/app/Entry.ets", "// entry\n");
  w(cwd, "src/pages/Index.ets", "// page\n");
  if (opts.runCmd !== null) {
    w(cwd, `.shapeup/${SLUG}/harness-run.md`, [
      "---", "type: harness-run", `feature: ${SLUG}`, `spec_folder: shapeup/${SLUG}/spec/`,
      `run_cmd: "${opts.runCmd ?? "exit 0"}"`, "status: building", "---", "", "# run", "",
    ].join("\n"));
  }
  if (opts.profile !== null) {
    const lines = ["---", "schema_version: 1", `archetype: ${opts.archetype || "mobile"}`, "entry_point: src/app/Entry.ets"];
    if (opts.buildProbe) lines.push(`build_probe: "${opts.buildProbe}"`);
    if (opts.launchProbe) lines.push(`launch_probe: "${opts.launchProbe}"`);
    lines.push("---", "", "# profile", "");
    w(cwd, `shapeup/${SLUG}/project-profile.md`, lines.join("\n"));
  }
  return cwd;
}

/**
 * Run the round-build-gate checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const boxes = [];
  const box = (...a) => { const c = project(...a); boxes.push(c); return c; };

  section("85. Hooks file under the project root they find above the shell — never under a sub-folder cwd");
  try {
    const { projectRoot } = await import(join(ROOT, "hooks/lib/decision.mjs"));
    const cwd = box();
    const deep = join(cwd, "app", "entry", "src", "main");
    mkdirSync(deep, { recursive: true });
    if (projectRoot(deep) === cwd) ok("projectRoot climbs from a nested folder to the git boundary");
    else fail(`projectRoot(${deep}) → ${projectRoot(deep)}, expected ${cwd}`);

    // A run pointer outranks the git boundary: a project nested in a larger repo files under itself.
    const nested = join(cwd, "packages", "app");
    w(nested, ".shapeup/active-scope", { slug: SLUG });
    if (projectRoot(join(nested, "src")) === nested) ok("a run pointer below the git boundary is the nearer root");
    else fail(`projectRoot preferred ${projectRoot(join(nested, "src"))} over the run pointer at ${nested}`);

    // A bare `.shapeup/` with only a stray ledger in it is NOT a marker — that is what strays create.
    const strayHome = join(cwd, ".shapeup", SLUG, "evidence");
    w(strayHome, ".shapeup/decisions.jsonl", "{}\n");
    if (projectRoot(join(strayHome, "deeper")) === cwd) ok("a bare .shapeup/ holding only a stray ledger does not stop the climb");
    else fail(`projectRoot stopped at a stray ledger: ${projectRoot(join(strayHome, "deeper"))}`);

    const orphan = mkdtempSync(join(tmpdir(), "struct-no-marker-"));
    boxes.push(orphan);
    const orphanDeep = join(orphan, "a", "b");
    mkdirSync(orphanDeep, { recursive: true });
    const got = projectRoot(orphanDeep);
    // No marker anywhere up the tree → the cwd itself (fail-open), unless the temp dir happens to
    // sit under a repository, in which case that boundary is the honest answer.
    if (got === orphanDeep || existsSync(join(got, ".git"))) ok("no marker → cwd unchanged (fail-open)");
    else fail(`projectRoot with no marker returned ${got}`);

    // (b) live: safety-spine fired from a sub-folder files in the ROOT ledger.
    const r = fire(ROOT, "safety-spine.mjs", { tool_name: "Bash", cwd: deep, tool_input: { command: "ls" } }, deep);
    const rootLedger = join(cwd, ".shapeup", "decisions.jsonl");
    const strayLedger = join(deep, ".shapeup", "decisions.jsonl");
    if (r.status === 0 && existsSync(rootLedger) && !existsSync(strayLedger)) ok("safety-spine fired from a sub-folder wrote its receipt to the project-root ledger, not a stray one");
    else fail(`safety-spine from a sub-folder: exit ${r.status}, root ledger ${existsSync(rootLedger)}, stray ledger ${existsSync(strayLedger)}\n${r.stderr}`);

    // (b) live: sandbox-guard fired from a sub-folder still fences.
    const orderPath = w(cwd, `.shapeup/${SLUG}/orders/r1-a1.json`, {
      schema_version: 1, order_id: `${SLUG}/r1-a1`, worker: "task-executor", mode: "orchestrated", operation: "execute",
      compiled_at: new Date().toISOString(),
      substrate: { allowed: ["src/app/**"], shared: [], append_only: [], frozen: [] },
      payload: { feature: SLUG },
    });
    w(cwd, ".shapeup/active-order", { slug: SLUG, order_path: orderPath });
    const denyOut = fire(ROOT, "sandbox-guard.mjs", { tool_name: "Edit", cwd: deep, tool_input: { file_path: join(cwd, "src/pages/Index.ets") } }, deep);
    if ((denyOut.stdout || "").includes('"permissionDecision":"deny"')) ok("sandbox-guard fired from a sub-folder still DENIES a write outside the live substrate (it used to defer at no-round)");
    else fail(`sandbox-guard from a sub-folder did not deny an out-of-substrate write:\n${denyOut.stdout}\n${denyOut.stderr}`);
    const allowOut = fire(ROOT, "sandbox-guard.mjs", { tool_name: "Edit", cwd: deep, tool_input: { file_path: join(cwd, "src/app/Entry.ets") } }, deep);
    if (!(allowOut.stdout || "").includes('"permissionDecision":"deny"')) ok("sandbox-guard fired from a sub-folder still ALLOWS an in-substrate write (globs match against the root, not the shell)");
    else fail(`sandbox-guard from a sub-folder denied an in-substrate write:\n${allowOut.stdout}`);

    // stats --hooks reports the stray ledger that already exists.
    const st = kernel(ROOT, ["probe", "stats", "--hooks", "--cwd", cwd, "--format", "json"], cwd);
    let strays = null;
    try { strays = JSON.parse(st.stdout).hooks?.stray_ledgers; } catch { /* fall through */ }
    if (Array.isArray(strays) && strays.some((s) => s.path.includes("evidence"))) ok("probe stats --hooks lists a stray decisions.jsonl outside the root");
    else fail(`probe stats --hooks did not report the stray ledger: ${st.stdout.slice(0, 300)} ${st.stderr.slice(0, 300)}`);
  } catch (e) { fail(`hook root resolution checks threw: ${e.stack || e}`); }

  section("86. The round build gate — run_cmd → build_probe → launch_probe, measured before EVAL");
  try {
    const { latestRoundBuild, declaredSteps } = await import(join(ROOT, "kernel/verify/build.mjs"));

    // Green: every step exits 0, artifact written, exit 0.
    const green = box({ runCmd: "exit 0", buildProbe: "exit 0", launchProbe: "exit 0" });
    const g = kernel(ROOT, ["verify", "build", "--slug", SLUG, "--round", "1", "--cwd", green], green);
    const gb = latestRoundBuild(green, SLUG, 1);
    if (g.status === 0 && gb?.overall === "green" && gb.steps.length === 3 && gb.steps.every((s) => s.pass)) ok("green gate: three steps ran and passed, artifact on disk, exit 0");
    else fail(`green gate: exit ${g.status}, artifact ${JSON.stringify(gb)?.slice(0, 200)}\n${g.stderr}`);

    // Red at the build: probes are NOT run (skipped), exit 1, digest carries the output.
    const red = box({ runCmd: "echo 'ERROR src/pages/Index.ets:1:1 cannot find name Foo' >&2; exit 2", buildProbe: "exit 0", launchProbe: "exit 0" });
    const r = kernel(ROOT, ["verify", "build", "--slug", SLUG, "--round", "1", "--cwd", red], red);
    const rb = latestRoundBuild(red, SLUG, 1);
    if (r.status === 1 && rb?.overall === "red" && rb.steps[0].kind === "run_cmd" && !rb.steps[0].pass && rb.steps[1].skipped && rb.steps[2].skipped) ok("red gate: run_cmd failed, both probes skipped, exit 1");
    else fail(`red gate: exit ${r.status}, artifact ${JSON.stringify(rb)?.slice(0, 300)}\n${r.stderr}`);
    if (rb?.steps?.[0]?.stderr_tail?.includes("cannot find name Foo")) ok("the failing step keeps its output tail for the digest and the next round's bug");
    else fail("the failing step lost its stderr tail");

    // Immutable: a second run of the same round lands beside the first.
    kernel(ROOT, ["verify", "build", "--slug", SLUG, "--round", "1", "--cwd", red], red);
    const files = readdirSync(join(red, ".shapeup", SLUG, "build")).sort();
    if (files.includes("r1-t1.json") && files.includes("r1-t2.json")) ok("a re-run of the gate for the same round writes a new ordinal, never over the first");
    else fail(`gate artifacts after two runs: ${files.join(", ")}`);

    // Red at the launch probe: run_cmd passed, launch failed → red; the failing step is the launch.
    const launchRed = box({ runCmd: "exit 0", launchProbe: "echo 'load page failed' >&2; exit 1" });
    const lr = kernel(ROOT, ["verify", "build", "--slug", SLUG, "--round", "2", "--cwd", launchRed], launchRed);
    const lrb = latestRoundBuild(launchRed, SLUG, 2);
    if (lr.status === 1 && lrb?.overall === "red" && lrb.steps.find((s) => s.kind === "launch_probe" && !s.pass)) ok("a launch probe that fails makes the round red even though the build passed");
    else fail(`launch-red gate: exit ${lr.status}, ${JSON.stringify(lrb)?.slice(0, 300)}`);

    // Mobile with no launch_probe: warned on stderr and in the artifact, every run.
    const mobile = box({ runCmd: "exit 0" });
    const m = kernel(ROOT, ["verify", "build", "--slug", SLUG, "--round", "1", "--cwd", mobile], mobile);
    const mb = latestRoundBuild(mobile, SLUG, 1);
    if (m.status === 0 && /launch_probe/.test(m.stderr) && (mb?.warnings || []).some((x) => /launch_probe/.test(x))) ok("a mobile profile with no launch_probe is warned about on stderr and in the artifact — the install/launch risk has a named gap");
    else fail(`mobile warning missing: exit ${m.status}, stderr ${m.stderr.slice(0, 200)}, warnings ${JSON.stringify(mb?.warnings)}`);
    const web = box({ runCmd: "exit 0", archetype: "web-service" });
    const wr = kernel(ROOT, ["verify", "build", "--slug", SLUG, "--round", "1", "--cwd", web], web);
    if (wr.status === 0 && !/launch_probe/.test(wr.stderr)) ok("a web-service profile with no launch_probe is not warned about (the warning is archetype-specific)");
    else fail(`web-service was warned about launch_probe: ${wr.stderr}`);

    // Nothing declared: exit 3, no artifact — never green.
    const bare = box({ runCmd: null, profile: null });
    const b = kernel(ROOT, ["verify", "build", "--slug", SLUG, "--round", "1", "--cwd", bare], bare);
    if (b.status === 3 && !existsSync(join(bare, ".shapeup", SLUG, "build"))) ok("nothing declared → exit 3 and no artifact (undeclared is not green)");
    else fail(`nothing declared: exit ${b.status}, build dir ${existsSync(join(bare, ".shapeup", SLUG, "build"))}`);
    const ds = declaredSteps(bare, SLUG);
    if (ds.steps.length === 0 && ds.warnings.some((x) => /run_cmd/.test(x))) ok("declaredSteps names the missing run_cmd as a warning");
    else fail(`declaredSteps on a bare project: ${JSON.stringify(ds)}`);

    // Fixtures that never invoke the build tool are named beside the verdict (advisory).
    const { buildTool } = await import(join(ROOT, "kernel/verify/build.mjs"));
    if (buildTool("cd app && DEVECO_SDK_HOME=/sdk /tools/hvigor/bin/hvigorw assembleHap --no-daemon") === "hvigorw" && buildTool("npm run build") === "npm") ok("buildTool reads the executable past cd/env prefixes");
    else fail(`buildTool: ${buildTool("cd app && DEVECO_SDK_HOME=/sdk /tools/hvigor/bin/hvigorw assembleHap")}, ${buildTool("npm run build")}`);
    const uncovered = box({ runCmd: "exit 0", archetype: "web-service" });
    w(uncovered, `shapeup/${SLUG}/scopes/app-shell.md`, readFileSync(join(uncovered, `shapeup/${SLUG}/scopes/app-shell.md`), "utf8").replace("e2e_verification_fixtures: [exit 0]", "e2e_verification_fixtures: [grep -q x src/app/Entry.ets]"));
    w(uncovered, `shapeup/${SLUG}/scopes/pages.md`, readFileSync(join(uncovered, `shapeup/${SLUG}/scopes/pages.md`), "utf8").replace("e2e_verification_fixtures: [exit 0]", "e2e_verification_fixtures: [fakebuild assemble --module pages]"));
    w(uncovered, `.shapeup/${SLUG}/harness-run.md`, readFileSync(join(uncovered, `.shapeup/${SLUG}/harness-run.md`), "utf8").replace('run_cmd: "exit 0"', 'run_cmd: "cd src && fakebuild assemble"'));
    const dsu = declaredSteps(uncovered, SLUG);
    if (dsu.warnings.some((x) => /scope app-shell: none of its 1 fixture\(s\) invoke fakebuild/.test(x)) && !dsu.warnings.some((x) => /scope pages:/.test(x))) ok("a scope whose fixtures never invoke the ledger's build tool is warned about; a scope whose fixtures do is not");
    else fail(`fixture coverage warnings: ${JSON.stringify(dsu.warnings)}`);

    section("87. A red gate is the next round's bug list, and moves no dot on the hill");
    const compile = await import(join(ROOT, "kernel/compile.mjs"));
    const bugs = compile.buildBugs(red, SLUG, 2);
    if (bugs.length === 1 && bugs[0].id === "BUILD-r1-run_cmd" && bugs[0].location === "src/pages/Index.ets") ok("buildBugs turns the failing run_cmd into one bug located at the file the compiler named");
    else fail(`buildBugs: ${JSON.stringify(bugs).slice(0, 400)}`);
    const addressed = compile.bugsForScope(bugs, "pages", compile.scopeSubstrates(red, SLUG));
    const notMine = compile.bugsForScope(bugs, "app-shell", compile.scopeSubstrates(red, SLUG));
    if (addressed.length === 1 && !addressed[0].unowned && notMine.length === 0) ok("the build bug is addressed to the scope whose substrate holds the cited file, and to no other");
    else fail(`addressing: pages=${JSON.stringify(addressed)} app-shell=${JSON.stringify(notMine)}`);
    if (compile.buildBugs(red, SLUG, 1).length === 0 && compile.buildBugs(green, SLUG, 2).length === 0) ok("round 1, and a round after a green gate, carry no build bugs");
    else fail("buildBugs produced entries for round 1 or after a green gate");
    const abs = compile.outputPaths(`error at ${join(red, "src/app/Entry.ets")}:3:1\n  at node_modules/x/y.js:1`, red);
    if (abs.length === 1 && abs[0] === "src/app/Entry.ets") ok("outputPaths strips the project root off an absolute path and drops a path that does not exist in the tree");
    else fail(`outputPaths: ${JSON.stringify(abs)}`);

    // A red round in which the gate failed compiles the scope's order as a fix carrying the bug.
    const co = kernel(ROOT, ["compile", "--scope", join(red, `shapeup/${SLUG}/scopes/pages.md`), "--round", "2", "--attempt", "1", "--cwd", red], red);
    let order = null;
    try { order = JSON.parse(readFileSync(join(red, ".shapeup", SLUG, "orders", "pages-r2-a1.json"), "utf8")); } catch { /* absent */ }
    if (order && order.operation === "fix" && (order.payload?.bugs || []).some((x) => x.id === "BUILD-r1-run_cmd")) ok("harness compile emits round 2 for the owning scope as a `fix` carrying the gate's bug");
    else {
      const dir = join(red, ".shapeup", SLUG, "orders");
      fail(`compile after a red gate: exit ${co.status}, orders ${existsSync(dir) ? readdirSync(dir).join(",") : "(none)"}, order ${JSON.stringify(order)?.slice(0, 300)}\n${co.stderr.slice(0, 400)}`);
    }

    // Hill: a green T0 in the red round does not move the dot; the same verdict in a round with
    // no gate artifact, or a green one, does.
    const { deriveHill } = await import(join(ROOT, "kernel/reduce/hill.mjs"));
    const t0 = (cwd, round) => w(cwd, `.shapeup/${SLUG}/t0/verdicts/r${round}-a1-t1.json`, {
      schema_version: 2, round, attempt: 1, trial: 1, scope_id: "pages", overall: "green",
      fixtures_green: true, db_probe_green: true, seesaw_green: true, regression: false,
      seesaw: { ran: false, pass: true, scopes_checked: [], failing: [] },
    });
    t0(red, 1);
    const hillRed = deriveHill(red, SLUG).find((s) => s.scope_id === "pages");
    if (hillRed?.phase === "UPHILL_SOLVED") ok("reduce hill: a T0-green in a round whose build gate is red stays UPHILL (the fixture did not test the build)");
    else fail(`hill over a red round: ${JSON.stringify(hillRed)}`);
    t0(green, 1);
    const hillGreen = deriveHill(green, SLUG).find((s) => s.scope_id === "pages");
    if (hillGreen?.phase === "DOWNHILL_EXECUTION") ok("reduce hill: the same T0-green in a round whose gate is green goes DOWNHILL");
    else fail(`hill over a green round: ${JSON.stringify(hillGreen)}`);
    t0(bare, 1);
    const hillBare = deriveHill(bare, SLUG).find((s) => s.scope_id === "pages");
    if (hillBare?.phase === "DOWNHILL_EXECUTION") ok("reduce hill: with no gate artifact at all, a T0-green counts exactly as before (non-regression)");
    else fail(`hill with no gate: ${JSON.stringify(hillBare)}`);
  } catch (e) { fail(`round build gate checks threw: ${e.stack || e}`); }

  section("88. probe owner — ownership is elected from the contracts, and an unowned seam is reported");
  try {
    const cwd = box();
    w(cwd, `shapeup/${SLUG}/wiring-map.md`, [
      "---", "schema_version: 1", `feature: ${SLUG}`, "entry_point: src/app/Entry.ets", "---", "",
      "## Wiring", "",
      "| use_case | engine | wiring_seam | entry_call_site | affordance |",
      "|---|---|---|---|---|",
      "| UC-01 | src/app/Entry.ets | init | src/app/Entry.ets — onCreate | app |",
      "| UC-02 | src/pages/Index.ets | route | src/startup/Assemble.ets — startup task | list |",
      "", ].join("\n"));
    const r = kernel(ROOT, ["probe", "owner", "--slug", SLUG, "--cwd", cwd], cwd);
    let rep = null;
    try { rep = JSON.parse(r.stdout); } catch { /* fall through */ }
    const row = (p) => rep?.paths?.find((x) => x.path === p);
    if (r.status === 0 && row("src/pages/Index.ets")?.owner === "pages" && row("src/app/Entry.ets")?.owner === "app-shell") ok("probe owner elects each wiring-map engine's owner from the contracts");
    else fail(`probe owner: exit ${r.status} ${r.stdout.slice(0, 300)} ${r.stderr.slice(0, 200)}`);
    if (rep?.unowned?.includes("src/startup/Assemble.ets") && row("src/startup/Assemble.ets")?.writers?.length === 0) ok("an entry call site no substrate covers is reported as an unowned seam");
    else fail(`unowned seam missing: ${JSON.stringify(rep?.unowned)}`);
    if (row("src/pages/Index.ets")?.exists === true && row("src/startup/Assemble.ets")?.exists === false && rep?.missing?.includes("src/startup/Assemble.ets")) ok("each row says whether the seam is on disk, and `missing` lists the ones the wiring names that nobody wrote");
    else fail(`exists/missing: ${JSON.stringify(rep?.paths?.map((p) => [p.path, p.exists]))} missing=${JSON.stringify(rep?.missing)}`);
    const one = kernel(ROOT, ["probe", "owner", "--slug", SLUG, "--cwd", cwd, "--path", "src/pages/Deep/X.ets", "--format", "table"], cwd);
    if (one.status === 0 && /src\/pages\/Deep\/X\.ets\s+pages/.test(one.stdout)) ok("--path answers for an arbitrary path (a glob match, not a file that must exist) and --format table renders it");
    else fail(`probe owner --path: ${one.stdout} ${one.stderr}`);
    const none = kernel(ROOT, ["probe", "owner", "--slug", "no-such-feature", "--cwd", cwd], cwd);
    if (none.status === 2) ok("probe owner refuses (exit 2) when there are no contracts to read — it never invents ownership");
    else fail(`probe owner with no contracts exited ${none.status}`);
  } catch (e) { fail(`probe owner checks threw: ${e.stack || e}`); }

  section("89. The workflow and the hammer skill are wired to the gate and the probe");
  try {
    const wf = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
    const gateAt = wf.indexOf("verify build --slug ${slug} --round ${round}");
    const l2At = wf.indexOf('crossGate("L2"');
    const evalAt = wf.indexOf('skill: "spec-evaluator"');
    if (gateAt > 0 && gateAt < l2At && l2At < evalAt) ok("shapeup-run.js runs `verify build` before GATE L2, and both before the EVAL dispatch");
    else fail(`gate ordering in shapeup-run.js: gate@${gateAt} L2@${l2At} eval@${evalAt}`);
    if (/build_gate:\s*buildGate/.test(wf) && /buildGate === "red"/.test(wf) && wf.indexOf('buildGate === "red"') < evalAt) ok("the L2/L3 blocks carry build_gate and a red gate is checked before the evaluator is dispatched");
    else fail("the workflow does not branch on a red build gate before EVAL");
    const hammer = readFileSync(join(ROOT, "skills/scope-hammer/SKILL.md"), "utf8");
    if (/probe owner/.test(hammer) && /H0\.0/.test(hammer)) ok("scope-hammer's census rule H0.0 cites `probe owner` for every ownership claim");
    else fail("scope-hammer SKILL.md does not require `probe owner` for ownership claims");
    const schema = JSON.parse(readFileSync(join(ROOT, "kernel/schemas/domain.schema.json"), "utf8"));
    const pp = schema.$defs.ProjectProfile.properties;
    if (pp.build_probe && pp.launch_probe && schema.$defs.RoundBuildVerdict) ok("the domain registry types build_probe, launch_probe and RoundBuildVerdict");
    else fail("domain.schema.json lacks the profile probes or RoundBuildVerdict");
  } catch (e) { fail(`wiring checks threw: ${e.stack || e}`); }

  for (const b of boxes) { try { rmSync(b, { recursive: true, force: true }); } catch { /* best effort */ } }
}
