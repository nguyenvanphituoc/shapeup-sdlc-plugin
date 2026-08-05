#!/usr/bin/env node
// Row renderer for the Tier-1 lint oracles — REPO-ONLY dev/CI asset, zero spend, zero judgement.
//
// WHY THIS FILE EXISTS, AND WHAT IT DELIBERATELY IS NOT.
//
// docs/internal/plan/ratchet-and-receipt-plan.md §0's whole thesis is that a Tier-1 rubric should be a LOOKUP rather than a
// judgement: each of these five skills is sole writer of a committed artifact that a deterministic
// script already grades, so the rubric delegates and inherits none of an author's blind spots.
// The obstacle is a format mismatch, not a semantic one — `spec-lint.mjs` and `trace-lint.mjs`
// print a JSON report, and `detector.rows` needs `PASS <id> <label>` lines so a criterion can score
// the FRACTION of rows passing. Without rows a five-rule contract scores 0 or 1 and the delta has
// two reachable values; that defect is already on the record (fifteen consecutive rounds at 4-of-5,
// every one recorded as 0.0).
//
// So this is a FORMATTER. Every row is a read of a report the real oracle produced — this file
// imports `lint()` and `traceLint()` rather than re-implementing them, because a second
// implementation of a rule is a second rule, and the two would drift.
//
// THE ONE PLACE IT ADDS SEMANTICS, DECLARED RATHER THAN BURIED:
//
//   * VACUOUS TRUTH IS NOT A PASS. "no scope violates PA1" is trivially true of a draft that wrote
//     no scopes, and a lint that reports zero findings for zero artifacts would score an empty
//     directory 1.0. Structural §48(d) already asserts an empty draft must score at or below the
//     weak floor, so every profile below fails ALL of its rows when the artifact it grades is
//     absent. This is not a stricter reading of the oracle; it is the difference between "checked
//     and clean" and "nothing to check", which a findings array cannot express.
//
//   * COVERAGE ROWS. Two rows (SA-COVERAGE, WM-UC-COVERAGE) assert that the artifact accounts for
//     every input it was handed — every board task claimed by a scope, every use case wired. No
//     existing oracle checks these. They are therefore AUTHORED, they are counted as authored in
//     the rubric's own note, and they exist because without them a one-line artifact maximises the
//     fraction: a single scope claiming nothing passes PA1/PA2/DISJOINT by having nothing to
//     violate. Both are derivable from the fixture's own seeded input, which is §0's binding rule.
//
// Usage:  node evals/oracles/lint-rows.mjs --profile <scopes|wiring|spec> --slug <slug> [--cwd <dir>]
// Output: one `PASS|FAIL  <ID>  <label>` line per row, then a summary line.
// Exit:   0 = every row passed · 1 = at least one failed · 2 = usage/contract error (the loop
//         treats 2 as a BROKEN INSTRUMENT and aborts rather than scoring the artifact 0).

