// Structural test module: entry-point guards must survive a realistic install path.
//
// THE DEFECT THIS MODULE EXISTS FOR, and why every prior test missed it.
//
// Eighteen scripts and hooks gated their entire body on `import.meta.url` compared against a
// template literal of "file://" concatenated with process.argv[1]. That is false — body skipped, exit 0, no
// output — whenever the invoked path is not byte-identical to the resolved module URL. It is false
// under any symlinked directory (on macOS `/var` → `/private/var`, so every path under the system
// temp dir) and false for any path containing a space (`~/Library/Application Support/…`).
//
// The whole existing suite invoked scripts by their real, space-free repo path, where the guard
// happens to hold. So a defect that made `init-run.mjs` — GATE L0.1, the run's mandatory first
// call — a silent no-op was invisible to every check. On the benchmark it cost
// 82–120 turns before first write, $4.57–$10.36 per recovery session, and 0/3 gap closed.
//
// So this module does two things, and the second is the one that matters:
//
//   1. A GREP FLOOR. No file may reintroduce the fragile comparison. Cheap, and it catches a
//      copy-paste of the old idiom into a new script.
//   2. AN EXECUTION PROOF. Every entry point is actually run through a symlinked directory AND
//      through a directory whose name contains a space, and must behave identically to being run
//      by its real path. A guard is only correct if invoking it the awkward way still works, and
//      the only way to know that is to invoke it the awkward way.
//
// (2) is the mechanism; (1) is the reminder. Testing the shape of the code would have caught
// nothing here — the fragile line looked exactly like the idiomatic one it was copied from.

import { existsSync, mkdtempSync, mkdirSync, symlinkSync, cpSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

// ctx.walk collects only Markdown (it exists for the docs module). This one collects the code.
function walkMjs(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === "dist") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walkMjs(p, acc);
    else if (e.name.endsWith(".mjs")) acc.push(p);
  }
  return acc;
}

// Entry points that self-execute via a main guard. Each entry says how to invoke it with NO side
// effects and what proves the body ran, so the probe never depends on a real run being in flight.
//
// `expect: "stdout"`  — running it with no/insufficient args must SAY something (usage, refusal,
//                       or output). Silence is the failure mode being tested.
// `stdin`             — hooks read stdin; they must be fed something or they block forever.
const ENTRY_POINTS = [
  // Hooks. Every one of these is part of the enforcement layer, and every one was inert under a
  // symlinked install while still reporting success.
  { file: "hooks/gate-zerowork.mjs", stdin: "not json", expect: "exit0" },
  { file: "hooks/safety-spine.mjs", stdin: "not json", expect: "exit0" },
  { file: "hooks/sandbox-guard.mjs", stdin: "not json", expect: "exit0" },
  // The kernel. Since v2.0 the deterministic half of the harness has ONE entry point, so the guard
  // has one home — but each subcommand still has to reach its own refusal path through it, which is
  // what these probes assert. A correct guard produces a refusal on stderr/stdout and a non-zero
  // exit; a broken guard produces silence and exit 0.
  { file: "kernel/harness.mjs", args: ["init", "run"], label: "kernel init run", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["gate"], label: "kernel gate", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["verify", "t0"], label: "kernel verify t0", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["verify", "budget"], label: "kernel verify budget", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["verify", "trace"], label: "kernel verify trace", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["verify", "spec"], label: "kernel verify spec", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["init", "fit"], label: "kernel init fit", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["probe", "digest"], label: "kernel probe digest", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["reduce", "verdict"], label: "kernel reduce verdict", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["reduce", "ingest"], label: "kernel reduce ingest", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["reduce", "board"], label: "kernel reduce board", expect: "stdout" },
  { file: "kernel/harness.mjs", args: ["compile"], label: "kernel compile", expect: "stdout" },
  // `verify envelope` is a registered PreToolUse hook, so its probe is the sharpest one here: fed a
  // dispatch against a dangling order it must emit a `deny` decision. Under a broken guard it
  // emitted nothing, which reads as allow.
  { file: "kernel/harness.mjs", args: ["verify", "envelope"], label: "kernel verify envelope (hook mode)",
    stdin: JSON.stringify({ tool_name: "Skill",
      tool_input: { skill: "shapeup-sdlc-plugin:task-executor", args: "--order /nonexistent.json" } }),
    expect: "stdout" },
  // The oracles are what a contributor runs by hand, and a silent no-op there reads as
  // "contract passed".
  { file: "oracles/process-oracle.mjs", args: [], expect: "stdout" },
  { file: "oracles/test-oracle.mjs", args: [], expect: "stdout" },
  { file: "oracles/http-oracle.mjs", args: [], expect: "stdout" },
  { file: "oracles/snapshot-oracle.mjs", args: [], expect: "stdout" },
];


