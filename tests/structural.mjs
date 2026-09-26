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
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
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
  // 29-hill-finished.mjs: the hill's top phase was unreachable for the life of the seesaw arm —
  // FINISHED required `seesaw.ran && seesaw.pass`, nothing ever wrote the registry that arm read,
  // and no shard in any recorded run held it. The arm was removed by decision in 3.8.0; this pins
  // what outlives it: FINISHED derives from a T1 pass and a T0 green from a round that built.
  "29-hill-finished.mjs",
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
  // 51-eval-t0-artifacts.mjs: the judge is handed the T0 artifacts it must cite, and a round it
  // could not grade stays open. Its own module because the defect crossed three writers — compile,
  // the resume derivation and ingest — and each looked correct alone: no order listed an artifact,
  // a refused round counted as done, and a verdict citing nothing was ledgered like any other.
  "51-eval-t0-artifacts.mjs",
  // 52-breadboard-intake.mjs: the pitch's second half is a run input. Its own module because the
  // defect was an absence — no reader anywhere — and a feature nothing exercises is one no
  // existing section could notice going missing.
  "52-breadboard-intake.mjs",
  // 53-breadboard-lint.mjs: spec-lint checks where the breadboard's Places landed, not only that
  // its ids were cited — the lost Place was fully cited, on the wrong screen.
  "53-breadboard-lint.mjs",
  // 54-round-build-gate.mjs: the loop builds and launches the feature before EVAL, hooks file
  // under the project root rather than the shell's cwd, and ownership is a query over contracts.
  "54-round-build-gate.mjs",
  // 55-coach-parity.mjs: the coachable set is one set in three places (kernel, registry, coach
  // categories), every reader actually reads, and the knowledge base never decides a gate.
  "55-coach-parity.mjs",
  // 56-hook-decision-table.mjs: the enforcement cases as DATA, each pinning the host answer
  // AND the ledger record. Its own module because the property is a method, not a case:
  // sandbox-guard (tested by decisions) killed 8/8 planted mutants; safety-spine (tested by a
  // fixed list of command strings) killed 1/4, and every survivor kept the listed strings
  // denied while widening the hole to an adjacent spelling.
  "56-hook-decision-table.mjs",
  // 57-derivation-boundaries.mjs: the derived tier, checked ACROSS the boundaries it must
  // survive — a second projection pass, a second run of one slug, a rebuild, a rewrite. Its own
  // module because eight live defects shared one shape (a fact projected or remembered rather
  // than re-derived) and every one was invisible to a single-pass fixture. The existing rebuild
  // check missed two of them by comparing node KEYS; these compare by VALUE.
  "57-derivation-boundaries.mjs",
  // 58-relaunch-memory.mjs: orchestration state a relaunch must not lose. Source-level, because
  // shapeup-run.js is a Workflow body that cannot be imported — which is itself why in-memory
  // orchestration state was reachable by no assertion in the suite, and why two defects lived there.
  "58-relaunch-memory.mjs",
  // 59-requirements-registry.mjs: the requirements registry is produced, and every link to it lands
  // in ONE key space. Its own module because the two halves fail as a pair and each looks fine
  // alone: nothing ever dispatched the producer, so the registry was a file the schema described
  // and no run wrote; and the contracts that did claim a requirement claimed it in the pitch's
  // `R<n>`, against a registry keyed `REQ-<n>` — an edge produced on the board and severed by
  // spelling, reported 23 times a run as a warning indistinguishable from noise.
  "59-requirements-registry.mjs",
  // 60-fence-lifecycle.mjs: the substrate fence's close-time lifecycle, per AGENTS.md's own claim
  // (defect sweep Stage 1 rework). Its own module because a rework pass found two of that
  // paragraph's three sentences false by inspection, and inverting one to its opposite in a scratch
  // copy still left the whole suite green — a check the prose had no reader that could fail.
  "60-fence-lifecycle.mjs",
  // 61-execute-leg-frozen-pitch.mjs: HD-012, the defect-sweep Stage 2 fix. `substrateFor`'s
  // `execute`/`fix`/`spike` arm declared no `frozen` key, so the widest, longest-lived dispatch in a
  // run could overwrite the staged pitch it was measured against. Its own module because the check
  // has to call the real `substrateFor`, not restate its output — a hand-typed substrate would stay
  // green through a revert of the fix, which is the one failure this module exists to catch.
  "61-execute-leg-frozen-pitch.mjs",
  // 62-run-args-surface.mjs: HD-010, the defect-sweep Stage 5 fix. The run-argument surface —
  // every RunArgs field gates.md's L0.9b table documents, cross-checked against the schema and
  // against what shapeup-run.js actually reads — derived at runtime from all three artifacts, never
  // from a hand-kept list, so a flag added to one tier and not the others reds on its own.
  "62-run-args-surface.mjs",
  // 63-run-args-writer.mjs: HD-020, and HD-010's executed half. `run-args.json` gets a kernel
  // writer (`harness init run-args`), executed end to end against a real run root, with
  // `probe concurrency`'s dialFrom() read back against exactly what that writer emitted — plus the
  // deadline breaker proven to trip off the receipt alone, independent of RunArgs entirely.
  "63-run-args-writer.mjs",
  // 64-shipped-set-hygiene.mjs: the acceptance-review guard for this same stage's own two
  // violations (an internal defect id and a tests/ citation, both landed inside shipped files
  // and both invisible to every check above). Scopes itself off `package.json`'s own `files`
  // allowlist rather than a hand-kept root list, so it drifts with the shipped set, not beside it.
  "64-shipped-set-hygiene.mjs",
  // 65-digest-locationless.mjs: HD-016. A diagnostic naming a file with no line number now
  // yields that file (line kept null, never invented) — executed against a real log corpus,
  // with a non-regression pass over every shape the digester already extracted run first. Also
  // executes `verify t0`'s score() and asserts its actual axes, since the register's own severity
  // note for this defect depends on which axes exist there.
  "65-digest-locationless.mjs",
  // 66-shared-ownership.mjs: HD-015, the defect-sweep Stage 7 fix. `electOwner` and `probe
  // owner`'s `ownership()` now elect from `allowed ∪ shared` — the same union the sandbox fence
  // composes — so a path declared only in a contract's `shared_substrate` reports a writer
  // instead of UNOWNED, and `bugsForScope` addresses it to the elected scope rather than fanning
  // it out to every scope in the run. Its own module because no existing test drove `electOwner`
  // or `probe owner` against a shared-only-declared path at all.
  "66-shared-ownership.mjs",
  // 67-terminal-closeout.mjs: HD-011, HD-017, HD-018 — the defect-sweep Stage 8 "thin orchestrator"
  // fixes with the shape "the run was supposed to tell the kernel something, and nothing made it".
  // Its own module because each fix is a pure kernel derivation (closeRun, deriveRounds, an ingest
  // routing step) executed end to end against a real fixture, plus the second reader that proves a
  // written channel is actually READ — none of which the orchestrator script itself can be tested
  // for directly (see 58-relaunch-memory.mjs's own banner).
  "67-terminal-closeout.mjs",
  // 68-gate-coverage.mjs: HD-019 — every GATE_IDS entry has a call site (the workflow script's own
  // range, or the orchestrating skill's prose for the three gates outside it), and the mechanism
  // those call sites now invoke — `harness gate --resolve`, the export's gate_decision and
  // build_gate tables — is executed end to end. Its own module because a structural suite cannot
  // execute prose, so what it pins is the roster/call-site cross-check and the kernel mechanism the
  // prose calls, not the prose being followed.
  "68-gate-coverage.mjs",
  // 69-terminal-wrapping.mjs: REWORK, Stage 8 round 1 — every terminal RunReturn shapeup-run.js's
  // own top-level flow constructs must pass through `withWarnings` (HD-011's close), pinned at the
  // source level (the script cannot be imported — 58-relaunch-memory.mjs's own banner) and
  // mutation-tested in both directions so the exact hole Round 1 found cannot reopen silently.
  "69-terminal-wrapping.mjs",
  // 70-tier-direction-producer.mjs: HD-1/HD-027, defect-plan-3.7 Stage 0 — the taught
  // TIER-DIRECTION rule (doc-schemas.md) now covers the bare-path-in-prose form the lint actually
  // enforces, not only wikilinks, and lintCommittedTier's whole-tree scan is proven against
  // several committed filenames, not only requirements.md, the one that bit.
  "70-tier-direction-producer.mjs",
  // 71-runreturn-closeout.mjs: HD-026, defect-plan-3.7 Stage 1 — every RunReturn arm the schema
  // carries is mapped to a close outcome by a derived kernel map (RUN_RETURN_CLOSE), not a
  // hand-typed pair; gate_h now closes the run as escalated (operator decision 1); the orchestrator
  // script's own call site is pinned at the source level, since it cannot be executed here.
  "71-runreturn-closeout.mjs",
  // 72-export-on-close.mjs: defect-plan-3.7 Stage 2 — a run's own close-out (kernel/probe/
  // resume.mjs's closeRun) now exports fact tables for every terminal ending except "shipped",
  // which the Ship phase's own pre-existing export call already covers; a blocked export degrades
  // the close's return with export_warning rather than failing the close itself.
  "72-export-on-close.mjs",
  // 73-attested-attempts.mjs: HD-2, defect-plan-3.7 Stage 3 — a scope's spent-attempt count is
  // derived only from attested channels (a dispatch receipt plus a leg-completion row or a
  // WorkResult), never from the order set or the T0 verdict set alone; a receipted attempt with
  // neither a leg nor a result is IN-FLIGHT and holds the breaker open, and scope-hammer's GATE H0
  // census now cites the same probe the round loop would, so the two readers cannot disagree about
  // the same exhaustion again.
  "73-attested-attempts.mjs",
  // 74-ship-report-tier.mjs: a run that ships must not make the next run of the same pitch
  // un-plannable. `reduce ship` freezes REPORT.md into the committed tier, and a board id in it
  // reds the successor at L1b — measured on a consumer, 23 findings, `rounds_used: 0`. Drives the
  // real `reduce ship` and lints the file it wrote, because the renderer being clean and the
  // command writing a clean file are different claims.
  "74-ship-report-tier.mjs",
  // 75-cross-run-attestation.mjs: the receipt/leg/trial ledgers are per-slug and append-only while
  // order_id and round/attempt repeat, so a reader that ignores run_id answers "did THIS run do
  // this?" with another run's evidence. Measured on a consumer: a run that dispatched nothing was
  // told its first attempt was spent, and the stagnation breaker escalated it on two trials from
  // earlier runs. The case no single-run fixture can hold, which is why three readers shipped
  // with it.
  "75-cross-run-attestation.mjs",
  // 76-committed-tier-write-guard.mjs: HD-036 and its layer (HD-027/030/037) — four producers wrote
  // committed files the harness's own spec-lint reds, and HD-036 recurred inside one session an hour
  // after its own author fixed it, so the remedy is a precondition rather than a rule. The guard is
  // executed through its real entry point and cross-checked against `lintCommittedTier` over one
  // corpus in both directions: narrower and the defect reaches L1b, wider and the guard gets
  // switched off.
  "76-committed-tier-write-guard.mjs",
  // 77-t0-evidence.mjs: HD-034's mechanism half — `runCommand` measures whether a fixture ran at
  // all, and the verdict artifact used to store only {cmd, exit, pass}, mapping a command that
  // never started onto the same `exit 1` a real failure returns. The record now keeps `error` and a
  // bounded tail of both streams, and the module drives the real `verify t0` entry point rather
  // than the mapper, so "the pipeline persists it" is what is actually under test.
  "77-t0-evidence.mjs",
  // 78-close-retires-the-fence.mjs: HD-014's code half — a run that ends any way other than
  // shipping leaves an unanswered order by construction, and the close retired nothing, so the
  // substrate fence stayed up over a finished run while the operator's documented remedy ("abandon
  // and start over") said nothing about releasing it. Driven through the real CLI, over every
  // terminal status the kernel declares, and it pins the two distinctions the fix must not blur:
  // un-fencing is not resolving, and the export reads the pointer it retires.
  "78-close-retires-the-fence.mjs",
  // 79-attested-channels-frozen.mjs: HD-044 — the run-trace carve-out permitted a build leg to
  // Edit/Write its own dispatch receipt, leg-completion row, T0 verdict and WorkResult, exactly the
  // channels `probe attempts` treats as admissible BECAUSE they are not writable by the leg being
  // judged. Its own module because no existing test drives the guard over a compiled `execute`
  // order and asserts denial on any of the four — #17 asserts the carve-out's board/ledger side,
  // never the attestation side it was never asked to fence.
  "79-attested-channels-frozen.mjs",
  // 80-citation-rehash.mjs: HD-043 — a T0 citation was a presence check, and the schema has always
  // promised a re-hash. Its own module because no existing test drives `probe eval`/`reduce ingest`
  // against a FORGED citation (a nonexistent path, a real-but-red artifact, a hash mismatch, a
  // directory) — every prior fixture that carried a `t0_citations[]` entry used a placeholder hash
  // pointing nowhere, which is what made the presence-only bug invisible to the suite that already
  // existed.
  "80-citation-rehash.mjs",
  // 81-no-eval-verdict.mjs: HD-045 — a `--no-eval` run hardcoded verdict = "pass" and dispatched
  // `reduce ship --verdict PASS` unconditionally, so the frozen shapeup/<slug>/REPORT.md a
  // teammate inherits on `git pull` claimed PASS over a feature nobody evaluated, even though
  // protocol.md promises `not-evaluated` "recorded plainly — never silently upgraded" twice over.
  // Pins the source-level wiring in shapeup-run.js (which cannot be executed by this suite) and
  // drives `reduce ship` for real in both directions — a --no-eval-shaped report says
  // not-evaluated, and a genuine PASS still says PASS.
  "81-no-eval-verdict.mjs",
  // 82-hill-absence.mjs: HD-042 — `deriveHill()` reads the LOCAL tier and writes the COMMITTED one,
  // and nothing checked that the tier it read from was there. A checkout with the committed shards
  // present and `.shapeup/` absent flattened FINISHED and DOWNHILL_EXECUTION to UPHILL_SOLVED and
  // reported `changed: true` — committed history lost, not merely misreported. Its own module
  // because §29 and §54 both hand `deriveHill()` a populated local tier, so neither can see a
  // derivation performed over no tier at all, and neither drives the `reduce hill` CLI the run
  // actually invokes. It also pins the two traps the fix must not fall into: a first run with no
  // ledger yet must still write, and the dot must still move DOWN when its evidence is removed.
  "82-hill-absence.mjs",
  // 83-frozen-real-path.mjs: a substrate glob is a spelling and the thing it protects is a file.
  // Measured: `Receipts/dispatch.jsonl` walked through a `receipts/**` freeze and overwrote the real
  // file on a case-insensitive filesystem, and a symlink inside an allowed `src/**` reached
  // `legs.jsonl` because `..` was resolved but links were not followed. Drives both spellings of
  // every frozen channel through the real hook and expects a denial for each.
  "83-frozen-real-path.mjs",
  // 84-single-writer-asked.mjs: five dispatches, five results, three leg rows, and nothing noticed —
  // the leg ledger was read in one place, behind the green checks, and was in neither the graph nor
  // the export. Pins `probe leg --order/--open`, the Leg node + INGESTED edge, the leg table, and
  // the run loop asking before any early return, in planning and build, with an honest close cause.
  "84-single-writer-asked.mjs",
  // 85-board-after-fast-forward.mjs: ANALYZE writes a committed spec tree and a gitignored board, and
  // the fast-forward keyed on the committed half alone — every run after the first on a machine built
  // over no board, GATE L2 crossed 0/0 tasks, and the requirements projection said "no evidence" on
  // a round whose static criteria all passed. Pins the board fact, the board-only operation and its
  // substrate, the L2 refusal over an empty board, and the workflow's board-only branch.
  "85-board-after-fast-forward.mjs",
  // 86-gate-h-in-the-run.mjs: a breaker used to end the run at the close-out, and the census, GATE
  // H, the ship report and GATE L4 all happened after it in prose — no census artifact, no H or L4
  // row, a refused `--close shipped`. Pins the census artifact L4's resolver reads, and the
  // workflow routing every breaker return through the census, H, the report and L4 before a close.
  "86-gate-h-in-the-run.mjs",
  // 87-unanswered-order-named.mjs: a leg wrote its artifacts and no envelope; the phase stood on the
  // artifact, and the run closed `shipped` over an order still open by construction. Pins `probe leg
  // --open` listing dispatched-but-unanswered orders, and the workflow naming them at every close.
  "87-unanswered-order-named.mjs",
  // 88-ledger-derived-at-close.mjs: the run ledger's front matter and tables were hand-shaped
  // placeholders nothing filled, so a shipped run read `final_verdict: ~`, `rounds_used: 0`, and an
  // empty Decisions table beside seven ledgered gates. The close derives them from the run's records.
  "88-ledger-derived-at-close.mjs",
  // 89-board-row-by-id.mjs: ingest matched an index row by substring anywhere in the line, so a
  // finished task's id in another row's Depends On column flipped that dependent to ✅ — a task the
  // executor reported skipped showed done, and the census read the index. Rows match by id cell,
  // skipped renders as skipped, and the index is frozen for build legs.
  "89-board-row-by-id.mjs",
  // 90-run-scoped-records.mjs: three readers reached durable artifacts run-blind — deriveRounds
  // (the committed report's round count), the gate ledger (exported under the current run's key),
  // and the citation check (digest and verdict only). A two-run fixture: run 2 reports only its own.
  "90-run-scoped-records.mjs",
  // 91-verdict-recomputed.mjs: `overall` was the judge's field and nothing recomputed it — a PASS
  // over a failing criterion, or over none, ingested and the round branched on it. Derived from the
  // criteria now, on ingest and on read; a PASS criterion with no evidence is no evidence.
  "91-verdict-recomputed.mjs",
  // 92-covers-one-key-space.mjs: `coveredReqIds` tested the raw covers: token against /^REQ-\d+$/ while
  // the folding helper existed one import away — R-2, [[REQ-5]] and req-4 counted as nothing at the
  // one place that grades. All four spellings through the real readers now agree.
  "92-covers-one-key-space.mjs",
  // 93-t0-env-fingerprint.mjs: a T0 verdict recorded the tree and nothing about the machine, so one
  // commit that built three ways on three machines produced three verdicts that read the same.
  "93-t0-env-fingerprint.mjs",
  // 94-shipped-citations.mjs: seven shipped files pointed their reader at test modules, a repo-only
  // tool and this repo's own design docs — found by an audit somebody remembered to run. This is
  // that scan as a check, bounded by the delivery allowlist, blind to a user's own docs/<file>.
  "94-shipped-citations.mjs",
  // 95-staged-orchestrator.mjs: a run keeps the workflow copy it opened with, so a relaunch after
  // an upgrade measures the previous release and says nothing. The state probe compares and warns.
  "95-staged-orchestrator.mjs",
  // 96-run-trace-is-the-kernels.mjs: the build leg's freeze was a list of channels a defect had
  // named, and each review found more of the same class. Inverted: the run trace is frozen and
  // `own` carries what a leg authors. Walks every entry an archived trace holds, both ways.
  "96-run-trace-is-the-kernels.mjs",
  // 97-reachability-can-say-unchecked.mjs: the import walker knew six suffixes, so on a stack whose
  // modules end in anything else it followed no edge, called every engine orphaned and reported
  // that it had checked. The walk now takes the project's own extensions, and refuses to publish a
  // verdict over a graph with a missing edge or with no reachable engine to control it.
  "97-reachability-can-say-unchecked.mjs",
  // 98-flow-sequence-spans-lines.mjs: the contract dialect read `field: [a, b]` and an indented
  // `- item` block, but a flow sequence broken across lines parsed to the single character "[" —
  // so a scope's substrate became a string, the order failed its own schema, and the scope could
  // not be dispatched. Drives the parse through the compiler and the hook.
  "98-flow-sequence-spans-lines.mjs",
  // 99-eval-launch-evidence.mjs: a `[ui]` row is graded on the running app, but an evaluate order
  // carried no way to start it and no record that the gate had — the ledger's `run_cmd` is the build
  // and a green launch was forwarded only when red. The kernel now derives `build_gate` and
  // `launch_cmd`, and `probe t0` prints the digest a T0 citation needs.
  "99-eval-launch-evidence.mjs",
  // 100-closed-run-reopens.mjs: a run closed aborted, resumed and shipped could not record its
  // close — the ledger read shipped over closed_status aborted. The move to a live status now reopens
  // the run on the record (the earlier close kept under prior_closes), and init run names a closed
  // run as closed rather than open.
  "100-closed-run-reopens.mjs",
  // 101-preflight-and-ship-headline.mjs: environment faults surfaced only at the first round gate,
  // after planning — a write-nothing preflight now runs the declared probes first; and a shipped
  // FAIL's report opened like a pass — it now names the verdict and the cut list first.
  "101-preflight-and-ship-headline.mjs",
  // 102-ledger-names-the-program.mjs: a permitted Bash call was recorded with no subject, so the
  // ledger could not tell a worker that never ran a tool from one stopped when it did. Allow rows now
  // name the programs by basename, never their arguments.
  "102-ledger-names-the-program.mjs",
  // 103-named-test-failures-digest.mjs: a runner driving an app from outside reports a failure as
  // `FAIL <name> <why>` with no file:line, and the digester dropped it — the next attempt of a red
  // fixture was handed no errors. Such a line is now kept, with no file invented for an id.
  "103-named-test-failures-digest.mjs",
  // 104-green-is-green-and-a-pass-is-a-pass.mjs: a score with no regressions field was never
  // counted green (the report said no scope reached green, over four green scopes), and L3 recorded
  // its preset's "FAIL → fix round" note over a round that passed.
  "104-green-is-green-and-a-pass-is-a-pass.mjs",
  // 105-orders-carry-the-kernel-path.mjs: worker skills ran the kernel as
  // node "${CLAUDE_PLUGIN_ROOT}/…", which a headless session refuses ("Contains expansion") before any
  // rule is read. Orders carry the absolute path; worker skills run node "<kernel>".
  "105-orders-carry-the-kernel-path.mjs",
  // 106-a-failed-criterion-is-a-bug.mjs: only a verdict's filed bugs reached the next round, so a
  // criterion graded FAIL with no bug — "no evidence" — gave the fix round nothing to fix. Each such
  // criterion is now a bug for the scope owning its use case.
  "106-a-failed-criterion-is-a-bug.mjs",
  // 107-a-check-rewritten-to-pass.mjs: a scope that rewrote its own failing check went green with
  // the code unchanged, and nothing recorded it. T0 now digests the checks it reads and lists a row
  // that turned FAIL→PASS with its check changed; the evaluate order carries the list.
  "107-a-check-rewritten-to-pass.mjs",
  "08-docs.mjs",
];