import { existsSync, readdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { lint } from "../../skills/ba-pitch-analyzer/scripts/spec-lint.mjs";
import { parseBoard } from "../../skills/ba-pitch-analyzer/scripts/board-derive.mjs";
import { traceLint } from "../../skills/tech-lead/scripts/trace-lint.mjs";
import { runFixtures } from "../../skills/tech-lead/scripts/t0-verify.mjs";
import { readAllContracts, readContract, splitFrontmatter, unreadableReason, SCOPE_CONTRACT, WIRING_MAP } from "../../skills/tech-lead/scripts/lib/contract-md.mjs";
import { scopesDir, tasksDir, usecasesDir, wiringMap as wiringMapPath } from "../../skills/tech-lead/scripts/lib/paths.mjs";

/**
 * One row: an id, whether it passed, and the label that becomes the revision instruction.
 * @param {string} id - Stable row id (`SA-PA1`); it is what the loop tells the model to fix.
 * @param {boolean} pass - Whether the row passed.
 * @param {string} label - Human-readable statement of what the row requires and what was observed.
 * @returns {{id:string, pass:boolean, label:string}} The row.
 */
const row = (id, pass, label) => ({ id, pass, label });

/**
 * Read a `[a, b]` frontmatter list off a task body.
 *
 * Delegates to `splitFrontmatter`, the SAME reader board-derive and the contracts use. An earlier
 * version regex-matched the inline `[a, b]` form only, which is HD-004 — a third parser drifting
 * from the other two, and it would have scored a block-sequence board 0 for a serialization reason.
 * @param {string} body - The task file's full text.
 * @param {string} key - Frontmatter key.
 * @returns {string[]} Members, or [] when the key is absent.
 */
function frontmatterList(body, key) {
  const v = splitFrontmatter(String(body || "")).meta[key];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return v === null || v === undefined || v === "" ? [] : [String(v).trim()];
}

/**
 * Rows for `scope-architect` — the scope-contract slicing rules `spec-lint.mjs` already enforces.
 *
 * Four of the five rows are direct reads of the lint's own findings array (PA1, PA2, DISJOINT and
 * the L1b gate condition `red == 0`). SA-PRESENT is the vacuous-truth guard; SA-COVERAGE is the one
 * authored row, and it is what stops a single empty contract from scoring 0.8 by having nothing to
 * violate.
 *
 * @param {{cwd:string, slug:string}} opts - Workspace root and feature slug.
 * @returns {Array<{id:string, pass:boolean, label:string}>} Six rows, always the same six.
 */
export function scopeRows({ cwd, slug }) {
  const contracts = readAllContracts(scopesDir(cwd, slug), SCOPE_CONTRACT).map((c) => c.contract);
  const report = lint({ cwd, slug });
  const has = (rule) => report.findings.filter((f) => f.rule === rule);
  // Nothing to certify. Every row fails — see the vacuous-truth note in the header.
  if (!contracts.length) {
    return ["SA-PRESENT", "SA-FIXTURES", "SA-PA1", "SA-PA2", "SA-DISJOINT", "SA-COVERAGE"].map((id) =>
      row(id, false, `no scope contract was written to shapeup/${slug}/scopes/ — there is nothing for this rule to certify`));
  }

  const tasks = parseBoard(tasksDir(cwd, slug)).map((t) => t.id);
  const claimed = new Map();
  for (const c of contracts) for (const id of c.tasks || []) claimed.set(id, (claimed.get(id) || 0) + 1);
  const missing = tasks.filter((id) => !claimed.has(id));
  const doubled = tasks.filter((id) => (claimed.get(id) || 0) > 1);
  const stray = [...claimed.keys()].filter((id) => !tasks.includes(id));

  // SA-FIXTURES — the EXTERNAL-FACT row, and the third authored one.
  //
  // Every other row here is checkable from the artifact and its seeded inputs. This one is not: a
  // scope's `e2e_verification_fixtures` are commands, and whether a command works is a fact about
  // the CODEBASE that the model has to go and find. SKILL.md's own rule is the criterion, verbatim
  // — "too speculative to fixture → mark TBD and flag it, NEVER INVENT A FIXTURE FOR UNBUILT
  // BEHAVIOR" — so a fixture naming a command the CLI does not implement is a craft failure by the
  // skill's own contract, not by this file's taste.
  //
  // Graded by running it. `TBD` is exempt and is the correct answer for a scope whose behaviour is
  // not built; anything else must exit 0 against the codebase as it stands.
  const fixtures = [];
  for (const c of contracts) {
    for (const f of c.e2e_verification_fixtures || []) {
      const cmd = String(f).trim();
      if (!cmd || /^TBD\b/i.test(cmd)) continue;
      // SEEDED, and this is a correction to the first version of this row rather than a nicety.
      // Run against an EMPTY store, `done 1` exits non-zero — there is no item 1 — so a perfectly
      // good fixture would fail for a reason that is about the probe's environment, not about the
      // skill. That is plan §0 risk 2 (the apparatus becoming the target) and it was caught by the
      // hand-authored STRONG reference failing its own row. The fact this row exists to check is
      // "does this command EXIST in the built CLI", so the state it needs to exercise is supplied.
      // Fresh store per probe: these write, and one fixture must not set up the next.
      const box = mkdtempSync(join(tmpdir(), "sa-fixture-"));
      const store = join(box, "store.json");
      writeFileSync(store, JSON.stringify([
        { text: "write the pitch", done: false },
        { text: "review the board", done: true },
        { text: "ship it", done: false },
      ]));
      // DELEGATED TO t0-verify's OWN RUNNER, not re-implemented, and the difference was measurable.
      // The first version spawned a split argv; production runs `spawnSync(cmd, {shell: true})`, so
      // the shapes a worker legitimately writes — `TODO_STORE=$X node … # what this asserts` — ran
      // fine at GATE L2 and failed here. A row that grades a command differently from the gate that
      // will actually run it is measuring the eval harness, which is plan §0 risk 2 again.
      const prev = process.env.TODO_STORE;
      process.env.TODO_STORE = store;
      let r;
      try { r = runFixtures([cmd], cwd).results[0]; }
      finally { if (prev === undefined) delete process.env.TODO_STORE; else process.env.TODO_STORE = prev; }
      rmSync(box, { recursive: true, force: true });
      fixtures.push({ scope: c.scope_id, cmd, ok: r.pass, why: r.error || (r.stderr || "").trim().slice(0, 120) });
    }
  }
  const broken = fixtures.filter((f) => !f.ok);

  const pa1 = has("PA1"), pa2 = has("PA2"), dj = has("DISJOINT");
  return [
    row("SA-PRESENT", contracts.length > 0, `${contracts.length} scope contract(s) parsed from shapeup/${slug}/scopes/`),
    row("SA-FIXTURES", broken.length === 0 && fixtures.length > 0,
      fixtures.length === 0
        ? "no runnable e2e_verification_fixture was declared by any scope — at least one scope covers behaviour that IS built, so at least one fixture must actually run"
        : broken.length
        ? `every e2e_verification_fixture must RUN GREEN against the codebase as it stands, or be literally \`TBD\` for behaviour that is not built yet — these do neither: ${broken.map((f) => `${f.scope}: \`${f.cmd}\` exited non-zero${f.why ? ` (${f.why})` : ""}`).join("; ")}`
        : `all ${fixtures.length} declared fixture command(s) run green; the rest are TBD`),
    row("SA-PA1", pa1.length === 0, pa1.length ? `PA1 (layer-thinking): ${pa1.map((f) => `${f.scope} — ${f.detail}`).join("; ")}` : "PA1: no scope substrate aligns 1:1 with a single top-level directory"),
    row("SA-PA2", pa2.length === 0, pa2.length ? `PA2 (substrate size): ${pa2.map((f) => `${f.scope} — ${f.detail}`).join("; ")}` : "PA2: every substrate resolves within the size cap"),
    row("SA-DISJOINT", dj.length === 0, dj.length ? `DISJOINT (undeclared overlap): ${dj.map((f) => `${f.scope} — ${f.detail}`).join("; ")}` : "DISJOINT: no file is in two substrates without both declaring it shared"),
    row("SA-COVERAGE", missing.length === 0 && doubled.length === 0 && stray.length === 0,
      missing.length || doubled.length || stray.length
        ? `every board task must be claimed by exactly one scope — unclaimed [${missing.join(", ")}], claimed twice [${doubled.join(", ")}], named but not on the board [${stray.join(", ")}]`
        : `all ${tasks.length} board tasks are claimed by exactly one scope`),
  ];
}

/**
 * Rows for `solution-architect` — reachability from `trace-lint.mjs` plus the WiringEntry schema's
 * own required fields.
 *
 * WM-REACH is the oracle's verdict verbatim: a use case whose engine is never imported from the
 * project profile's `entry_point` is the documented motivating failure (631 lines, 26 passing
 * tests, zero call sites). The field rows are the schema's, not this file's — `WiringEntry` names
 * `wiring_seam`, `entry_call_site` and `affordance`, and an entry missing one is an incomplete
 * record by the domain registry's definition rather than by a grader's taste.
 *
 * @param {{cwd:string, slug:string}} opts - Workspace root and feature slug.
 * @returns {Array<{id:string, pass:boolean, label:string}>} Six rows, always the same six.
 */
export function wiringRows({ cwd, slug }) {
  const IDS = ["WM-PRESENT", "WM-UC-COVERAGE", "WM-ENGINE-RESOLVES", "WM-REACH", "WM-SEAM", "WM-AFFORDANCE"];
  const { report } = traceLint(slug, { cwd });
  const rc = report.reachability || {};
  const mapPath = wiringMapPath(cwd, slug);
  if (!existsSync(mapPath)) return IDS.map((id) => row(id, false, `no wiring map at shapeup/${slug}/wiring-map.md — there is nothing for this rule to certify`));

  // Re-read the map through the SAME parser trace-lint used (contract-md is the only reader of the
  // file form), so the field rows describe exactly the entries the reachability row was computed
  // over. A second parser here would drift from the one the harness actually runs.
  const parsed = readContract(mapPath, WIRING_MAP)?.contract;
  const entries = parsed?.entries || [];
  if (!entries.length) {
    // HD-001's diagnosis, passed straight through as the revision instruction. "No rows in the
    // `## Wiring` table" is true but unactionable when the rows are RIGHT THERE under a different
    // heading; `unreadableReason` says which heading it found them under and which one it needs.
    const why = unreadableReason(parsed)
      || `wiring-map.md has no rows in its \`## Wiring\` table — there is nothing for this rule to certify`;
    return IDS.map((id) => row(id, false, why));
  }

  const ucDir = usecasesDir(cwd, slug);
  const ucs = existsSync(ucDir) ? readdirSync(ucDir).filter((f) => /^UC-.*\.md$/.test(f)).map((f) => (f.match(/^UC-\d+/) || [f])[0]) : [];
  const wired = new Set(entries.map((e) => String(e.use_case || "").trim()).map((u) => (u.match(/UC-\d+/) || [u])[0]));
  const unwired = ucs.filter((u) => !wired.has(u));

  const unreachable = rc.unreachable || [];
  const missingEngine = unreachable.filter((u) => /not on disk/.test(u.reason || ""));
  const noSeam = entries.filter((e) => !String(e.wiring_seam || "").trim());
  const noAff = entries.filter((e) => !String(e.affordance || "").trim());

  return [
    row("WM-PRESENT", true, `wiring-map.md parsed with ${entries.length} entr(ies)`),
    row("WM-UC-COVERAGE", unwired.length === 0, unwired.length ? `every use case in the spec must have a wiring row — unwired: ${unwired.join(", ")}` : `all ${ucs.length} use cases have a wiring row`),
    row("WM-ENGINE-RESOLVES", missingEngine.length === 0, missingEngine.length ? `engine file not on disk: ${missingEngine.map((u) => `${u.use_case} → ${u.engine}`).join("; ")}` : "every named engine resolves to a source file on disk"),
    // VACUOUS TRUTH, one level finer, and it was live: an engine cell that does not resolve to a
    // file cannot be walked, so trace-lint files it under `unreachable` with reason "not on disk"
    // and there is nothing left for the import walk to find orphaned. Excluding those from this row
    // — which the first version did, to keep it distinct from WM-ENGINE-RESOLVES — made WM-REACH
    // report "all 6 engines reach the entry point" for a map where SIX of six engines had never
    // been resolved at all. Measured on a paid run: 5/6 rows green on a map that demonstrated no
    // reachability whatsoever. Reachability is UNPROVEN unless every engine resolved AND was
    // reached, so this row now reads the oracle's `unreachable` list whole. WM-ENGINE-RESOLVES
    // stays as the finer diagnosis of WHY, not as an excuse for this row to pass.
    row("WM-REACH", rc.checked === true && unreachable.length === 0,
      rc.checked !== true ? `reachability could not run: ${rc.skipped_reason || "unknown"}`
        : unreachable.length ? `reachability from entry_point "${rc.entry_point}" is not demonstrated for: ${unreachable.map((u) => `${u.use_case} → ${u.engine} (${u.reason})`).join("; ")}. An engine that ships orphaned is unreachable; so is one whose path does not resolve, because nothing can be walked from it.`
        : `all ${rc.engines_total} engines reach entry_point "${rc.entry_point}"`),
    row("WM-SEAM", noSeam.length === 0, noSeam.length ? `WiringEntry.wiring_seam is empty for: ${noSeam.map((e) => e.use_case).join(", ")}` : "every entry names its wiring seam"),
    row("WM-AFFORDANCE", noAff.length === 0, noAff.length ? `WiringEntry.affordance is empty for: ${noAff.map((e) => e.use_case).join(", ")}` : "every entry names the user-visible affordance it reaches"),
  ];
}

