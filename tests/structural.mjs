#!/usr/bin/env node
// Structural test layer for the Shape Up SDLC plugin — thin runner (Track C split).
//
// Zero dependencies, zero network, no Claude calls. Runs in milliseconds and is safe in CI.
// It does NOT test agent behavior (that needs tier-1/2 evals — see docs/audit). It proves the
// plugin is *well-formed*: the cheapest, highest-ROI guard, and the one that would have caught
// the broken `AGENT.md` reference and any future frontmatter/version drift.
//
// The suite is split by ownership domain into tests/structural/*.mjs; this runner threads one
// shared ctx (tests/lib/harness.mjs) through each module in order, isolates a thrown module as a
// single failure (the whole suite never aborts), then applies the §26d checks-floor against the
// grand total. The name is kept — docs cite `tests/structural.mjs` and §26c would fail otherwise.
//
// Usage:  node tests/structural.mjs        (exit 0 = pass, 1 = fail)

import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { makeCtx } from "./lib/harness.mjs";

// The suite EXECUTES the real hooks, and since v1.5 every hook evaluation appends a decision row.
// Without this redirect each `npm test` wrote ~21 rows into the developer's live
// `.shapeup/decisions.jsonl`, where `stats --hooks` would later read them back as if they
// were evaluations from a real run. Tests must not contaminate the instrument they test.
// (15-hook-receipts.mjs deliberately UNSETS this for its own spawns — it needs the real
// per-workspace path resolution to be what is under test.)
const DECISIONS_TMP = mkdtempSync(join(tmpdir(), "structural-decisions-"));
process.env.SHAPEUP_DECISIONS_PATH = join(DECISIONS_TMP, "decisions.jsonl");
process.on("exit", () => { try { rmSync(DECISIONS_TMP, { recursive: true, force: true }); } catch { /* best effort */ } });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HERE = dirname(fileURLToPath(import.meta.url));
const ctx = makeCtx(ROOT);

