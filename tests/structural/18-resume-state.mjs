// Structural test module: the fast-forward derivation (migration A2.1/A2.2).
// Section: 52.
//
// WHY THIS MODULE EXISTS.
//
// The fast-forward — "resume at the first phase whose artifacts are incomplete" — is what the
// whole orchestrator migration was built to buy, and until Stage A2 nothing could test it. It
// lived as a `node --input-type=module -e "…"` string inside a Workflow script, and a Workflow
// script has no `import`, takes `args` as a runtime global, and is executed by the Workflow
// runtime: there was no seam a fixture could reach.
//
// So it shipped unverified, and a kill/resume probe found what that costs.
// ORIENT's skip was gated on the ledger's stored `status`
// rather than on ORIENT's own artifacts. A courier write left that status pinned at "orienting"
// across two complete legs and 46 dispatched agents, and every relaunch re-ran ORIENT from
// scratch — three artifacts rewritten, a spike added, the discovery ledger and two task files
// mutated. WIRE and MAP SCOPES, which read artifacts, fast-forwarded correctly throughout.
//
// The checks below are therefore written against the DEFECT, not the happy path:
//
//   (a) a tree carrying `status: orienting` AND a complete orient/ must NOT resume at orient.
//       That single assertion is the whole of acceptance row G2 — it is red against the old
//       predicate and green against the new one.
//   (d) two trees differing ONLY in `status` must derive the SAME phase. This is what keeps the
//       stored field from creeping back into the resume decision later; (a) alone would still
//       pass if someone re-introduced a status branch that happened to agree on this fixture.
//   (e)/(f)/(g) the two writes report their outcome. They were the only mech() call sites in the
//       workflow whose return value was discarded, and they are the only two whose failure went
//       unnoticed — a write nobody reads back is indistinguishable from one that succeeded.
//   (h) the wiring itself. `fd5ad3d`'s class was a correct function nothing called; a correct
//       derivation the workflow does not consult would be the same defect one layer up, and the
//       workflow cannot be imported to prove it behaviourally.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pinnedBy } from "../lib/pinned-row.mjs";

const SLUG = "resume-fixture";

/**
 * Plant a project tree at a chosen stage of completeness.
 *
 * @param {string} root - Directory to build the tree in.
 * @param {object} opts - Which artifacts exist.
 * @param {string|null} [opts.status] - Ledger status line, or null for no ledger at all.
 * @param {string[]} [opts.orient] - Filenames to create under the local orient/ directory.
 * @param {string[]} [opts.usecases] - Use-case filenames to create under the spec's usecases/.
 * @param {boolean} [opts.wiringMap] - Whether the shared wiring map exists.
 * @param {string[]} [opts.scopes] - Scope contract ids to create.
 * @param {string[]} [opts.results] - Result filenames to create.
 * @returns {string} The tree root, for chaining.
 */
function plant(root, { status = null, orient = [], usecases = [], board = null, wiringMap = false, scopes = [], results = [] }) {
  const local = join(root, ".shapeup", SLUG);
  const shared = join(root, "shapeup", SLUG);
  mkdirSync(local, { recursive: true });
  mkdirSync(shared, { recursive: true });

  if (status !== null) {
    writeFileSync(join(local, "harness-run.md"),
      `---\ntype: harness-run\nstatus: ${status}\nspec_folder: shapeup/${SLUG}\n---\n\n# Run ledger\n`);
  }
  if (orient.length) {
    mkdirSync(join(local, "orient"), { recursive: true });
    for (const f of orient) writeFileSync(join(local, "orient", f), "planted\n");
  }
  // The spec tree lands under the ledger's own `spec_folder` when there is a ledger (this fixture's
  // ledger names `shapeup/<slug>`, not the default `shapeup/<slug>/spec`), and under the registry
  // default when there is none — so this arm also exercises the override resolution.
  if (usecases.length) {
    const ucDir = join(status !== null ? shared : join(shared, "spec"), "usecases");
    mkdirSync(ucDir, { recursive: true });
    for (const f of usecases) writeFileSync(join(ucDir, f), "planted\n");
  }
  // THE HALF A CLONE LOSES. ANALYZE writes the spec tree (committed) AND the board (per-machine,
  // gitignored), and the phase is complete only with both. A "complete spec tree" fixture therefore
  // plants a board too, unless a case says `board: false` to model the fresh-checkout state.
  const wantBoard = board === null ? usecases.some((f) => f !== "_index.md") : board;
  if (wantBoard) {
    mkdirSync(join(local, "tasks"), { recursive: true });
    writeFileSync(join(local, "tasks", "TASK-001.md"), "---\nid: TASK-001\nstatus: pending\nscope_id: SC-1\n---\n\n# planted\n");
  }
  if (wiringMap) writeFileSync(join(shared, "wiring-map.md"), "planted\n");
  if (scopes.length) {
    mkdirSync(join(shared, "scopes"), { recursive: true });
    for (const id of scopes) writeFileSync(join(shared, "scopes", `${id}.md`), "planted\n");
  }
  if (results.length) {
    mkdirSync(join(local, "results"), { recursive: true });
    for (const f of results) writeFileSync(join(local, "results", f), "{}\n");
  }
  return root;
}