/**
 * Rows for `ba-pitch-analyzer` — one per structural rule `spec-lint.mjs` enforces over a spec tree
 * and the board derived from it.
 *
 * WHAT THIS DOES NOT GRADE, and it must ride with the number: the plan's P4 also names "DAG
 * acyclic" and "every UC has a Test-Surface row". No existing oracle checks either, so neither is
 * measured here. Inventing them would be exactly the authored-criteria failure Tier 1 exists to
 * avoid, and the honest disposition is a gap on the record rather than a rule of this file's own.
 *
 * @param {{cwd:string, slug:string}} opts - Workspace root and feature slug.
 * @returns {Array<{id:string, pass:boolean, label:string}>} Nine rows, always the same nine.
 */
export function specRows({ cwd, slug }) {
  const IDS = ["BA-DOMAIN", "BA-USECASES", "BA-UC-STEPS", "BA-BOARD", "BA-TASK-FIELDS", "BA-TASK-DEPS", "BA-EDGE-SYMMETRY", "BA-UC-ANCHOR", "BA-WIKILINK", "BA-TOUCHED"];
  const report = lint({ cwd, slug });
  const tasks = parseBoard(tasksDir(cwd, slug));
  const specMissing = report.findings.some((f) => f.rule === "STRUCTURE" && /domain-model\.md missing/.test(f.detail));
  const noUcs = report.findings.some((f) => f.rule === "STRUCTURE" && /no UC-\*\.md/.test(f.detail));
  if (specMissing && noUcs && !tasks.length) {
    return IDS.map((id) => row(id, false, `no spec tree and no board were written under shapeup/${slug}/ — there is nothing for this rule to certify`));
  }
  const of = (rule, re = null) => report.findings.filter((f) => f.rule === rule && (!re || re.test(f.detail)));
  const say = (fs) => fs.map((f) => f.detail).join("; ");

  const steps = of("STRUCTURE", /no ## Steps/);
  const fields = of("TASK", /missing frontmatter/);
  const deps = of("TASK", /depends_on/);
  const edges = of("EDGE-SYMMETRY");
  const anchors = of("UC-ANCHOR");
  const links = [...of("WIKILINK"), ...of("TIER-DIRECTION")];
  // Vacuous truth again, one level finer than the whole-artifact guard above: `spec-lint` reports
  // no TASK finding for a board with no tasks, and no UC-STEPS finding for a spec with no use
  // cases. Read straight, four of these nine rows would PASS for an artifact that has not been
  // written — a spec tree with only use cases would score 6/9 for the parts it omitted. A rule
  // whose subject is absent has not been satisfied.
  const noBoard = tasks.length === 0;
  const boardRow = (id, clean, bad, good) => row(id, !noBoard && clean, noBoard ? `${good} — but the board is empty, so this rule has nothing to certify` : clean ? good : bad);

  return [
    row("BA-DOMAIN", !specMissing, specMissing ? "spec/domain-model.md is missing — the spec tree has no domain model" : "spec/domain-model.md present"),
    row("BA-USECASES", !noUcs, noUcs ? "spec/usecases/ contains no UC-*.md — nothing to build or grade against" : "spec/usecases/ contains at least one UC-*.md"),
    row("BA-UC-STEPS", !noUcs && steps.length === 0, noUcs ? "no use case exists, so the ## Steps rule has nothing to certify" : steps.length ? `every use case needs a ## Steps section: ${say(steps)}` : "every use case has a ## Steps section"),
    row("BA-BOARD", !noBoard, noBoard ? `no TASK-*.md was written to .shapeup/${slug}/tasks/ — the board is empty` : `${tasks.length} task(s) parsed from .shapeup/${slug}/tasks/`),
    boardRow("BA-TASK-FIELDS", fields.length === 0, `task frontmatter incomplete: ${say(fields)}`, "every task carries id and status in its frontmatter"),
    boardRow("BA-TASK-DEPS", deps.length === 0, `dangling dependency: ${say(deps)}`, "every depends_on names a task that exists"),
    boardRow("BA-EDGE-SYMMETRY", edges.length === 0, `unlocks/depends_on are not mutual inverses: ${say(edges)}`, "unlocks is the exact inverse of depends_on across the board"),
    boardRow("BA-UC-ANCHOR", anchors.length === 0, `every task must anchor into a use case that exists: ${say(anchors)}`, "every task anchors to a use case present in the spec"),
    row("BA-WIKILINK", links.length === 0, links.length ? `link integrity: ${say(links)}` : "every wikilink resolves and no committed doc links the local board"),
    // BA-TOUCHED — the EXTERNAL-FACT row, added once dial three was confirmed elsewhere.
    //
    // Every other row here is checkable from the pitch and the board's own internal consistency,
    // and this skill scored 1.0 first-draft against all nine of them even at 20 tasks and 36 edges.
    // `touched_files` is different in kind: it is a claim about a CODEBASE ON DISK, and it is
    // optional to plausibility — `src/list.js` reads exactly as well as `src/review/list.js` on the
    // page, and only one of them exists. Skipped entirely when the fixture seeds no source tree, so
    // this stays inert for a greenfield board where naming unwritten files is correct.
    ...(existsSync(join(cwd, "src")) ? [(() => {
      const bad = [];
      for (const t of tasks) {
        for (const p of frontmatterList(t.body, "touched_files")) {
          if (!existsSync(join(cwd, p))) bad.push(`${t.id} → ${p}`);
        }
      }
      const declared = tasks.filter((t) => frontmatterList(t.body, "touched_files").length).length;
      return row("BA-TOUCHED", !noBoard && declared > 0 && bad.length === 0,
        noBoard || declared === 0
          ? "every task must name the real module it changes in `touched_files`; none did"
          : bad.length
          ? `every path in touched_files must be a file that EXISTS in src/ — these do not: ${bad.join(", ")}. The layout is not guessable from the command name; read the tree.`
          : `every touched_files path across ${declared} task(s) resolves to a real module on disk`);
    })()] : []),
  ];
}

const PROFILES = { scopes: scopeRows, wiring: wiringRows, spec: specRows };

/**
 * Render rows in the `PASS|FAIL  ID  label` form `detector.rows` parses.
 * @param {Array<{id:string, pass:boolean, label:string}>} rows - The rows to render.
 * @returns {string} The report body.
 */
export function formatRows(rows) {
  const lines = rows.map((r) => `${r.pass ? "PASS" : "FAIL"}  ${r.id}  ${r.label}`);
  const failed = rows.filter((r) => !r.pass).length;
  lines.push("", `${rows.length - failed}/${rows.length} rows pass${failed ? ` — ${failed} to fix` : ""}`);
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const argv = process.argv.slice(2);
  const flag = (n) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : null; };
  const profile = flag("--profile");
  const slug = flag("--slug");
  if (!profile || !PROFILES[profile] || !slug) {
    // Exit 2, not 1: the loop's oracle head treats 2 as a misconfigured INSTRUMENT and aborts,
    // where a 1 would be scored as "the artifact is bad". Conflating the two is how a harness
    // defect gets published as a quality number.
    console.error(`usage: lint-rows.mjs --profile <${Object.keys(PROFILES).join("|")}> --slug <slug> [--cwd <dir>]`);
    process.exit(2);
  }
  const cwd = resolve(flag("--cwd") || process.cwd());
  let rows;
  try {
    rows = PROFILES[profile]({ cwd, slug });
  } catch (e) {
    console.error(`lint-rows: the underlying oracle threw — ${e.message}`);
    process.exit(2);
  }
  console.log(formatRows(rows));
  process.exit(rows.every((r) => r.pass) ? 0 : 1);
}