// Assembled from pieces on purpose: a literal here would make this file its own offender.
const FRAGILE = "file://$" + "{process.argv[1]}";

function invoke(scriptPath, spec, cwd) {
  const r = spawnSync("node", [scriptPath, ...(spec.args || [])], {
    encoding: "utf8", cwd,
    input: spec.stdin ?? "",
    timeout: 20_000,
  });
  return { status: r.status, out: `${r.stdout || ""}${r.stderr || ""}`, spawnError: r.error };
}

// Did the body run? For an `expect: "stdout"` entry, "it said something" is the signal — that is
// precisely what the broken guard suppressed. For a fail-open hook, silence is legitimate, so the
// signal is instead that it behaves IDENTICALLY by both paths (see the comparison below).
const spoke = (r) => r.out.trim().length > 0;

export async function run(ctx) {
  const { ROOT, ok, fail, section, read } = ctx;

  // =============================================================================
  section("11a. No entry point may use the fragile unresolved-path main guard");
  // =============================================================================
  // The one legitimate occurrence is inside is-main.mjs's own explanation of the bug.
  const HELPER = "kernel/lib/argv.mjs";
  const helperPath = join(ROOT, HELPER);
  if (existsSync(helperPath)) ok(`the shared guard exists (${HELPER})`);
  else fail(`missing ${HELPER} — the shared, symlink-safe main guard`);

  // THE RULE IS "ONE WAY TO ASK", not "avoid one broken spelling".
  //
  // The first version of this check grepped for the exact template-literal form, and that was too
  // narrow — it missed FIVE more files carrying a second, different, also-broken spelling:
  //
  //     const isMain = argv1 && resolve(argv1) === fileURLToPath(<this module's url>);
  //
  // (the originals name `process.argv[1]` and `import.meta.url` directly, on one line; paraphrased
  //  here so this comment is not itself flagged by the check below)
  //
  // `resolve()` normalises a path; it does NOT resolve symlinks (that is `realpathSync`). So this
  // form breaks under a symlinked directory exactly like the other one. It handles ENCODING
  // correctly, which is presumably why it reads as the careful version — and one of the five is
  // `validate-envelope.mjs`, a registered PreToolUse hook. Proven inert via a symlinked path while
  // AGENTS.md describes it as the mechanism by which "a malformed envelope is denied by hook before
  // it reaches a worker": by its real path it emits a `deny` decision, by the symlink it emits
  // nothing at all, which the CLI reads as allow.
  //
  // So the check is now structural rather than a blocklist: `import.meta.url` may not appear on the
  // same line as `process.argv[1]` anywhere except inside the shared helper. Any hand-rolled
  // comparison is an offender whether or not its particular spelling has been seen before.
  // SCANNED: the trees that actually run. `bin/`, `hooks/`, `skills/`, `scripts/` — everything a
  // user installs plus the dev tooling a contributor invokes. Deliberately NOT the whole repo: this
  // file and the design docs have to be able to NAME the broken pattern in order to explain it, and
  // a checker that flags its own explanation is a checker people delete. Scoping to the shipped
  // trees is also strictly tighter than walking everything, because it says out loud which code the
  // rule governs.
  const SCANNED = ["bin", "hooks", "skills", "scripts"];
  const offenders = [];
  for (const dir of SCANNED) {
    if (!existsSync(join(ROOT, dir))) continue;
    for (const abs of walkMjs(join(ROOT, dir))) {
    const rel = relative(ROOT, abs);
    if (rel.startsWith("node_modules") || rel === HELPER) continue;
    let src; try { src = read(abs); } catch { continue; }
    if (src.includes(FRAGILE)) { offenders.push(`${rel} (template-literal form)`); continue; }
    const line = src.split("\n").find((l) => l.includes("import.meta.url") && l.includes("process.argv[1]"));
    if (line) offenders.push(`${rel} (hand-rolled: ${line.trim().slice(0, 72)})`);
    }
  }
  if (offenders.length === 0) {
    ok(`no hand-rolled main guard in ${SCANNED.join("/, ")}/ — the shared helper is the only way to ask`);
  } else {
    fail(`${offenders.length} file(s) hand-roll a main guard. Every hand-rolled form so far has been\n` +
         `    broken under a symlinked path — neither a template literal nor resolve() resolves\n` +
         `    symlinks — and the failure is a SILENT no-op with exit 0. Use isMain() from ${HELPER}:\n` +
         offenders.map((f) => `      ${f}`).join("\n"));
  }

  // =============================================================================
  section("11a2. The continuity reflex covers a cold start, not only compact/resume");
  // =============================================================================
  // The companion defect to the main-guard one, and the same shape: a mechanism that was present,
  // reported as working, and wired to fire only in cases that do not happen much.
  //
  // CONTINUITY IS A COMMAND, NOT A REFLEX. `session-rehydrate` injected "trust the files, not your
  // memory" as SessionStart context, and its matcher had to be pinned here because it once omitted
  // `startup` — the one source where there IS no memory to distrust — at a measured cost of 82-120
  // turns rebuilding an already-open run.
  //
  // The reflex is gone because the answer is now a query anyone can run at any point:
  // `harness reduce graph --slug <slug> --subgraph run`. A hook fires at two moments the platform
  // chooses; a command answers whenever the question is asked, including the moments a hook never
  // saw. What has to be pinned instead is that the orchestrator's own instructions still TELL it to
  // ask — an unasked query is exactly as silent as an unfired hook.
  {
    const skill = join(ROOT, "skills/tech-lead/SKILL.md");
    const body = existsSync(skill) ? read(skill) : "";
    if (/reduce graph[\s\S]{0,80}subgraph run/.test(body) || /subgraph run/.test(body)) {
      ok("tech-lead SKILL.md names the rehydration query the retired SessionStart hook used to carry");
    } else {
      fail("tech-lead SKILL.md never names `reduce graph --subgraph run` — the continuity reflex was deleted " +
           "and nothing replaced it, which is the cold-start defect the retired hook was written for");
    }
    for (const gone of ["session-rehydrate", "compact-snapshot"]) {
      if (!existsSync(join(ROOT, "hooks", `${gone}.mjs`))) ok(`hooks/${gone}.mjs is retired`);
      else fail(`hooks/${gone}.mjs is still on disk — the reflex and the command are now two answers to one question`);
    }
  }

  // =============================================================================
  section("11a3. The already-open-run refusal is a resume path, not a dead end");
  // =============================================================================
  // Third defect in the same family as the two above: a runtime that tells the agent to use a
  // mechanism which does not exist, at the moment the agent most needs a next step.
  //
  // `init-run.mjs` correctly refuses to re-initialise over a live receipt — re-opening would discard
  // the round history the circuit breaker counts against. But it said "Resume it (`--from <slug>`)",
  // and `--from` is not an init-run flag at all: it belongs to `/tech-lead` and it takes a PHASE
  // (`--from build`), not a slug. So on a cold start into an open run — exactly the benchmark's
  // F4 handoff — the only guidance available named a flag that does not parse.
  //
  // The refusal now emits the file-derived resume snapshot in the same tool call, so it hands over
  // state rather than a suggestion. Asserted by RUNNING it against a workspace with an open run,
  // because the previous version's wording was also perfectly plausible.
  {
    const tmp2 = mkdtempSync(join(tmpdir(), "sudd-resume-"));
    try {
      spawnSync("git", ["init", "-q"], { cwd: tmp2 });
      const slug = "already-open";
      const runRoot = join(tmp2, ".shapeup", slug);
      mkdirSync(runRoot, { recursive: true });
      writeFileSync(join(tmp2, ".shapeup", "active-scope"), JSON.stringify({ slug }));
      writeFileSync(join(runRoot, "receipt.json"), JSON.stringify({ started: true, slug }));
      writeFileSync(join(runRoot, "harness-run.md"),
        "---\nstatus: building\nrounds_used: 2\nmax_rounds: 3\n---\n\n# run\n");
      writeFileSync(join(tmp2, "intake.md"), "# demo\n\nadd a flag\n");

      const r = spawnSync("node", [
        join(ROOT, "kernel/harness.mjs"), "init", "run",
        "--slug", slug, "--intake-file", "intake.md", "--auto-level", "unattended",
      ], { cwd: tmp2, encoding: "utf8" });
      const out = `${r.stdout || ""}${r.stderr || ""}`;

      if (r.status === 3) ok("init-run still refuses to re-open a live run (exit 3)");
      else fail(`init-run exited ${r.status} over a live receipt — it must refuse with 3, not re-initialise`);

      if (!/--from\s+<slug>/.test(out)) ok("the refusal no longer points at the non-existent `--from <slug>`");
      else fail("the refusal still tells the orchestrator to use `--from <slug>`, which init-run does not accept");

      if (/RESUME STATE/.test(out) && /"status":\s*"building"/.test(out)) {
        ok("the refusal carries the file-derived resume state (status, round) in the same call");
      } else {
        fail(`the refusal does not hand over resume state — the orchestrator has to go and find it:\n    ${out.slice(0, 300)}`);
      }
      if (/do NOT restart the pipeline from phase 1/i.test(out)) {
        ok("the refusal names the actual failure: restarting the pipeline from phase 1");
      } else {
        fail("the refusal does not warn against restarting from phase 1, which is what a fresh session does");
      }
      if (/--force/.test(out)) ok("the refusal still documents the deliberate re-open escape hatch");
      else fail("the refusal no longer mentions --force, so a deliberate re-open has no stated path");
    } finally {
      try { rmSync(tmp2, { recursive: true, force: true }); } catch { /* best effort */ }
    }
  }

  // =============================================================================
  section("11b. Every entry point runs identically via a symlink and via a path with a space");
  // =============================================================================
  // A real install shape, twice over. `/var/folders` on macOS is already behind a symlink, so the
  // symlink case is not exotic — it is the default temp directory, and it is how the
  // benchmark installed this plugin.
  const tmp = mkdtempSync(join(tmpdir(), "sudd-ismain-"));
  const cwd = join(tmp, "ws");
  mkdirSync(cwd, { recursive: true });
  // A workspace with nothing in it: every probe below must reach its own refusal path rather than
  // acting on a real run.
  spawnSync("git", ["init", "-q"], { cwd });

  try {
    // Shape 1 — a symlink pointing at the repo.
    const viaLink = join(tmp, "plugin-link");
    symlinkSync(ROOT, viaLink, "dir");
    // Shape 2 — a real copy under a directory whose name contains a space. Copying only the trees
    // an entry point can reach keeps this fast; `kernel/` carries the shared guard.
    const spaced = join(tmp, "My Plugins", "plugin");
    mkdirSync(spaced, { recursive: true });
    for (const dir of ["hooks", "skills", "kernel"]) {
      if (existsSync(join(ROOT, dir))) cpSync(join(ROOT, dir), join(spaced, dir), { recursive: true });
    }

    let checked = 0;
    for (const spec of ENTRY_POINTS) {
      const real = join(ROOT, spec.file);
      if (!existsSync(real)) { fail(`entry point listed but missing: ${spec.file}`); continue; }
      checked++;

      const baseline = invoke(real, spec, cwd);
      const bySymlink = invoke(join(viaLink, spec.file), spec, cwd);
      const bySpace = existsSync(join(spaced, spec.file)) ? invoke(join(spaced, spec.file), spec, cwd) : null;

      // The direct assertion for a script with a printing refusal path: it must speak by every
      // path. Under the old guard the symlinked and spaced invocations were silent, exit 0.
      if (spec.expect === "stdout") {
        if (!spoke(baseline)) {
          fail(`${spec.label ?? spec.file} says nothing even by its real path — the probe cannot discriminate; ` +
               `give it args that reach a refusal, or move it out of ENTRY_POINTS`);
          continue;
        }
        if (spoke(bySymlink)) ok(`${spec.label ?? spec.file} runs via a symlinked plugin root`);
        else fail(`${spec.label ?? spec.file} is a SILENT NO-OP via a symlinked plugin root (exit ${bySymlink.status}) — ` +
                  `the main guard is comparing an unresolved path`);
        if (bySpace) {
          if (spoke(bySpace)) ok(`${spec.label ?? spec.file} runs via a path containing a space`);
          else fail(`${spec.label ?? spec.file} is a SILENT NO-OP via a path containing a space (exit ${bySpace.status}) — ` +
                    `the main guard is comparing an unencoded path`);
        }
      }

      // For fail-open hooks, correctness is "same exit status by every path". A hook that exits 0
      // in silence is legitimate; a hook that exits 0 *because its body never ran* is the bug, and
      // it shows up as a divergence the moment the body would have done something.
      if (spec.expect === "exit0") {
        const same = bySymlink.status === baseline.status && (!bySpace || bySpace.status === baseline.status);
        if (same) ok(`${spec.label ?? spec.file} behaves identically by real path, symlink and spaced path`);
        else fail(`${spec.label ?? spec.file} diverges by invocation path: real=${baseline.status} ` +
                  `symlink=${bySymlink.status}${bySpace ? ` spaced=${bySpace.status}` : ""}`);
      }
    }
    if (checked === ENTRY_POINTS.length) ok(`all ${checked} guarded entry points probed by three invocation paths`);
    else fail(`only ${checked}/${ENTRY_POINTS.length} entry points were probed`);

    // =============================================================================
    section("11c. isMain() itself: direct run true, import false");
    // =============================================================================
    // The two properties the guard exists for, asserted directly rather than inferred. If the
    // second ever regresses, importing a script for its exported helpers would execute its main()
    // as a side effect — which is why the guard is there at all and why it cannot just be deleted.
    const probe = join(tmp, "probe.mjs");
    writeFileSync(probe, [
      `import { isMain } from ${JSON.stringify(join(ROOT, HELPER))};`,
      `console.log(JSON.stringify({ direct: isMain(import.meta.url) }));`,
    ].join("\n"));
    const direct = spawnSync("node", [probe], { encoding: "utf8" });
    if (direct.stdout.includes('"direct":true')) ok("isMain() is true for a directly executed module");
    else fail(`isMain() is false for a directly executed module — every guarded script is now inert.\n    ${direct.stdout}${direct.stderr}`);

    const linkedProbe = join(tmp, "probe-link.mjs");
    symlinkSync(probe, linkedProbe);
    const viaProbeLink = spawnSync("node", [linkedProbe], { encoding: "utf8" });
    if (viaProbeLink.stdout.includes('"direct":true')) ok("isMain() is true when the script itself is a symlink");
    else fail(`isMain() is false when the script itself is a symlink.\n    ${viaProbeLink.stdout}${viaProbeLink.stderr}`);

    const importer = join(tmp, "importer.mjs");
    writeFileSync(importer, [
      `import { isMain } from ${JSON.stringify(join(ROOT, HELPER))};`,
      `const url = ${JSON.stringify(`file://${probe}`)};`,
      `console.log(JSON.stringify({ imported: isMain(url) }));`,
    ].join("\n"));
    const imported = spawnSync("node", [importer], { encoding: "utf8" });
    if (imported.stdout.includes('"imported":false')) ok("isMain() is false for a module that is not the entry point");
    else fail(`isMain() returned true for a non-entry module — importing a script would run its main().\n    ${imported.stdout}${imported.stderr}`);
  } finally {
    try { rmSync(tmp, { recursive: true, force: true }); } catch { /* best effort */ }
  }

  // =============================================================================
  section("11d. The PACKED distributable — the shape a user and the benchmark actually install");
  // =============================================================================
  // 11b proves the guard holds across three path spellings OF THE REPO TREE. Nobody installs the
  // repo tree. The benchmark builds the real tarball with `npm pack` and loads that, which is also
  // what `npm i` gives a user — and a file absent from package.json's `files` list would pass every
  // assertion above and simply not exist at runtime. That is a DIFFERENT silent no-op with the same
  // symptom as F-16, and 610 passing checks did not see the first one either.
  //
  // So this section asserts two things the repo tree cannot: every guarded entry point SHIPS, and
  // it behaves identically once unpacked under a symlinked temp dir (the benchmark's install shape).
  const packTmp = mkdtempSync(join(tmpdir(), "sudd-packed-"));
  try {
    const packed = spawnSync("npm", ["pack", "--pack-destination", packTmp], {
      cwd: ROOT, encoding: "utf8", timeout: 300_000,
    });
    const tarball = (packed.stdout || "").trim().split("\n").filter(Boolean).pop();
    if (packed.status !== 0 || !tarball || !existsSync(join(packTmp, tarball))) {
      fail(`npm pack failed, so the shipped surface could not be checked at all: ` +
           `${(packed.stderr || packed.stdout || "no output").slice(0, 300)}`);
    } else {
      const untar = spawnSync("tar", ["-xzf", join(packTmp, tarball), "-C", packTmp], { encoding: "utf8" });
      const pkg = join(packTmp, "package");
      if (untar.status !== 0 || !existsSync(pkg)) {
        fail(`the packed tarball did not extract: ${(untar.stderr || "no output").slice(0, 200)}`);
      } else {
        const wsPacked = join(packTmp, "ws");
        mkdirSync(wsPacked, { recursive: true });
        spawnSync("git", ["init", "-q"], { cwd: wsPacked });

        // `oracles/` ships; `tools/` does not and is not listed here. Excluding rather than
        // asserting keeps this check from arguing with a shipping decision.
        const shipped = ENTRY_POINTS.filter((s) => !s.file.startsWith("tools/"));
        let missing = 0, diverged = 0;
        for (const spec of shipped) {
          const inPack = join(pkg, spec.file);
          if (!existsSync(inPack)) {
            fail(`${spec.file} is a guarded entry point that DOES NOT SHIP — it is absent from the ` +
                 `packed tarball, so at runtime it is missing rather than merely inert. Add its ` +
                 `directory to package.json "files".`);
            missing++;
            continue;
          }
          const fromRepo = invoke(join(ROOT, spec.file), spec, wsPacked);
          const fromPack = invoke(inPack, spec, wsPacked);
          // Same rule as 11b: for a printing refusal the body must speak; for a fail-open hook the
          // exit status must match. The packed tree sits under /var/folders, i.e. behind a symlink.
          const same = spec.expect === "stdout"
            ? spoke(fromPack)
            : fromPack.status === fromRepo.status;
          if (same) ok(`${spec.label ?? spec.file} ships and behaves identically from the packed distributable`);
          else {
            fail(`${spec.label ?? spec.file} ships but DIVERGES when run from the packed tarball ` +
                 `(repo exit ${fromRepo.status}, packed exit ${fromPack.status}, ` +
                 `packed said ${fromPack.out.trim().length} bytes) — this is the install shape the ` +
                 `benchmark measured F-16 in.`);
            diverged++;
          }
        }
        if (!missing && !diverged) {
          ok(`all ${shipped.length} shipped entry points survive npm pack → extract → run under a symlinked root`);
        }
      }
    }
  } finally {
    try { rmSync(packTmp, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