/** ORIENT's four artifacts, complete. */
const FULL_ORIENT = ["code-surface.md", "discovered-seed.md", "hill-signal.md", "spike-persistence.md"];
/** A spec tree with use cases in it. `_index.md` alone is a tree with nothing to wire. */
const FULL_SPEC = ["_index.md", "UC-01-add-task.md", "UC-02-list-tasks.md"];
/** Everything upstream of BUILD, for the arms that vary one artifact at a time. */
const COMPLETE = { orient: FULL_ORIENT, usecases: FULL_SPEC, wiringMap: true, scopes: ["SC-1"] };

/**
 * Run the resume-state checks (Stage A2 acceptance rows G1, G2, G3, G4).
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("52. The fast-forward resumes on artifacts, never on stored status (migration A2)");
  // =============================================================================

  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const SCRIPT = [KERNEL, "probe", "resume"];
  if (!existsSync(KERNEL) || !existsSync(join(ROOT, "kernel/probe/resume.mjs"))) {
    fail("`harness probe resume` is missing — the fast-forward derivation has no testable seam");
    return;
  }
  ok("`harness probe resume` exists — the derivation is a subcommand, not a string inside a workflow");

  const ws = mkdtempSync(join(tmpdir(), "struct-resume-"));
  /** Invoke the script against a planted tree. @returns {{code: number, json: object|null}} */
  const invoke = (root, extra = []) => {
    const r = spawnSync("node", [...SCRIPT, "--slug", SLUG, "--cwd", root, ...extra], { encoding: "utf8" });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* a non-JSON stdout is itself the failure */ }
    return { code: r.status, json, raw: `${r.stdout}${r.stderr}` };
  };
  const tree = (name, opts) => plant(mkdirSync(join(ws, name), { recursive: true }) || join(ws, name), opts);

  try {
    // --- (a) THE DEFECT, as a single assertion (G2) -------------------------------------------
    // Stale status + complete artifacts. The old predicate (`status === null || status ===
    // "orienting"`) re-dispatched ORIENT here; the artifact predicate must not.
    const stale = tree("stale-status", { status: "orienting", ...COMPLETE, scopes: ["SC-1", "SC-2"] });
    const staleState = invoke(stale);
    if (staleState.json?.has_orient_artifacts === true && staleState.json?.next_step !== "orient") {
      ok(`a run with status "orienting" and a complete orient/ resumes at "${staleState.json.next_step}", not at orient`);
    } else {
      fail(`stale status re-ran ORIENT: has_orient_artifacts=${staleState.json?.has_orient_artifacts} next_step=${staleState.json?.next_step} — this is the kill/resume probe's defect, unfixed`);
    }

    // --- (b) every phase boundary, in order ---------------------------------------------------
    const BOUNDARIES = [
      ["orient", { status: "orienting" }, "nothing on disk"],
      ["orient", { status: "orienting", orient: ["code-surface.md", "hill-signal.md"] }, "a PARTIAL orient/ (no seed, no spike)"],
      ["orient", { status: "building", orient: FULL_ORIENT.filter((f) => !f.startsWith("spike-")) }, "orient/ with no spike file"],
      ["analyze", { status: "mapping", orient: FULL_ORIENT }, "orient complete, no spec tree"],
      ["analyze", { status: "mapping", orient: FULL_ORIENT, usecases: ["_index.md"] }, "a usecases/ carrying only _index.md"],
      // ⟐ Stage A3, and the boundary the whole stage turns on: a wiring map is written one entry
      // PER use case, so WIRE is not reachable until the use cases exist. The pipeline used to
      // dispatch it here anyway, and solution-architect escalated on every launch.
      // A committed spec tree with no per-machine board is the fresh-checkout state, and the fourth
      // run of one pitch on a live consumer: the fast-forward used to key on the committed half alone
      // and build over no board (L2 crossed 0/0 tasks). The derivation resumes AT analyze, where the
      // workflow dispatches the board-only operation rather than the whole phase.
      ["analyze", { status: "mapping", orient: FULL_ORIENT, usecases: FULL_SPEC, board: false }, "spec tree complete, no per-machine board"],
      ["wire", { status: "mapping", orient: FULL_ORIENT, usecases: FULL_SPEC }, "spec tree complete, no wiring map"],
      ["map-scopes", { status: "building", orient: FULL_ORIENT, usecases: FULL_SPEC, wiringMap: true }, "wiring map present, no scope contracts"],
      ["build", { status: "orienting", ...COMPLETE }, "every upstream artifact present"],
    ];
    BOUNDARIES.forEach(([expected, opts, label], i) => {
      const got = invoke(tree(`boundary-${i}`, opts)).json?.next_step;
      if (got === expected) ok(`resumes at "${expected}" with ${label}`);
      else fail(`with ${label} the derivation resumed at "${got}", expected "${expected}"`);
    });

    // --- (c) a run with no ledger at all is a fresh run, not a crash --------------------------
    const bare = invoke(tree("no-ledger", { status: null }));
    if (bare.code === 0 && bare.json?.status === null && bare.json?.next_step === "orient") {
      ok("a tree with no harness-run.md derives status null and resumes at orient");
    } else {
      fail(`a ledger-less tree did not derive cleanly: exit ${bare.code}, ${bare.raw.trim().slice(0, 120)}`);
    }

    // --- (d) status may not decide the phase, for ANY of its values ---------------------------
    // The load-bearing regression guard. (a) proves one stale value is ignored; this proves the
    // field is not consulted at all, so a status branch cannot be reintroduced quietly.
    const phases = new Set();
    for (const status of ["orienting", "mapping", "building", "evaluating", "shipped", "escalated"]) {
      const t = tree(`status-${status}`, { status, ...COMPLETE });
      phases.add(invoke(t).json?.next_step);
    }
    if (phases.size === 1 && phases.has("build")) {
      ok("all six ledger statuses derive the same phase from the same artifacts — status is not a resume predicate");
    } else {
      fail(`the derived phase varies with stored status (${[...phases].join(", ")}) — the resume decision still reads a claim`);
    }

    // --- (e) scope contracts arrive as resolved paths, never bare ids -------------------------
    const scoped = invoke(tree("scoped", { status: "building", orient: FULL_ORIENT, wiringMap: true, scopes: ["SC-2", "SC-1"] }));
    const files = scoped.json?.scope_files || [];
    if (files.length === 2 && files[0].scope_id === "SC-1" && existsSync(files[0].path)) {
      ok("scope_files carry resolved, existing paths in sorted order (a bare id makes compile-order exit 2, which the attempt loop reads as the stagnation breaker)");
    } else {
      fail(`scope_files did not resolve: ${JSON.stringify(files).slice(0, 160)}`);
    }

    // --- (f) the status write reports its own outcome (G3) ------------------------------------
    const target = tree("write-status", { status: "orienting", orient: FULL_ORIENT });
    const wrote = invoke(target, ["--set-status", "mapping"]);
    const onDisk = readFileSync(join(target, ".shapeup", SLUG, "harness-run.md"), "utf8");
    if (wrote.code === 0 && wrote.json?.ok === true && /^status: mapping$/m.test(onDisk)) {
      ok("--set-status writes the ledger and reports ok:true after reading it back");
    } else {
      fail(`--set-status did not take: exit ${wrote.code}, ${wrote.raw.trim().slice(0, 160)}`);
    }

    // The failure the old inline write could not report: there is no ledger to write to.
    const missing = invoke(tree("no-run", { status: null }), ["--set-status", "building"]);
    if (missing.code !== 0 && missing.json?.ok === false && missing.json?.reason) {
      ok("--set-status against a run with no ledger exits non-zero with a reason, instead of silently succeeding");
    } else {
      fail(`a status write with no ledger reported success (exit ${missing.code}) — this is exactly the silent no-op that pinned a run at "orienting"`);
    }

    // A ledger whose frontmatter carries no status line: the regex matched nothing and the old
    // write reported "ok" anyway.
    const malformed = join(ws, "malformed");
    mkdirSync(join(malformed, ".shapeup", SLUG), { recursive: true });
    writeFileSync(join(malformed, ".shapeup", SLUG, "harness-run.md"), "---\ntype: harness-run\n---\n\n# no status line\n");
    const noLine = invoke(malformed, ["--set-status", "building"]);
    if (noLine.code !== 0 && noLine.json?.ok === false) {
      ok("--set-status refuses a ledger with no status: line rather than writing nothing and reporting ok");
    } else {
      fail(`a ledger with no status line accepted the write (exit ${noLine.code}) — the no-op is invisible again`);
    }

    // And the arm that mutation-testing said was untested: a ledger present but not writable. The
    // read-back cannot catch this one (the write never happens), so the catch must report it —
    // otherwise the workflow gets a stack trace on stderr and an empty stdout, and logs nothing.
    const locked = tree("locked-ledger", { status: "orienting", orient: FULL_ORIENT });
    const lockedLedger = join(locked, ".shapeup", SLUG, "harness-run.md");
    chmodSync(lockedLedger, 0o444);
    let enforced = true;
    try { writeFileSync(lockedLedger, readFileSync(lockedLedger, "utf8")); enforced = false; } catch { /* read-only holds */ }
    if (!enforced) {
      // Running as root, or a filesystem that ignores the mode bit. Say so rather than passing.
      ok("skipped the unwritable-ledger arm — this filesystem/user does not enforce read-only");
    } else {
      const denied = invoke(locked, ["--set-status", "building"]);
      if (denied.code !== 0 && denied.json?.ok === false && /could not write/.test(denied.json?.reason || "")) {
        ok("--set-status reports an unwritable ledger as an outcome record (exit 3 + reason), not as a stack trace");
      } else {
        fail(`an unwritable ledger produced exit ${denied.code} with stdout ${JSON.stringify(denied.raw).slice(0, 120)} — the failure is not reportable`);
      }
    }
    chmodSync(lockedLedger, 0o644);

    // A value outside the ledger schema's enum is rejected by the argv boundary, before any I/O.
    const bogus = invoke(target, ["--set-status", "definitely-not-a-status"]);
    if (bogus.code === 2 && /invalid_value/.test(bogus.raw)) {
      ok("--set-status rejects a value outside the ledger's enum at the argv boundary (exit 2, nothing written)");
    } else {
      fail(`an invalid status was not rejected: exit ${bogus.code}, ${bogus.raw.trim().slice(0, 120)}`);
    }

    // --- (g) the shared substrate pointer is GONE ---------------------------------------------
    //
    // `--set-active-scope` wrote `.shapeup/active-scope` with the scope about to be built, and
    // sandbox-guard read it to pick a write-whitelist. That is a single mutable pointer, so with
    // scopes building CONCURRENTLY the last writer wins it and every other leg is fenced by
    // somebody else's contract. The guard now reads every LIVE ORDER instead (see
    // tests/structural/03-hooks.mjs), which needs no pointer at all — so the flag must be gone,
    // not merely unused. A flag that still parses is a flag something will call.
    const gonePointer = invoke(tree("pointer", { status: "building", orient: FULL_ORIENT, wiringMap: true, scopes: ["SC-1", "SC-2"] }),
      ["--set-active-scope", "SC-2"]);
    if (gonePointer.code === 2 && /unknown_flag/.test(gonePointer.raw)) {
      ok("--set-active-scope is rejected at the argv boundary — the shared substrate pointer has no writer left");
    } else {
      fail(`--set-active-scope still parses (exit ${gonePointer.code}) — a shared pointer that survives concurrency will be written by one leg and read by another`);
    }

    // --- (i) the post-condition: a RESULT is not a completion (Stage A3, rows G1/G2) ----------
    //
    // THE DEFECT THIS ARM IS WRITTEN AGAINST. The pipeline dispatched WIRE, ingested a result
    // reading `status: "escalated"` with `artifacts: []`, and moved to the next gate. The phase had
    // written nothing, so the next launch's fast-forward re-dispatched it, and the worker escalated
    // again — forever. The tree below IS that state:
    // every upstream artifact present, a wire result on disk, and no wiring map.
    const escalated = tree("escalated-wire", {
      status: "mapping", orient: FULL_ORIENT, usecases: FULL_SPEC, results: ["wire.json"],
    });
    writeFileSync(join(escalated, ".shapeup", SLUG, "results", "wire.json"),
      JSON.stringify({ status: "escalated", artifacts: [], escalates: [{ question: "no use cases to wire" }] }) + "\n");
    const req = invoke(escalated, ["--require", "wire"]);
    if (req.code === 6 && req.json?.satisfied === false && req.json?.required_phase === "wire") {
      ok("--require wire exits 6 against a run whose wire RESULT exists and whose wiring map does not — a result record is not a completion");
    } else {
      fail(`--require wire accepted an escalated phase with no artifact: exit ${req.code}, ${req.raw.trim().slice(0, 160)} — the pipeline would proceed and every relaunch would re-dispatch it`);
    }

    // The same predicate, the other way: with the artifact present the phase IS complete. Asserted
    // for every phase, so a new phase cannot be added to the chain without a post-condition.
    const whole = tree("require-all", { status: "building", ...COMPLETE });
    const unsatisfied = ["orient", "analyze", "wire", "map-scopes"].filter((p) => invoke(whole, ["--require", p]).code !== 0);
    if (unsatisfied.length === 0) {
      ok("--require passes for all four phases against a complete tree (orient, analyze, wire, map-scopes)");
    } else {
      fail(`--require reported these complete phases as unmet: ${unsatisfied.join(", ")}`);
    }

    // And the resume decision and the completion check are the SAME predicate: whatever phase the
    // fast-forward names, --require for that phase must fail. Two readings that can disagree about
    // "is this done" is the defect class itself.
    for (const [label, opts] of [
      ["orient", { status: "orienting" }],
      ["analyze", { status: "mapping", orient: FULL_ORIENT }],
      ["wire", { status: "mapping", orient: FULL_ORIENT, usecases: FULL_SPEC }],
      ["map-scopes", { status: "building", orient: FULL_ORIENT, usecases: FULL_SPEC, wiringMap: true }],
    ]) {
      const t = tree(`agree-${label}`, opts);
      const next = invoke(t).json?.next_step;
      const code = invoke(t, ["--require", next]).code;
      if (next === label && code === 6) ok(`next_step "${next}" and --require ${next} agree that the phase is not done`);
      else fail(`next_step="${next}" but --require ${next} exited ${code} — the resume and completion predicates disagree`);
    }

    // --- (h) the workflow actually consults it -------------------------------------------------
    // A Workflow script cannot be imported, so this is a source assertion — the only mechanical
    // check available for the wiring. It is narrow on purpose: it asserts the ORIENT branch reads
    // the artifact predicate and that no phase decision reads the stored `status`.
    //
    // The name of the resume object is DERIVED from the source rather than assumed, so a rename
    // cannot quietly turn these checks into assertions about a variable that no longer exists.
    // ---- the script-reading half of this module, ported or retired -----------------------------------------
    // Everything below used to read `shapeup-run.js` out of its source: that it bound its resume state to a
    // variable, gated each phase on the right artifact, never branched on stored status, checked a
    // post-condition after each dispatch, announced its fast-forwards through an attesting helper, read the
    // last verdict before opening its round loop, and declared a RESUME schema agreeing with the registry.
    // The script is retired; the loop is `probe next`, which derives all of that from the same facts this
    // module has just executed. Each former check, in order:
    //   gated ORIENT / ANALYZE / WIRE on its artifact          PORTED   `probe next` reads has_orient_artifacts,
    //       has_spec_tree and has_wiring_map: rows "no orient artifacts dispatches orient…", "no spec tree opens
    //       the spec substep in full…", "a committed spec tree and no board opens the spec substep board-only…"
    //   no phase decision reads stored status                  PORTED   executed below on `probe next`'s source
    //   a post-condition after every dispatch (requirePhase)   PORTED   rows "an orient that answered and left no
    //       artifact aborts at ORIENT", "a spec order closed over no tree aborts at ANALYZE", "a wire order closed
    //       over no map aborts at WIRE", "a scopes order closed over no contracts aborts at MAP SCOPES"
    //   analyze before wire; the profile precondition          PORTED   rows "a spec tree and a board with no wiring
    //       map opens the wire substep…", "a missing project profile blocks the run before orient…"
    //   the verdict read before the round loop opens           PORTED   rows "a FAIL answered stop goes to the census…
    //       the answer is honoured on a fresh session", "a PASS round reaches GATE QA over that verdict"
    //   invoked `probe resume` through a courier; fast-forward  RETIRED  `probe next` imports the derivation
    //       attested into a progress group; the declared RESUME   in-process, there is no progress panel to
    //       schema                                                 populate, and the courier whose coercion the
    //                                                              schema guarded is gone
    pinnedBy(ctx, [
      "no orient artifacts dispatches orient with the four filenames", "no spec tree opens the spec substep in full", "a committed spec tree and no board opens the spec substep board-only",
      "an orient that answered and left no artifact aborts at ORIENT", "a spec order closed over no tree aborts at ANALYZE", "a wire order closed over no map aborts at WIRE", "a scopes order closed over no contracts aborts at MAP SCOPES",
      "a spec tree and a board with no wiring map opens the wire substep", "a missing project profile blocks the run before orient",
      "a FAIL answered stop goes to the census", "a PASS round reaches GATE QA over that verdict",
    ], "every phase is gated on its own artifact and checked after its dispatch, and the last verdict is read before a round opens");

    const next = readFileSync(join(ROOT, "kernel/probe/next.mjs"), "utf8");
    const statusReads = (next.match(/\brs\.status\b/g) || []).length;
    if (statusReads === 2 && /const statusPre = \(phase\) => \(rs\.status && rs\.status !== STATUS_FOR\[phase\]/.test(next)) {
      ok("`probe next` reads the stored status in exactly one place — the status line it asks the loop to write — and in no phase decision");
    } else fail(`rs.status appears ${statusReads} time(s) in kernel/probe/next.mjs outside the one status-line helper — stored state is back in the decision`);
    if (/deriveResumeFacts\(cwd, slug\)/.test(next)) ok("`probe next` derives its facts by calling deriveResumeFacts in-process — one derivation, never a second one that can disagree with `--require`");
    else fail("probe next no longer calls deriveResumeFacts");

    // The registry's shape for the facts agrees with what `probe resume` prints — executed, both directions.
    const domain = JSON.parse(readFileSync(join(ROOT, "kernel/schemas/domain.schema.json"), "utf8"));
    const declared = domain?.$defs?.ResumeFacts?.properties;
    const printed = invoke(tree("shape", { status: "building", orient: FULL_ORIENT, usecases: FULL_SPEC, wiringMap: true, scopes: ["SC-1"] })).json;
    if (!declared) {
      fail("domain.schema.json declares no $defs/ResumeFacts.properties — the facts' shape has no owner");
    } else if (printed) {
      const undeclared = Object.keys(printed).filter((k) => !declared[k]);
      const required = domain.$defs.ResumeFacts.required.filter((k) => !(k in printed));
      if (!undeclared.length && !required.length) ok(`every fact \`probe resume\` prints is declared by $defs/ResumeFacts, and every required one is printed (${Object.keys(printed).length} fields)`);
      else fail(`ResumeFacts and \`probe resume\` disagree — printed but undeclared: ${undeclared.join(", ") || "none"}; required but not printed: ${required.join(", ") || "none"}`);
      const { validate } = await import(join(ROOT, "kernel/verify/envelope.mjs"));
      const check = validate(printed, { $ref: "domain.schema.json#/$defs/ResumeFacts" });
      if (check.valid) ok("the printed facts validate against $defs/ResumeFacts");
      else fail(`the printed facts fail their own registry def: ${check.errors.join("; ")}`);
    } else fail("probe resume printed no JSON for the shape check");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
