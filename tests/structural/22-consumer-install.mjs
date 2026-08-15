// Structural test module: Phase 1 seen from the user's project.
//
// WHY THIS IS ITS OWN MODULE. §43 proves the grant MATCHES the shipped call sites, and that the
// installer writes it on both install paths. Nothing then looks at the project it wrote into.
// Everything the v2.0 kernel consolidation promised a *user* is a property of that tree, and every
// one of these fails silently:
//
//   • the grant stays small — one entry point, two Bash rules, nothing accumulating beside them.
//     A settings.json carrying forty stale rules works exactly as well as a correct one.
//   • an UPGRADE from a v1.x install purges the rules that no longer grant anything. Merging
//     alongside them leaves a museum of dead grants in which nobody can tell which rule is live.
//   • `--no-native-workflow` REMOVES the token a previous install added. An opt-out that is a
//     no-op prints the same success line as one that works.
//   • the scaffolding is idempotent. init is re-run on every plugin upgrade; a second harness
//     block, a second import tag or a second ignore stanza all leave files that still read fine.
//   • the kernel the project was granted actually runs from that project, at its documented exit
//     codes — the contract Phase 1 moved 21 scripts under one entry point without changing.
//
// It runs the REAL installer into a temp project, with `claude` stripped from PATH so the fallback
// merge is what executes: that path is deterministic, needs no network, and writes the same grant
// (§43 covers the CLI path). Everything is then asserted against files on disk, never against the
// installer's own stdout — a script that prints "kernel permissions granted" and writes nothing is
// the exact defect this repo has already shipped once.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { mergePipelinePermissions, WORKFLOW_RULE } from "../../bin/lib/grant.mjs";

/** The rules the installer is expected to write — IMPORTED, never re-derived (§43's lesson). */
function generatedGrant({ nativeWorkflow = true } = {}) {
  const s = {};
  mergePipelinePermissions(s, { nativeWorkflow });
  return s.permissions.allow;
}

/** A PATH with the `claude` binary removed, which forces the installer's native-merge path. */
function pathWithoutClaude() {
  return (process.env.PATH || "").split(":").filter((d) => d && !existsSync(join(d, "claude"))).join(":");
}

/**
 * Run `bin/init.mjs` against a project directory.
 * @param {string} ROOT - Repo root.
 * @param {string} proj - The consumer project to install into.
 * @param {string[]} [extra] - Additional installer flags.
 * @returns {{status:number, stdout:string, stderr:string}} The spawn result.
 */
function install(ROOT, proj, extra = []) {
  const r = spawnSync(process.execPath, [join(ROOT, "bin/init.mjs"), "init", "-d", proj, "-y", ...extra], {
    cwd: proj, env: { ...process.env, PATH: pathWithoutClaude() }, encoding: "utf8", timeout: 60_000,
  });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

/**
 * Run one kernel subcommand from inside a project.
 * @param {string} ROOT - Repo root.
 * @param {string[]} argv - Verb words and flags.
 * @param {string} cwd - The project to run in.
 * @returns {{status:number, stdout:string, stderr:string}} The spawn result.
 */
function kernel(ROOT, argv, cwd) {
  const r = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...argv], {
    cwd, encoding: "utf8", timeout: 60_000,
  });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

/** The `permissions.allow` list a project ended up with, or null when it has none to read. */
function allowIn(proj) {
  const f = join(proj, ".claude", "settings.json");
  if (!existsSync(f)) return null;
  try { return JSON.parse(readFileSync(f, "utf8"))?.permissions?.allow ?? null; }
  catch { return null; }
}

/** A fresh consumer project: a git repo with a file in it, the way a user's would be. */
function newProject(label) {
  const box = mkdtempSync(join(tmpdir(), `consumer-${label}-`));
  const proj = join(box, "proj");
  mkdirSync(proj, { recursive: true });
  spawnSync("git", ["init", "-q"], { cwd: proj });
  writeFileSync(join(proj, "README.md"), "# My App\n");
  return { box, proj };
}

/** Occurrences of a literal marker in a file that may not exist. */
function countIn(file, marker) {
  if (!existsSync(file)) return -1;
  return readFileSync(file, "utf8").split(marker).length - 1;
}