// =============================================================================
// Every module on disk runs, and every module that runs is on disk.
// =============================================================================
// MODULE_FILES is explicit and has NO auto-discovery, deliberately: order is load-bearing (08 runs
// last so the checks floor sees the full total) and where a module sits is a decision someone
// makes. The price of that decision is this failure mode — a file can be written, land on disk,
// be imported by nothing, and never run.
//
// That is strictly worse than having no guard at all. An absent guard is visibly absent; an
// unregistered one reads as coverage, passes review, and can never go red no matter what breaks
// underneath it. Measured in this repo: a module written for a real defect sat unregistered
// through a whole stage while the suite reported green, and nothing in the suite could say so.
//
// Checked here in the runner rather than in a module of its own, because a module that policed
// registration could itself be the unregistered one.
{
  const onDisk = readdirSync(join(HERE, "structural")).filter((f) => f.endsWith(".mjs"));
  const orphaned = onDisk.filter((f) => !MODULE_FILES.includes(f)).sort();
  const dangling = MODULE_FILES.filter((f) => !onDisk.includes(f)).sort();
  const dupes = MODULE_FILES.filter((f, i) => MODULE_FILES.indexOf(f) !== i).sort();

  if (orphaned.length === 0) ctx.ok(`every module in tests/structural/ is registered and runs (${onDisk.length} files)`);
  else ctx.fail(`module(s) on disk that no run reaches — an unregistered guard can never go red, ` +
                `so it reads as coverage it does not provide: ${orphaned.join(", ")}`);

  // A registration with no file would throw at import and be caught as one module failure, which
  // names the file but reads as a broken test rather than a missing one. Say which it is.
  if (dangling.length === 0) ctx.ok("every registered module exists on disk");
  else ctx.fail(`MODULE_FILES names file(s) that are not on disk: ${dangling.join(", ")}`);

  // A duplicate runs its checks twice, inflating the total the floor is measured against.
  if (dupes.length === 0) ctx.ok("no module is registered twice");
  else ctx.fail(`module(s) registered more than once — their checks are counted twice: ${dupes.join(", ")}`);
}

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