// Modules run in this order; the docs module (08) is last so §26d sees the full check count.
const MODULE_FILES = [
  "01-manifests.mjs",
  "02-skills.mjs",
  "03-hooks.mjs",
  "04-oracles.mjs",
  "05-tech-lead.mjs",
  "06-ba-pitch-analyzer.mjs",
  "07-spec-evaluator.mjs",
  "10-run-receipt.mjs",
  "11-is-main.mjs",
  "13-argv-contract.mjs",
  "14-invocation-paths.mjs",
  "15-hook-receipts.mjs",
  // 16-workflows.mjs: skills/tech-lead/workflows/*.js — the D5 model floor and the test-#45
  // path-literal discipline extended to Workflow scripts.
  "16-workflows.mjs",
  // 17-gate-zerowork-workflow.mjs: the zero-work gate's Workflow arm (migration A5). Its own
  // module rather than a section-37 addendum — the predicate is the cutover's, not the receipt's.
  "17-gate-zerowork-workflow.mjs",
  // 18-resume-state.mjs: the fast-forward derivation (migration A2). The kill/resume probe found
  // ORIENT re-dispatched on every relaunch because its skip read stored status instead of its own
  // artifacts; this module is the seam that defect could not be caught through.
  "18-resume-state.mjs",
  // 19-run-records.mjs: the run key and the fact tables projected from it. Its own module because
  // the property is cross-cutting — five separate writers must stamp the same key, and the failure
  // mode is the one this repo keeps hitting: stamp four of them and nothing errors.
  "19-run-records.mjs",
  // 20-run-graph.mjs: the run graph. Its own module because the properties that make a read model
  // trustworthy — derived, idempotent, backfilled by the same path that maintains it — are
  // cross-cutting, and each is lost silently: a graph that has drifted still answers every query.
  "20-run-graph.mjs",
  // 21-gauntlet.mjs: the probes this codebase's comments used to describe. A narrated probe proves
  // something about a tree that no longer exists and goes on reading as evidence anyway; these run.
  // Four of the six are here — the two that need a live model run are named in tests/README.md with
  // their status, rather than left to look like coverage this file has.
  "21-gauntlet.mjs",
  // 22-consumer-install.mjs: the installed project. §43 proves the grant matches the call sites and
  // that init writes it; nothing then looked at the tree it wrote into — where a grant that has
  // accumulated dead rules, an opt-out that is a no-op, and a second harness block all read fine.
  "22-consumer-install.mjs",
  // 23-concurrency.mjs: the leg-completion record and the instrument over it. Its own module
  // because the property is a measurement rather than a shape: the fan-out's whole acceptance
  // contract is three numbers nothing in the repo could produce, and the failure mode is a
  // confident figure computed over a record set that was missing most of its ends.
  "23-concurrency.mjs",
  // 24-parallel-isolation.mjs: what survives scopes building at the same time. Its own module
  // because the failure mode is not a crash but state that quietly disagrees with itself — and
  // because half of it has to RACE: a lock that works and a lock that is never contended produce
  // the identical green.
  "24-parallel-isolation.mjs",
  // 25-scheduler.mjs: BUILD's fan-out, read out of the shipped workflow script and EXECUTED against
  // fixtures on a virtual clock. Its own module because the invariant is a schedule, not a spelling:
  // the guard it replaces asserted one source form and would have failed a strictly better one.
  "25-scheduler.mjs",
  "45-paths.mjs",
  "46-contract-md.mjs",
  "47-ship-report.mjs",
  "50-payload-contract-parity.mjs",
  // 26-model-floor.mjs: the model floor (D3.5), executed against the shipped belowFloor()
  // predicate rather than a hand-kept copy of it — see the module's own banner for why it has to
  // be loaded this way.
  "26-model-floor.mjs",
  // 27-unwedge.mjs: `--force` actually clearing a dispatched-but-unanswered order (Phase 3.5 / S2).
  // Its own module because the defect is a permanent wedge — nothing else in the suite dispatches
  // `init run --force` against a fixture that already has a live, unanswered order on disk.
  "27-unwedge.mjs",
  // 28-t0-ratchet-fallback.mjs: the T0 ratchet's field-name bug and the fallback that survived it
  // (Phase 3.5 / S3). Its own module because no existing test drives `verify t0`'s CLI with a real
  // `ScopeContract` — every prior probe called `restore()` directly, which cannot see a caller-side
  // field-name bug or a fallback gated on the wrong condition.
  "28-t0-ratchet-fallback.mjs",
  // 29-hill-seesaw.mjs: hill.mjs no longer infers a seesaw regression check as clean from
  // `regression === false` when the check never ran (Phase 3.5 / S4). Its own module because no
  // existing test drives `deriveHill()` against a T0 verdict artifact at all.
  "29-hill-seesaw.mjs",
  // 30-order-id-collision.mjs: every operation, not only BUILD, now gets a per-leg discriminator
  // (Phase 3.5 / S5). Its own module because no existing test drives `compileOrder()` directly at
  // all — the collision only shows up when two non-BUILD calls for different scopes are compared.
  "30-order-id-collision.mjs",
  // 31-board-reconcile.mjs: the board reconciled against contracts and orders on disk (Phase 3.5 /
  // S6) — a scope with a done-marked task but no dispatched-and-answered order anywhere for it.
  // Its own module because no existing test drives `board.mjs`'s `derive()` against a fixture with
  // both a scope contract and an orders/results tree at once.
  "31-board-reconcile.mjs",
  // 32-spec-invariant-floor.mjs: the spec tree floored against a pitch that names constraints
  // (Phase 3.5 / S7) — a criteria-count check can't tell a healthy small tree from a silently
  // thin one. Its own module because no existing test drives `lintStructure()`'s new
  // `intakeContent` parameter, nor `lint()`'s wiring of `intake(cwd, slug)` into it, at all.
  "32-spec-invariant-floor.mjs",
  // 33-probe-hygiene.mjs: verification hygiene on the measuring tools themselves (Phase 3.5 / S8) —
  // the concurrency probe's leg-matching against a mechanical non-leg dispatch, and `resolveRunId`'s
  // no-slug resolution against two run directories on disk at once. Its own module because no
  // existing test drives `probe concurrency`'s `report()` over a fixture mixing build-leg and
  // non-leg rows, nor `resolveRunId(cwd, null)` with more than one run directory present.
  "33-probe-hygiene.mjs",
  // 34-scope-anchor.mjs: the scope contract anchors into the COMMITTED spec (use_cases) rather than
  // naming LOCAL task ids, and declares its own build order. Its own module because no existing test
  // drives the contract's spec anchor at all — every prior fixture carried `tasks:` as inert filler,
  // and the tier rule that forbids it (TIER-DIRECTION) only ever walked wikilinks inside spec/.
  "34-scope-anchor.mjs",
  // 35-domain-catalog.mjs: the three expressions of the domain model — the $defs type catalog, the
  // x-erd relationship catalog, and the node vocabulary reduce graph actually emits — checked
  // against each other, plus the tier rule asserted at the catalog level. Its own module because
  // nothing compared any pair of them, and all three had drifted apart unnoticed.
  "35-domain-catalog.mjs",
  // 36-wiring-map.mjs: the wiring map parses and reduce graph reads the fields it produces. Its own
  // module because three independent name mismatches (layout, contract field, cell names) each
  // yielded an empty domain half in silence — 9 of 9 committed maps parsed to zero entries while
  // reporting readable, and trace-lint certified 0/0 engines reach the entry point.
  "36-wiring-map.mjs",
  // 37-committed-tier.mjs: no committed artifact references the gitignored tier, checked over the
  // whole shapeup/<slug>/ tree rather than the two corners the narrower rules watched — plus the
  // root-cause half, that no template owning a committed artifact teaches a task id.
  "37-committed-tier.mjs",
  // 38-scope-partition.mjs: dispatch must assign each task to exactly one scope. Its own module
  // because replacing the contract's tasks[] with a use_cases[] anchor traded a declared partition
  // for a derived N:N — on a four-scope/one-use-case cut every scope claimed every task. Also holds
  // the depends_on cycle check and the rule that the board restates no derived value.
  "38-scope-partition.mjs",
  "08-docs.mjs",
];

for (const file of MODULE_FILES) {
  const mod = await import(join(HERE, "structural", file));
  try {
    await mod.run(ctx);
  } catch (e) {
    // Isolate a thrown module as one failure and continue — never abort the whole suite.
    ctx.fail(`${file} threw: ${e && e.stack ? e.stack : e}`);
  }
}

// The floor parsed in section 26(d) is asserted here, where the final total exists.
if (ctx.checksFloor !== null) {
  if (ctx.checks >= ctx.checksFloor) ctx.ok(`total checks (${ctx.checks}) meet the documented floor (${ctx.checksFloor}+)`);
  else ctx.fail(`docs promise ${ctx.checksFloor}+ checks but only ${ctx.checks} ran — lower the floor only if checks were deliberately removed`);
}

console.log(`\n${"=".repeat(60)}`);
if (ctx.failures === 0) {
  console.log(`✅ structural tests passed (${ctx.checks} checks)`);
  process.exit(0);
} else {
  console.error(`❌ ${ctx.failures} structural failure(s), ${ctx.checks} checks passed`);
  process.exit(1);
}