/**
 * Run the consumer-install checks.
 * @param {object} ctx - Shared harness context (see tests/lib/harness.mjs).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("56. What `npx shapeup-sdlc init` leaves in a user's project, and whether the kernel runs there");
  // =============================================================================

  const WANT = generatedGrant();

  // ---------------------------------------------------------------------------------------------
  // (a) A FRESH INSTALL. The whole consumer-visible surface, asserted on disk.
  // ---------------------------------------------------------------------------------------------
  const fresh = newProject("fresh");
  try {
    const r = install(ROOT, fresh.proj);
    if (r.status !== 0) {
      fail(`bin/init.mjs exited ${r.status} on a fresh project: ${(r.stderr || r.stdout).slice(0, 240)}`);
    } else {
      ok("bin/init.mjs completes on a fresh project");

      // The grant, exactly. Not "contains the two rules" — §43 already asserts presence, and
      // presence cannot see accumulation. This is the Phase-1 property: what a project receives is
      // what the generator emits, and nothing has been added beside it.
      const allow = allowIn(fresh.proj);
      if (allow === null) {
        fail("the installed project has no readable .claude/settings.json — nothing was granted");
      } else {
        const got = [...allow].sort();
        const want = [...WANT].sort();
        if (got.length === want.length && got.every((x, i) => x === want[i])) {
          ok(`the project's allow-list is exactly the generated grant (${got.length} entries)`);
        } else {
          fail(`the project's allow-list is ${JSON.stringify(got)}, the generator emits ${JSON.stringify(want)}`);
        }

        // The ceiling. v1.x enumerated every pipeline script — two rules each, regenerated on every
        // add or rename and silently wrong whenever that was missed. One entry point means the
        // executable surface a user pre-approves is a constant a person can read by eye. The
        // non-Bash entry is the `Workflow` tool token, which grants no command.
        const bash = got.filter((x) => x.startsWith("Bash("));
        if (bash.length <= 2) ok(`the project pre-approves ${bash.length} Bash rule(s) over one entry point`);
        else fail(`the project pre-approves ${bash.length} Bash rules — the per-script sprawl the kernel consolidation removed is back`);

        const kernelOnly = bash.every((x) => x.includes("/kernel/harness.mjs"));
        if (kernelOnly) ok("every Bash rule a user receives names the kernel entry point and nothing else");
        else fail(`a granted Bash rule names something other than the kernel: ${bash.find((x) => !x.includes("/kernel/harness.mjs"))}`);
      }

      // The rest of the scaffolding. Each of these is a documented install outcome, and each is
      // load-bearing: without the harness block the model never reads the enforcement model,
      // without the import tag the block is never loaded, and without the ignore rules a run trace
      // gets committed — the mistake ADR-0001's tier split exists to prevent.
      for (const [file, marker, why] of [
        ["AGENTS.md", "<!-- HARNESS_START -->", "the harness block"],
        ["CLAUDE.md", "@AGENTS.md", "the import tag that loads it"],
        [".gitignore", ".shapeup/", "the run-workspace ignore rule"],
      ]) {
        const n = countIn(join(fresh.proj, file), marker);
        if (n > 0) ok(`${file} carries ${why}`);
        else fail(`${file} is missing ${why} (${n === -1 ? "file absent" : "marker absent"})`);
      }
      for (const p of [".claude/settings.local.example.json", ".env.shapeup.example", ".shapeup/metrics"]) {
        if (existsSync(join(fresh.proj, p))) ok(`${p} installed`);
        else fail(`${p} was not installed — the user cannot see or override what was configured`);
      }

      // ---------------------------------------------------------------------------------------
      // (b) IDEMPOTENCE. init is re-run on every plugin upgrade; a second block reads fine.
      // ---------------------------------------------------------------------------------------
      const second = install(ROOT, fresh.proj);
      if (second.status !== 0) {
        fail(`re-running bin/init.mjs exited ${second.status} — an upgrade cannot re-run the installer`);
      } else {
        const blocks = countIn(join(fresh.proj, "AGENTS.md"), "<!-- HARNESS_START -->");
        const tags = countIn(join(fresh.proj, "CLAUDE.md"), "@AGENTS.md");
        const stanzas = countIn(join(fresh.proj, ".gitignore"), "# Shape Up SDLC run workspace");
        if (blocks === 1) ok("a second install replaces the harness block rather than appending one");
        else fail(`AGENTS.md carries ${blocks} harness blocks after two installs`);
        if (tags === 1) ok("a second install does not duplicate the @AGENTS.md import tag");
        else fail(`CLAUDE.md carries ${tags} import tags after two installs`);
        if (stanzas === 1) ok("a second install does not duplicate the .gitignore stanza");
        else fail(`.gitignore carries ${stanzas} harness stanzas after two installs`);

        const again = [...(allowIn(fresh.proj) || [])].sort();
        if (again.length === WANT.length) ok("a second install leaves the allow-list the same size — grants do not accumulate");
        else fail(`the allow-list grew from ${WANT.length} to ${again.length} entries across two installs`);
      }
    }
  } finally { rmSync(fresh.box, { recursive: true, force: true }); }

  // ---------------------------------------------------------------------------------------------
  // (c) UPGRADE FROM v1.x. The rules the old installer wrote are dead — the v1.5–v1.8 prefix form
  // granted nothing at all, and the per-script glob form names scripts that no longer exist. They
  // are purged, not merged alongside. A rule the user wrote themselves is not the installer's to
  // touch, and losing it would be a worse bug than the one being fixed.
  // ---------------------------------------------------------------------------------------------
  const upgraded = newProject("upgrade");
  try {
    const DEAD = [
      'Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/tech-lead/scripts/:*)',
      'Bash(node "*/skills/tech-lead/scripts/init-run.mjs" *)',
      'Bash(node "*/skills/task-executor/scripts/t0-verify.mjs")',
    ];
    const MINE = "Bash(npm test)";
    mkdirSync(join(upgraded.proj, ".claude"), { recursive: true });
    writeFileSync(
      join(upgraded.proj, ".claude", "settings.json"),
      JSON.stringify({ permissions: { allow: [...DEAD, MINE] } }, null, 2),
    );

    const r = install(ROOT, upgraded.proj);
    const allow = new Set(allowIn(upgraded.proj) || []);
    if (r.status !== 0) {
      fail(`bin/init.mjs exited ${r.status} upgrading a v1.x project: ${(r.stderr || r.stdout).slice(0, 240)}`);
    } else {
      const survivors = DEAD.filter((x) => allow.has(x));
      if (survivors.length === 0) ok(`upgrading purges all ${DEAD.length} superseded v1.x rules`);
      else fail(`upgrading left ${survivors.length} dead rule(s) in the user's settings: ${survivors[0]}`);

      if (allow.has(MINE)) ok("upgrading preserves a rule the user wrote themselves");
      else fail(`upgrading deleted the user's own "${MINE}" rule — the installer owns its rules, not the file`);

      const missing = WANT.filter((x) => !allow.has(x));
      if (missing.length === 0) ok("upgrading writes the current kernel grant");
      else fail(`upgrading did not write ${missing.length} current rule(s): ${missing[0]}`);
    }

    // ---------------------------------------------------------------------------------------
    // (d) THE OPT-OUT IS REAL. `Workflow` is unscoped — it authorises every dynamic workflow
    // script in the project, not only this plugin's — so declining it has to actually remove a
    // token an earlier install added, in the file the user already has.
    // ---------------------------------------------------------------------------------------
    if (allow.has(WORKFLOW_RULE)) {
      ok(`the default install grants "${WORKFLOW_RULE}" (the unattended lane needs it)`);
      const off = install(ROOT, upgraded.proj, ["--no-native-workflow"]);
      const afterOff = new Set(allowIn(upgraded.proj) || []);
      if (off.status !== 0) fail(`bin/init.mjs --no-native-workflow exited ${off.status}`);
      else if (afterOff.has(WORKFLOW_RULE)) fail(`--no-native-workflow left "${WORKFLOW_RULE}" granted — the documented opt-out is a no-op`);
      else ok(`--no-native-workflow removes "${WORKFLOW_RULE}" from a project that already had it`);

      const kernelRules = generatedGrant({ nativeWorkflow: false });
      if (kernelRules.every((x) => afterOff.has(x))) ok("declining the Workflow token leaves the kernel grant intact — the harness still runs interactively");
      else fail("declining the Workflow token also dropped the kernel grant — the opt-out disables the harness");

      const back = install(ROOT, upgraded.proj);
      if (back.status === 0 && new Set(allowIn(upgraded.proj) || []).has(WORKFLOW_RULE)) {
        ok(`re-running init without the flag restores "${WORKFLOW_RULE}"`);
      } else {
        fail(`re-running init without --no-native-workflow did not restore "${WORKFLOW_RULE}" — the opt-out is one-way`);
      }
    } else {
      fail(`the default install did not grant "${WORKFLOW_RULE}"`);
    }
  } finally { rmSync(upgraded.box, { recursive: true, force: true }); }

  // ---------------------------------------------------------------------------------------------
  // (e) THE SUBTRACTION ITSELF, on the filesystem. §12 checks that shipped prose points at nothing
  // repo-only, which stays true of a tree that still ships per-skill script directories. This is
  // the other half: after the kernel consolidation there is no `scripts/` directory left in
  // anything a user receives, so there is nothing for a permission rule to have to enumerate.
  // ---------------------------------------------------------------------------------------------
  {
    const shipped = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).files || [];
    const strays = [];
    const walk = (abs, rel) => {
      for (const e of readdirSync(abs, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        const r = `${rel}/${e.name}`;
        if (e.name === "scripts") strays.push(r);
        else walk(join(abs, e.name), r);
      }
    };
    for (const entry of shipped) {
      const clean = entry.replace(/\/$/, "");
      const abs = join(ROOT, clean);
      if (existsSync(abs) && statSync(abs).isDirectory()) walk(abs, clean);
    }
    if (strays.length === 0) ok("no shipped directory contains a scripts/ folder — one entry point is the whole executable surface");
    else fail(`${strays.length} shipped scripts/ director(ies) survive the kernel consolidation: ${strays.join(", ")}`);
  }

  // ---------------------------------------------------------------------------------------------
  // (f) THE KERNEL RUNS FROM THE INSTALLED PROJECT, at the exit codes the orchestrator branches on.
  // Phase 1 moved 21 scripts under one entry point and promised the exit-code contract came across
  // unchanged. A subcommand that has quietly started exiting 1 where it exited 6 still prints a
  // perfectly good JSON report, and the branch above it takes the wrong arm in silence.
  // ---------------------------------------------------------------------------------------------
  const ran = newProject("kernel");
  try {
    install(ROOT, ran.proj);
    const CASES = [
      { label: "an unknown verb is rejected before anything runs", argv: ["bogus"], want: 2 },
      { label: "init run opens a run", want: 0,
        argv: ["init", "run", "--intake-text", "add a health endpoint", "--slug", "probe",
               "--auto-level", "unattended", "--wall-clock-budget", "10"] },
      { label: "init run refuses to re-open a live run", want: 3,
        argv: ["init", "run", "--intake-text", "add a health endpoint", "--slug", "probe",
               "--auto-level", "unattended"] },
      { label: "a gate answered ask stops for the PO", want: 4,
        argv: ["gate", "--resolve", "L4", "--preset", "guarded", "--slug", "probe"] },
      { label: "the wall-clock breaker trips under --strict", want: 6,
        argv: ["verify", "budget", "--slug", "probe", "--at", "2099-01-01T00:00:00Z", "--strict"] },
      { label: "the same budget query without --strict reports rather than trips", want: 0,
        argv: ["verify", "budget", "--slug", "probe", "--at", "2099-01-01T00:00:00Z"] },
    ];
    for (const c of CASES) {
      const r = kernel(ROOT, c.argv, ran.proj);
      if (r.status === c.want) ok(`kernel ${c.argv.slice(0, 2).join(" ")}: ${c.label} (exit ${c.want})`);
      else fail(`kernel ${c.argv.slice(0, 2).join(" ")} exited ${r.status}, expected ${c.want} — ${c.label}: ${(r.stderr || r.stdout).slice(0, 160)}`);
    }

    // The receipt is the run's first act, and the only key that separates two runs of one feature.
    const receipt = join(ran.proj, ".shapeup", "probe", "receipt.json");
    if (!existsSync(receipt)) {
      fail("no receipt at .shapeup/<slug>/receipt.json — the run was never opened in the user's project");
    } else {
      let body = null;
      try { body = JSON.parse(readFileSync(receipt, "utf8")); } catch (e) { fail(`the receipt is not valid JSON: ${e.message}`); }
      if (body?.run_id) ok(`the run opened in the installed project and minted a run_id (${String(body.run_id).slice(0, 24)}…)`);
      else if (body) fail("the receipt carries no run_id — nothing downstream can key to this run");
    }
  } finally { rmSync(ran.box, { recursive: true, force: true }); }
}
