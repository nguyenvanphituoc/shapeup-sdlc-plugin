// 66 — the defect-sweep Stage 7 fix. Two derivations of "whose file is this" now agree: a path
// declared only in a contract's `shared_substrate` reports a writer, not UNOWNED.
//
// THE DEFECT THIS CLOSES. The sandbox fence composes a scope's writable substrate as
// `allowed ∪ shared` (`hooks/sandbox-guard.mjs`), and `substrateFor` maps a contract's
// `shared_substrate` straight into that union — so a path a scope declares ONLY in `shared` is a
// file that scope may legitimately write. `electOwner` and `probe owner`'s `ownership()` used to
// filter on `allowed` alone: a shared-only path elected no one, `probe owner`'s JSON and its
// rendered table both called it UNOWNED, and `bugsForScope` read the null election as "no scope
// owns this" and handed the bug to every scope in the run rather than the one or two that
// declared it. The fix elects from `allowed ∪ shared`, with a scope that owns the path
// EXCLUSIVELY (in `allowed`, not also in `shared`) still preferred over one that only shares it.
//
// This module drives the real functions and the real CLI against fixtures built to fail before
// the fix (mutation is asserted at the end, not merely a green run): a shared-only path used to
// come back `owner: null`, `writers: []`, and every scope's `bugsForScope` call included it
// marked `unowned: true`.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
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

/** Run a kernel subcommand. */
function kernel(ROOT, argv, cwd) {
  return spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), ...argv], { cwd, encoding: "utf8", timeout: 60_000 });
}

const SLUG = "own-demo";

/**
 * A project fixture with two scope contracts, both declaring `src/shared/config.json` ONLY in
 * `shared_substrate` (never in their own `allowed_file_substrate`) — the exact shape the register
 * measured. `core` sorts before `ui`, so an election among equal (both-shared) candidates must
 * prefer `core`.
 */
function project() {
  const cwd = mkdtempSync(join(tmpdir(), "struct-shared-owner-"));
  mkdirSync(join(cwd, ".git"), { recursive: true });
  w(cwd, `shapeup/${SLUG}/scopes/core.md`, [
    "---", "type: scope-contract", "scope_id: core", `feature: ${SLUG}`,
    "topology_type: CHOWDER", "use_cases: [UC-01]",
    "allowed_file_substrate: [src/core/**]", "shared_substrate: [src/shared/config.json]",
    "hill_phase: UPHILL_UNKNOWN", "e2e_verification_fixtures: [exit 0]", "---", "", "# core", "",
  ].join("\n"));
  w(cwd, `shapeup/${SLUG}/scopes/ui.md`, [
    "---", "type: scope-contract", "scope_id: ui", `feature: ${SLUG}`,
    "topology_type: CHOWDER", "use_cases: [UC-02]",
    "allowed_file_substrate: [src/ui/**]", "shared_substrate: [src/shared/config.json]",
    "hill_phase: UPHILL_UNKNOWN", "e2e_verification_fixtures: [exit 0]", "---", "", "# ui", "",
  ].join("\n"));
  w(cwd, "src/core/Core.ts", "// core\n");
  w(cwd, "src/ui/View.ts", "// view\n");
  w(cwd, "src/shared/config.json", "{}\n");
  return cwd;
}

