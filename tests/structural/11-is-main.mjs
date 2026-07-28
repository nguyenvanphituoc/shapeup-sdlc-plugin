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
// call — a silent no-op was invisible to every check. On the SDD harness benchmark it cost
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
  { file: "hooks/anti-rationalization.mjs", stdin: "not json", expect: "exit0" },
  { file: "hooks/slop-cleaner.mjs", stdin: "not json", expect: "exit0" },
  { file: "hooks/session-rehydrate.mjs", stdin: "not json", expect: "exit0" },
  { file: "hooks/compact-snapshot.mjs", stdin: "not json", expect: "exit0" },
  // Scripts whose refusal path prints. These are the strongest probes: a correct guard produces a
  // refusal on stderr/stdout and a non-zero exit; a broken guard produces silence and exit 0.
  { file: "skills/tech-lead/scripts/init-run.mjs", args: [], expect: "stdout" },
  { file: "skills/tech-lead/scripts/gate-answers.mjs", args: [], expect: "stdout" },
  { file: "skills/tech-lead/scripts/t0-verify.mjs", args: [], expect: "stdout" },
  { file: "skills/tech-lead/scripts/budget-check.mjs", args: [], expect: "stdout" },
  { file: "skills/tech-lead/scripts/fit-check.mjs", args: [], expect: "stdout" },
  { file: "skills/tech-lead/scripts/aegis-digest.mjs", args: [], expect: "stdout" },
  { file: "skills/spec-evaluator/scripts/verdict-ledger.mjs", args: [], expect: "stdout" },
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
  const HELPER = "skills/tech-lead/scripts/lib/is-main.mjs";
  const helperPath = join(ROOT, HELPER);
  if (existsSync(helperPath)) ok(`the shared guard exists (${HELPER})`);
  else fail(`missing ${HELPER} — the shared, symlink-safe main guard`);

  const offenders = [];
  for (const abs of walkMjs(ROOT)) {
    const rel = relative(ROOT, abs);
    if (rel.startsWith("node_modules") || rel === HELPER) continue;
    let src; try { src = read(abs); } catch { continue; }
    if (src.includes(FRAGILE)) offenders.push(rel);
  }
  if (offenders.length === 0) {
    ok(`no file compares import.meta.url against the unresolved ${FRAGILE}`);
  } else {
    fail(`${offenders.length} file(s) use the fragile main guard — it silently no-ops under a\n` +
         `    symlinked path or a path containing a space. Use isMain() from ${HELPER}:\n` +
         offenders.map((f) => `      ${f}`).join("\n"));
  }

  // =============================================================================
  section("11a2. The continuity reflex covers a cold start, not only compact/resume");
  // =============================================================================
  // The companion defect to the main-guard one, and the same shape: a mechanism that was present,
  // reported as working, and wired to fire only in cases that do not happen much.
  //
  // `session-rehydrate` existed to say "trust the files, not your memory". Its matcher was
  // `compact|resume` — both of which continue a conversation that still exists — so it stayed
  // silent on `startup`, the one source where there is no memory to distrust. Measured cost on the
  // SDD harness benchmark: a fresh session re-opened an already-open run and spent 82–120 turns
  // rebuilding the pipeline, 0/3 gap closed. Pinned here so the matcher cannot narrow again.
  const hooksJson = join(ROOT, "hooks/hooks.json");
  if (existsSync(hooksJson)) {
    const cfg = ctx.readJSON(hooksJson);
    const starts = (cfg.hooks?.SessionStart || cfg.SessionStart || []);
    const rehydrate = starts.find((m) => (m.hooks || []).some((h) => String(h.command).includes("session-rehydrate")));
    if (!rehydrate) {
      fail("no SessionStart matcher runs hooks/session-rehydrate.mjs");
    } else {
      const matcher = String(rehydrate.matcher ?? "");
      for (const source of ["startup", "compact", "resume"]) {
        if (matcher.split("|").includes(source)) ok(`session-rehydrate fires on SessionStart:${source}`);
        else fail(`session-rehydrate does NOT fire on SessionStart:${source} (matcher ${JSON.stringify(matcher)}) — ` +
                  `a continuity reflex that skips a cold start is the defect the benchmark priced at 0/3 recovery`);
      }
    }
  } else {
    fail("hooks/hooks.json missing");
  }

  // The cold-start injection must NAME the failure a fresh session actually makes. A generic
  // "re-read the files" is what a competent agent does anyway; "a run is already open, do not
  // re-open it" is the part that changes behaviour, so it is asserted rather than assumed.
  const rehydrateSrc = existsSync(join(ROOT, "hooks/session-rehydrate.mjs"))
    ? read(join(ROOT, "hooks/session-rehydrate.mjs")) : "";
  if (/ALREADY OPEN/.test(rehydrateSrc) && /startup/.test(rehydrateSrc)) {
    ok("the cold-start injection tells the orchestrator to resume rather than re-open");
  } else {
    fail("hooks/session-rehydrate.mjs no longer distinguishes a cold start — the injected text must " +
         "say a run is already open and must not be re-opened");
  }

  // =============================================================================
  section("11b. Every entry point runs identically via a symlink and via a path with a space");
  // =============================================================================
  // A real install shape, twice over. `/var/folders` on macOS is already behind a symlink, so the
  // symlink case is not exotic — it is the default temp directory, and it is how the SDD harness
  // benchmark installs this plugin.
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
    // an entry point can reach keeps this fast; `skills/` carries the shared guard.
    const spaced = join(tmp, "My Plugins", "plugin");
    mkdirSync(spaced, { recursive: true });
    for (const dir of ["hooks", "skills"]) {
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
          fail(`${spec.file} says nothing even by its real path — the probe cannot discriminate; ` +
               `give it args that reach a refusal, or move it out of ENTRY_POINTS`);
          continue;
        }
        if (spoke(bySymlink)) ok(`${spec.file} runs via a symlinked plugin root`);
        else fail(`${spec.file} is a SILENT NO-OP via a symlinked plugin root (exit ${bySymlink.status}) — ` +
                  `the main guard is comparing an unresolved path`);
        if (bySpace) {
          if (spoke(bySpace)) ok(`${spec.file} runs via a path containing a space`);
          else fail(`${spec.file} is a SILENT NO-OP via a path containing a space (exit ${bySpace.status}) — ` +
                    `the main guard is comparing an unencoded path`);
        }
      }

      // For fail-open hooks, correctness is "same exit status by every path". A hook that exits 0
      // in silence is legitimate; a hook that exits 0 *because its body never ran* is the bug, and
      // it shows up as a divergence the moment the body would have done something.
      if (spec.expect === "exit0") {
        const same = bySymlink.status === baseline.status && (!bySpace || bySpace.status === baseline.status);
        if (same) ok(`${spec.file} behaves identically by real path, symlink and spaced path`);
        else fail(`${spec.file} diverges by invocation path: real=${baseline.status} ` +
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
}
