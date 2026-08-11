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
// So it shipped unverified, and the kill/resume probe found what that costs
// (docs/migration/stage2-evidence.md §4). ORIENT's skip was gated on the ledger's stored `status`
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

const SLUG = "resume-fixture";

/**
 * Plant a project tree at a chosen stage of completeness.
 *
 * @param {string} root - Directory to build the tree in.
 * @param {object} opts - Which artifacts exist.
 * @param {string|null} [opts.status] - Ledger status line, or null for no ledger at all.
 * @param {string[]} [opts.orient] - Filenames to create under the local orient/ directory.
 * @param {boolean} [opts.wiringMap] - Whether the shared wiring map exists.
 * @param {string[]} [opts.scopes] - Scope contract ids to create.
 * @param {string[]} [opts.results] - Result filenames to create.
 * @returns {string} The tree root, for chaining.
 */
function plant(root, { status = null, orient = [], wiringMap = false, scopes = [], results = [] }) {
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

  const SCRIPT = join(ROOT, "skills/tech-lead/scripts/resume-state.mjs");
  if (!existsSync(SCRIPT)) {
    fail("skills/tech-lead/scripts/resume-state.mjs is missing — the fast-forward derivation has no testable seam (Stage A2.1)");
    return;
  }
  ok("resume-state.mjs exists — the derivation is a script, not a string inside a workflow");

  const ws = mkdtempSync(join(tmpdir(), "struct-resume-"));
  /** Invoke the script against a planted tree. @returns {{code: number, json: object|null}} */
  const invoke = (root, extra = []) => {
    const r = spawnSync("node", [SCRIPT, "--slug", SLUG, "--cwd", root, ...extra], { encoding: "utf8" });
    let json = null;
    try { json = JSON.parse(r.stdout); } catch { /* a non-JSON stdout is itself the failure */ }
    return { code: r.status, json, raw: `${r.stdout}${r.stderr}` };
  };
  const tree = (name, opts) => plant(mkdirSync(join(ws, name), { recursive: true }) || join(ws, name), opts);

  try {
    // --- (a) THE DEFECT, as a single assertion (G2) -------------------------------------------
    // Stale status + complete artifacts. The old predicate (`status === null || status ===
    // "orienting"`) re-dispatched ORIENT here; the artifact predicate must not.
    const stale = tree("stale-status", {
      status: "orienting", orient: FULL_ORIENT, wiringMap: true, scopes: ["SC-1", "SC-2"],
    });
    const staleState = invoke(stale);
    if (staleState.json?.has_orient_artifacts === true && staleState.json?.next_phase !== "orient") {
      ok(`a run with status "orienting" and a complete orient/ resumes at "${staleState.json.next_phase}", not at orient`);
    } else {
      fail(`stale status re-ran ORIENT: has_orient_artifacts=${staleState.json?.has_orient_artifacts} next_phase=${staleState.json?.next_phase} — this is the kill/resume probe's defect, unfixed`);
    }

    // --- (b) every phase boundary, in order ---------------------------------------------------
    const BOUNDARIES = [
      ["orient", { status: "orienting" }, "nothing on disk"],
      ["orient", { status: "orienting", orient: ["code-surface.md", "hill-signal.md"] }, "a PARTIAL orient/ (no seed, no spike)"],
      ["orient", { status: "building", orient: FULL_ORIENT.filter((f) => !f.startsWith("spike-")) }, "orient/ with no spike file"],
      ["wire", { status: "mapping", orient: FULL_ORIENT }, "orient complete, no wiring map"],
      ["map-scopes", { status: "building", orient: FULL_ORIENT, wiringMap: true }, "wiring map present, no scope contracts"],
      ["build", { status: "orienting", orient: FULL_ORIENT, wiringMap: true, scopes: ["SC-1"] }, "every upstream artifact present"],
    ];
    BOUNDARIES.forEach(([expected, opts, label], i) => {
      const got = invoke(tree(`boundary-${i}`, opts)).json?.next_phase;
      if (got === expected) ok(`resumes at "${expected}" with ${label}`);
      else fail(`with ${label} the derivation resumed at "${got}", expected "${expected}"`);
    });

    // --- (c) a run with no ledger at all is a fresh run, not a crash --------------------------
    const bare = invoke(tree("no-ledger", { status: null }));
    if (bare.code === 0 && bare.json?.status === null && bare.json?.next_phase === "orient") {
      ok("a tree with no harness-run.md derives status null and resumes at orient");
    } else {
      fail(`a ledger-less tree did not derive cleanly: exit ${bare.code}, ${bare.raw.trim().slice(0, 120)}`);
    }

    // --- (d) status may not decide the phase, for ANY of its values ---------------------------
    // The load-bearing regression guard. (a) proves one stale value is ignored; this proves the
    // field is not consulted at all, so a status branch cannot be reintroduced quietly.
    const phases = new Set();
    for (const status of ["orienting", "mapping", "building", "evaluating", "shipped", "escalated"]) {
      const t = tree(`status-${status}`, { status, orient: FULL_ORIENT, wiringMap: true, scopes: ["SC-1"] });
      phases.add(invoke(t).json?.next_phase);
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

    // --- (g) the substrate pointer, the write that must not fail quietly ----------------------
    const pointerTree = tree("pointer", { status: "building", orient: FULL_ORIENT, wiringMap: true, scopes: ["SC-1", "SC-2"] });
    const pointed = invoke(pointerTree, ["--set-active-scope", "SC-2"]);
    let pointer = null;
    try { pointer = JSON.parse(readFileSync(join(pointerTree, ".shapeup", "active-scope"), "utf8")); } catch { /* reported below */ }
    if (pointed.code === 0 && pointer?.scope_id === "SC-2" && pointer?.slug === SLUG) {
      ok("--set-active-scope writes the pointer sandbox-guard reads, and reports it back by value");
    } else {
      fail(`the substrate pointer did not land: exit ${pointed.code}, on disk ${JSON.stringify(pointer)} — a worker would be held to another scope's substrate`);
    }

    // The failure arm, and the reason this check exists in this shape. A first version of it
    // asserted only the happy path, and mutation-testing caught that: deleting the write's own
    // read-back left every assertion green. A pointer that cannot be written must produce the same
    // outcome record every other operation here produces — never a stack trace with an empty
    // stdout, which tells the workflow "non-zero" and its log nothing. The tree below makes the
    // write impossible by putting a FILE where the local root's directory has to go.
    const blocked = join(ws, "pointer-blocked");
    mkdirSync(blocked, { recursive: true });
    writeFileSync(join(blocked, ".shapeup"), "not a directory\n");
    const refused = spawnSync("node", [SCRIPT, "--slug", SLUG, "--cwd", blocked, "--set-active-scope", "SC-1"], { encoding: "utf8" });
    let refusedJson = null;
    try { refusedJson = JSON.parse(refused.stdout); } catch { /* asserted below */ }
    if (refused.status === 3 && refusedJson?.ok === false && refusedJson?.reason) {
      ok("--set-active-scope reports an unwritable pointer as an outcome record (exit 3 + reason), not as a stack trace");
    } else {
      fail(`an unwritable substrate pointer produced exit ${refused.status} with stdout ${JSON.stringify(refused.stdout).slice(0, 120)} — the caller cannot log why the scope was refused`);
    }

    // --- (h) the workflow actually consults it (the fd5ad3d guard) ----------------------------
    // A Workflow script cannot be imported, so this is a source assertion — the only mechanical
    // check available for the wiring. It is narrow on purpose: it asserts the ORIENT branch reads
    // the artifact predicate and that no phase decision reads `facts.status`.
    const WF = join(ROOT, "skills/tech-lead/workflows/shapeup-run.js");
    const wfSrc = existsSync(WF) ? readFileSync(WF, "utf8") : "";
    const wfCode = wfSrc.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
    if (/if\s*\(\s*!\s*facts\.has_orient_artifacts\s*\)/.test(wfCode)) {
      ok("shapeup-run.js gates ORIENT on facts.has_orient_artifacts");
    } else {
      fail("shapeup-run.js does not gate ORIENT on facts.has_orient_artifacts — the derivation is correct and unused");
    }
    if (!/facts\.status/.test(wfCode)) {
      ok("no phase decision in shapeup-run.js reads facts.status — the field survives for its other readers only");
    } else {
      fail("shapeup-run.js still branches on facts.status — stored state is back in the resume decision");
    }
    if (!/resume-state\.mjs/.test(wfCode)) {
      fail("shapeup-run.js never invokes resume-state.mjs — the fast-forward is deriving state some other way");
    } else {
      ok("shapeup-run.js derives its resume state by invoking resume-state.mjs");
    }
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