/**
 * Run the shared-ownership checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const boxes = [];

  section("104. electOwner and ownership() elect from allowed ∪ shared — the fence's own union");
  try {
    const { electOwner, bugsForScope } = await import(join(ROOT, "kernel/compile.mjs"));
    const { ownership } = await import(join(ROOT, "kernel/probe/owner.mjs"));

    const scopes = [
      { scope_id: "core", allowed: ["src/core/**"], shared: ["src/shared/config.json"] },
      { scope_id: "ui", allowed: ["src/ui/**"], shared: ["src/shared/config.json"] },
    ];
    const SHARED = "src/shared/config.json";

    // (a) A shared-only path elects a scope, never null — and prefers the lowest id when neither
    // candidate holds it exclusively.
    const owner = electOwner(SHARED, scopes);
    if (owner === "core") ok("electOwner elects a writer for a path declared only in shared_substrate (lowest id among equally-shared candidates)");
    else fail(`electOwner(shared-only path) = ${JSON.stringify(owner)}, expected "core"`);

    // (b) ownership()'s `writers` is the same union the fence composes — both declaring scopes,
    // not the empty set `allowed`-only filtering produced.
    const rep = ownership(SHARED, scopes);
    if (JSON.stringify(rep.writers) === JSON.stringify(["core", "ui"])) ok("ownership().writers is allowed ∪ shared — both scopes that declared it shared report as writers");
    else fail(`ownership(shared-only path).writers = ${JSON.stringify(rep.writers)}, expected ["core","ui"]`);
    if (rep.owner === "core") ok("ownership().owner agrees with electOwner for the same path");
    else fail(`ownership(shared-only path).owner = ${JSON.stringify(rep.owner)}, expected "core"`);

    // (c) EXCLUSIVE STILL PREFERRED: a scope holding the path in `allowed` (not also `shared`)
    // wins over one that only shares it, whichever id sorts first.
    const mixed = [
      { scope_id: "aaa-shared-only", allowed: [], shared: ["src/mixed.txt"] },
      { scope_id: "zzz-exclusive", allowed: ["src/mixed.txt"], shared: [] },
    ];
    if (electOwner("src/mixed.txt", mixed) === "zzz-exclusive") ok("an exclusive writer (allowed, not shared) is still preferred over a shared-only writer, even when its id sorts later");
    else fail(`electOwner preferred ${electOwner("src/mixed.txt", mixed)} over the exclusive owner`);

    // (d) NON-REGRESSION: a path no scope declares anywhere is still unowned — the fix must not
    // widen elections past what any contract actually grants.
    if (electOwner("src/nowhere.txt", scopes) === null) ok("a path declared in no scope's allowed or shared substrate still elects nobody (non-regression)");
    else fail(`electOwner elected an owner for an undeclared path: ${electOwner("src/nowhere.txt", scopes)}`);
    const repNone = ownership("src/nowhere.txt", scopes);
    if (repNone.writers.length === 0 && repNone.owner === null) ok("ownership() still reports an undeclared path as unowned (non-regression)");
    else fail(`ownership(undeclared path) = ${JSON.stringify(repNone)}`);

    // (e) THE OVER-DISPATCH FIX: a bug cited against the shared-only path reaches the elected
    // scope only — not every scope in the run, and not marked `unowned`.
    const bugs = [{ id: "BUG-shared", location: SHARED }];
    const forCore = bugsForScope(bugs, "core", scopes);
    const forUi = bugsForScope(bugs, "ui", scopes);
    if (forCore.length === 1 && !forCore[0].unowned) ok("bugsForScope addresses a shared-only-path bug to the elected scope, not flagged unowned");
    else fail(`bugsForScope(core) = ${JSON.stringify(forCore)}`);
    if (forUi.length === 0) ok("bugsForScope does NOT hand the same bug to the other declaring scope — one election, one fixer");
    else fail(`bugsForScope(ui) unexpectedly carried the bug: ${JSON.stringify(forUi)}`);

    // (f) MUTATION: revert to the pre-fix (allowed-only) filter inline and confirm the guard this
    // module exists for actually goes red — proving the assertions above discriminate rather than
    // passing on a fixture too weak to exercise the defect.
    const preFixElectOwner = (path, ss) => {
      const can = (ss || []).filter((s) => (s.allowed || []).some((g) => g === path));
      return can.length ? can.map((s) => s.scope_id).sort()[0] : null;
    };
    if (preFixElectOwner(SHARED, scopes) === null) ok("mutation check: the pre-fix allowed-only election DOES elect nobody for the shared-only path — the fixture exercises the defect this module closes");
    else fail("mutation check failed to reproduce the pre-fix defect — this module's fixture would not have caught the regression");
  } catch (e) { fail(`electOwner/ownership union checks threw: ${e.stack || e}`); }

  section("105. probe owner (CLI) — JSON and the rendered table agree on one contract");
  try {
    const cwd = project();
    boxes.push(cwd);

    const j = kernel(ROOT, ["probe", "owner", "--slug", SLUG, "--cwd", cwd, "--path", "src/shared/config.json", "--format", "json"], cwd);
    let rep = null;
    try { rep = JSON.parse(j.stdout); } catch { /* fall through */ }
    const row = rep?.paths?.[0];
    if (j.status === 0 && row?.owner === "core" && JSON.stringify(row.writers) === JSON.stringify(["core", "ui"])) {
      ok("probe owner (JSON): a shared-only path elects core and lists both declaring scopes as writers");
    } else {
      fail(`probe owner --format json: exit ${j.status}, row ${JSON.stringify(row)}\n${j.stderr}`);
    }
    if (Array.isArray(rep?.unowned) && !rep.unowned.includes("src/shared/config.json")) ok("probe owner (JSON): the shared-only path is absent from `unowned`");
    else fail(`probe owner JSON unowned list wrongly includes the shared-only path: ${JSON.stringify(rep?.unowned)}`);

    const t = kernel(ROOT, ["probe", "owner", "--slug", SLUG, "--cwd", cwd, "--path", "src/shared/config.json", "--format", "table"], cwd);
    const line = (t.stdout || "").split("\n").find((l) => l.startsWith("src/shared/config.json"));
    if (t.status === 0 && line && /\bcore\b/.test(line) && !/UNOWNED/.test(line)) ok("probe owner (table): the same path's row names an owner and lists writers, never UNOWNED");
    else fail(`probe owner --format table: exit ${t.status}, row ${JSON.stringify(line)}\n${t.stdout}`);
    if (/0 unowned path\(s\)/.test(t.stdout)) ok("probe owner (table): the census footer agrees — 0 unowned paths, matching the JSON `unowned` list");
    else fail(`probe owner table footer did not report 0 unowned: ${t.stdout.split("\n").slice(-2).join(" | ")}`);

    // A path genuinely outside every substrate still reports UNOWNED in both shapes — the census
    // must still be able to say "no scope owns X" when that is true.
    const jNone = kernel(ROOT, ["probe", "owner", "--slug", SLUG, "--cwd", cwd, "--path", "src/nowhere.txt", "--format", "json"], cwd);
    let repNone = null;
    try { repNone = JSON.parse(jNone.stdout); } catch { /* fall through */ }
    const tNone = kernel(ROOT, ["probe", "owner", "--slug", SLUG, "--cwd", cwd, "--path", "src/nowhere.txt", "--format", "table"], cwd);
    if (repNone?.unowned?.includes("src/nowhere.txt") && /UNOWNED/.test(tNone.stdout)) ok("probe owner still reports a genuinely unowned path as UNOWNED in both JSON and the table (non-regression)");
    else fail(`probe owner on an undeclared path: json unowned=${JSON.stringify(repNone?.unowned)}, table=${tNone.stdout.slice(0, 200)}`);
  } catch (e) { fail(`probe owner CLI checks threw: ${e.stack || e}`); }

  for (const b of boxes) { try { rmSync(b, { recursive: true, force: true }); } catch { /* best effort */ } }
}
