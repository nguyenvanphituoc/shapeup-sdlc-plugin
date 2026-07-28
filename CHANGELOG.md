# Changelog

All notable changes to this plugin are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## [1.4.1] — 2026-07-28

### Fixed — the enforcement layer was inert under an ordinary install, and said nothing

v1.4.0's release note above claims that every mechanism it added "moves an invariant out of a
prompt and into the runtime, which is the project's organising rule". That claim was true of the
code and false of the installed product, for a reason no test in this repo could see.

- **`skills/tech-lead/scripts/lib/is-main.mjs` — the entry-point guard, fixed in 18 files.**
  Eighteen scripts and hooks gated their whole body on `import.meta.url` compared against a
  template literal of `"file://"` and `process.argv[1]`. That comparison is **false** — body
  skipped, **exit 0, no output** — whenever the invoked path is not byte-identical to the resolved
  module URL, and two ordinary situations make it false:

  1. **Any symlinked directory in the path.** Node resolves `import.meta.url` through symlinks;
     `process.argv[1]` is the string as typed. On macOS `/var` is a symlink to `/private/var`, so
     **every path under the system temp directory mismatches**. nvm, pnpm's content store, Homebrew
     and any symlinked checkout do the same on every platform.
  2. **Any space or URL-reserved character in the path.** `import.meta.url` is percent-encoded
     (`My%20Plugins`); the template literal is not (`My Plugins`). A plugin under
     `~/Library/Application Support/…` mismatches too.

  The affected files include **all seven** hooks that carry a guard — `gate-zerowork`,
  `safety-spine`, `sandbox-guard`, `anti-rationalization`, `slop-cleaner`, `session-rehydrate`,
  `compact-snapshot` — plus `init-run`, `gate-answers`, `budget-check`, `t0-verify`, `fit-check`,
  `aegis-digest`, `verdict-ledger` and the four oracles. Under a symlinked install the runtime half
  of "gates are enforced, not requested" did nothing, **while every gate still reported success**.
  A silent no-op is the worst failure an enforcement layer can have, because it is indistinguishable
  from working.

  Priced on `sdd-harness-bench`, which installs this plugin from a packed tarball under
  `/var/folders/…` — i.e. into the failing shape. `init-run.mjs` is GATE L0.1, the mandatory first
  call that writes the receipt everything else derives from; it exited 0 with empty stdout and wrote
  nothing. The orchestrator could not tell "the run opened" from "nothing happened", and in the F4
  handoff rows it spent **82–120 turns before its first write** doing forensics on its own
  bootstrap — retrying the script six ways, hitting five separate permission refusals trying to
  capture an exit code, and finally running `find /` to look for its own skill. Session B cost
  **$4.57–$10.36** and closed **0/3** of the gap while the artifact it needed sat on disk.

  `isMain()` compares resolved URL to resolved URL (`pathToFileURL` for encoding, `realpathSync`
  for symlinks).

- **`hooks/session-rehydrate.mjs` — the continuity reflex now covers a cold start.** The matcher
  was `compact|resume`. Both continue a conversation that still exists; the commonest continuity
  event in practice has none — you close the terminal and come back tomorrow, or a teammate picks
  the work up in a fresh checkout — and the CLI calls that `startup`. A reflex whose entire purpose
  is *trust the files, not your memory* did not fire in the one case where there is no memory at
  all. Matcher is now `startup|compact|resume|clear`, and on a cold start the injection leads with
  the failure a fresh session actually makes: **a run is already open; resume it, do not re-open
  it.** It stays silent when no run is in flight (`findRun` requires an `active-scope` pointer or a
  mid-run `harness-run.md`), so ordinary sessions are unaffected.

### Added — tests that could have caught it

- **`tests/structural/11-is-main.mjs`.** Two layers, and the second is the mechanism. A grep floor
  forbids reintroducing the fragile comparison; then **every guarded entry point is actually
  executed through a symlinked directory and through a directory whose name contains a space**, and
  must behave as it does by its real path. The entire pre-existing suite invoked scripts by their
  real, space-free repo path — the one shape where the bug is invisible — which is why 610 passing
  checks coexisted with an inert enforcement layer. Testing the *shape* of the code would have
  caught nothing: the broken line looked exactly like the idiomatic one it was copied from.
- The `session-rehydrate` matcher and its cold-start wording are pinned, so the reflex cannot
  narrow back to `compact|resume` silently.
- Documented checks floor raised 450 → 640 (actual: 643).

## [1.4.0] — 2026-07-27

### Added — the benchmark-correction release

Four mechanisms, each a direct response to a failure measured on `sdd-harness-bench` — the
harness's own benchmark, in which it was the only arm that failed to finish a feature and the only
arm to score below 100%. Every one of these moves an invariant out of a prompt and into the
runtime, which is the project's organising rule; each was living in a prompt precisely because
prompts are what get dropped, paraphrased, or summarised.

- **`scripts/init-run.mjs` — the run receipt (GATE L0.1).** The orchestrator's first tool call,
  before any prose. Writes `receipt.json`, `intake.md` (the requirement verbatim + SHA-256),
  `harness-run.md`, and `active-scope`. It supplies the one fact the system was missing: *a run
  started*. Every prior guard could only observe what a run **did**, so a run that did nothing was
  invisible to all of them.
- **`hooks/gate-zerowork.mjs` — the zero-work block (Stop, blocking).** Blocks a session that
  dispatched `tech-lead` and left no receipt. Measured cause: given a *valid* spec, the
  orchestrator loaded a 450-line instruction file describing eleven gates and returned a
  description of eleven gates — "The tech-lead skill is orchestrating the full Shape Up harness.
  It will: 1. …" — then ended. 29% acceptance, 10 escaped defects, 5/5 with zero variance, and
  prose that read like a clean run. Both existing guards structurally could not see it: one is
  scoped to an active run (a run that never started leaves no files), and the other matched
  past-tense completion claims while narration is *future*-tense. This one blocks on a mechanical
  absence, so no phrasing can change its verdict. It does not violate "QA is a level-up, not a
  gate": it makes no quality judgment, it reports that no work exists to judge.
- **`scripts/gate-answers.mjs` + `schemas/gate-answers.schema.json` — pre-recorded gate
  decisions.** Sign-off was the last load-bearing invariant still carried in prose, and prose
  consent is consent that can be paraphrased — Sonnet 5 acted on it, Haiku 4.5 re-summarised it.
  Presets `ci` / `guarded` / `interactive`; the orchestrator resolves each gate through the script
  and branches on the exit code (`0` cross, `4` stop for the PO, `5` abort). **Not "gates off":**
  every gate still emits its block and still records a decision — what changes is the decision's
  *source*, which the ledger names along with the set's `authorized_by`. `--verify` catches a set
  that would stall a headless lane in ten seconds instead of at the wall-clock cap.
- **The third circuit breaker — `scripts/budget-check.mjs` + `hooks/gate-deadline.mjs`.** Both
  existing breakers count *events* (`round_budget` per round, `attempt_budget` per T0 attempt), so
  neither can observe that a single round has been running for half an hour. Re-reading the
  benchmark's F3 timeout showed 327 turns, 262 tool calls, 37 writes, last gate L3 and **zero**
  stall signals — it was working, not waiting, and was killed from outside having shipped nothing,
  including the scopes that had already passed T0. Past the deadline the hook denies new
  `task-executor` work and routes to GATE H; `spec-evaluator`, `scope-hammer`, `qa-edge-hunter`
  and `advisor-protocol` stay reachable, because a run past its deadline must still be able to
  judge, hammer and close. Opt-in (`--wall-clock-budget`); off by default, no regression.

- **`scripts/fit-check.mjs` — the lane, computed rather than judged (GATE L0.3).** The harness
  already knew F1 was small ("squarely inside the --tiny lane", pilot transcript) and ran the full
  pipeline anyway, because the lane was a judgment a model can talk itself out of. Measured cost:
  a three-file feature never once completed the eleven-gate pipeline across four benchmark
  attempts, and every fix that treated it as a breaker problem improved the *failure* without
  shortening the *run*. The lane is now computed at run-open from the intake and the tree, recorded
  in the receipt with its evidence, and `--lane` overrides are recorded AS overrides. Conservative
  by construction: `full` is the default and `tiny` must be earned on every axis, because a wrong
  `tiny` skips gates on a change that needed them while a wrong `full` only costs money. Thresholds
  are fitted on three features and the tool says so on every invocation. (The first version asked
  "is there evidence this is big?" and defaulted to tiny — it classified all three benchmark
  features as tiny, including the five-seam one. Discarded rather than tuned.)

### Changed
- **`skills/tech-lead/SKILL.md` opens with a runbook, not an architecture.** The first screen is
  now four imperative steps beginning with a tool call; the state model moved to
  `references/state-model.md`. Everything before the first tool call is narration surface, and a
  450-line description of a pipeline is what a cheap model returns a description of.
- **`hooks/anti-rationalization.mjs` also detects a future-tense promise** left as the session's
  last word. A promise at the *end* of a session is a completion claim wearing different grammar.
- The circuit breaker is documented as **three-level** throughout.

### Also in 1.4.0 — discovery + friction (P0/P1 of the market-position report)

The repo had rigor and no funnel: null description, no topics, a README that opened on install troubleshooting, one
slash command, a Playwright prerequisite for runs that never touch a browser, and no lane for
small changes. This release is that fix — almost no mechanism changes, a lot of front door.

### Added
- **`anti-lying-kit` — the enforcement layer as a standalone plugin** (P2-2). Three hooks, no
  methodology, installable *alongside* spec-kit / OpenSpec / any markdown checklist rather than
  instead of them: `gate-done` (PreToolUse, **denies** the review/eval/ship call while the
  project's own board has unfinished tasks), `no-fake-done` and `slop-check` (Stop, advisory).
  Portability comes from one board adapter (`lib/board.mjs`) — presets for `spec-kit`,
  `openspec`, `markdown-checklist`, `shapeup-sdlc`, plus a glob/regex escape hatch — so the
  hooks themselves are workflow-agnostic. Fails open on every path where it cannot prove a task
  is unfinished, and is fully inert until a project writes `.antilying.json`. Listed as a second
  plugin in the marketplace. `t0-verify` and mechanical hill derivation deliberately did **not**
  extract: they depend on per-scope contracts, and shipping something weaker under the same name
  would have been dishonest.
- **Nine phase commands** — `/shape /orient /wire /scopes /build /eval /qa /hammer /retro`,
  thin wrappers over the existing skills so the pipeline is learnable from `/`-completion
  alone. `/eval` documents the GATE L2 denial as expected behavior, not an error.
- **`--tiny` lane** (`/ship --tiny`) — ⏸ L0 fit-check → orient (light) → build → T0 → ⏸ L4.
  Ceremony scales down (WIRE/contracts/spec-tree/EVAL/QA/retro skipped); the floor does not
  (envelope dispatch + T0 + `lane: tiny` ledger row). Contract:
  `skills/tech-lead/references/tiny-lane.md`.
- **`npx shapeup-sdlc init`** (`bin/init.mjs`) — cross-platform Node scaffolding installer: no
  bash, no jq/python3 fallback chain, works on Windows; same layout as `install-harness.sh`.
  `package.json` gains `bin`/`files`/`engines` (npm publish is a separate step).
- **`SECURITY.md`** — falsifiable claims (no network, no deps, fail-open, the model cannot
  widen its own safety envelope, Stop hooks never block) + a per-hook reads/denies/never table.
- **Demo asset** — `npm run demo` (`scripts/demo/record-demo.mjs`) renders the README's GATE L2
  demo by running the real `gate-l2.mjs` against a real partial board and embedding its
  verbatim denial; it throws rather than render a demo that lies.
- **Docs**: rewritten README (value prop → demo → glossary above the fold; enforcement
  mechanisms carry the failure each prevents; envelope demoted to plumbing), `docs/install.md`,
  `docs/upgrading.md`, `docs/glossary.md`, `docs/launch/submissions.md`, `CONTRIBUTING.md`,
  issue templates, agent-support matrix (honest row: hooks don't travel).

### Changed
- **Playwright is now a lazy dependency.** The plugin-level dependency is removed from
  `plugin.json`; the eval skill preflights the browser at the FIRST `[ui]` criterion and fails
  that probe with the fix named (never auto-installs, never silently skips — an unverifiable
  `[ui]` AC is a FAIL, not a PASS). Non-UI runs complete with no browser installed.
- `AGENTS.md` opens on the enforcement idea (gates enforced → progress derived → parallel-safe)
  instead of the envelope; the envelope is framed as the plumbing that makes those true.

### Measured
- **First real trigger-eval baseline** (`evals/baselines/trigger-evals.baseline.json`) — 149
  cases, Haiku 4.5, `--max-turns 8`. The publishable half: **zero false activations across all
  75 cross-skill hard negatives** (precision 1.0 wherever defined) — the thirteen skill
  descriptions do not steal each other's work. The activation (TPR) half is measured but
  **confounded and deliberately not quoted as a headline**: 38 of 74 positives point at a
  referent the probe never supplies, so a model that names the correct skill and asks for the
  missing input scores as a miss. Per-skill numbers, the method, and the fix are in
  `evals/README.md`; the confound is tracked as #7. Three earlier baselines were discarded
  rather than published.

### Fixed
- `trigger-eval.mjs`: ROOT path broken since the v1.3 script move; Skill-tool detection updated
  to the CLI's current `input.skill` + namespaced names (verified against a live stream), with
  phase-command wrappers aliased to the skills they delegate to; probes that hit a
  rate-limit/api error with no activation are now UNMEASURED (retry once, then abort) instead
  of being scored as misses — the first measured run fabricated a flat TPR 0 for 9 skills that
  way and was reverted, not published. Adds `--concurrency` (default 2) and a `--max-turns 2`
  activation cap, both recorded in the baseline's method string.

## [1.3.0] - 2026-07-24

**Traceability spine + wiring reachability.** Two mechanically-checkable oracles that close the
two silent-failure modes the conformance audit named: a customer requirement that vanishes in
translation, and an engine that ships built-and-green but orphaned from the running app. Governing
rule (from the redesign): *if a script can't check it, it's decoration* — every artifact here is a
checkable oracle or a durable anchor an oracle reads. Staged so nothing breaks legacy runs: every
arm self-skips when its SHARED artifact is absent (non-regression), and `trace-lint` ships
**advisory** (warn-only), promotable to a blocking `--gate` only once `covers:` is populated.

### Added
- **`skills/tech-lead/scripts/trace-lint.mjs`** — the ONE oracle, TWO assertions. *Covers-closure*:
  every requirement with status `covered` must be named by ≥1 acceptance criterion's
  `(covers: REQ-…)` clause; a REQ neither covered nor `CUT (PO-approved)` is red (catches the
  *dropped clause*, not a contradiction). *Reachability*: a use-case whose engine does not reach the
  project profile's `entry_point` via the import graph is red (catches the *dead module* — 0 import
  sites — not a dead data-path). Emits the LOCAL `.shapeup-sdlc/<slug>/trace/report.json` + a Mermaid
  view of the checked graph. Advisory (exit 0) by default; `--gate` blocks (exit 1) on red.
- **`solution-architect` skill** (v1.1) — the new pure worker at gate **L1a.5** (`wire` operation);
  sole, direct writer of the committed `docs/shapeup-sdlc/<slug>/wiring-map.json` (per-UC engine →
  integration seam → composition-root attachment → player-visible affordance). Front-loads the
  integration seam the slicer was missing behind the round-1 substrate-expansion escalations. It
  designs the seam at design time; it does **not** verify reachability — that is the orchestrator's
  `trace-lint` against real code at L1b.
- **`ba-pitch-analyzer coverage` operation** — extracts atomic customer-requirement clauses into the
  SHARED `requirements.md` registry (`$defs/RequirementClause`), stable frozen REQ-ids
  (supersede-never-delete; a dropped clause is marked CUT, never deleted). Open Decision A resolved:
  the REQ source defaults to the pitch and is overridable via `payload.requirements`.
- **`project-profile.json`** (`$defs/ProjectProfile`) — archetype + `entry_point`, written by
  `tech-lead` at L0; the archetype-specific seam reachability resolves against (a game's `main.js`
  is not a service's `src/server.ts`). `archetype` is a closed enum — a typo fails, never silently
  disables the check.

### Changed
- **`domain.schema.json`** (central registry, per the one-place discipline): `WorkerName` +=
  `solution-architect`; `Operation` += `coverage`, `wire`; new `$defs` `RequirementClause`,
  `WiringMap`/`WiringEntry`, `ProjectProfile`; `TaskRef.acceptance_criteria` becomes the **additive**
  union `string | {text, covers?}` (legacy `string[]` boards keep parsing — the ✦ non-regression
  invariant); `CriterionVerdict.traces_to?` + `Discovery.traces_to?` (finding→REQ back-links);
  `WorkOrderPayload` += `requirements`, `project_profile`; `x-payload/result-by-worker` +
  `x-erd` extended for the new REQ↔AC, REQ↔finding, and UC↔WiringMap edges.
- **`validate-envelope.mjs`** gains `anyOf` support (validates the additive `acceptance_criteria`
  union without a validator dependency).
- **`compile-order.mjs`**: `parseTaskFile` extracts `covers[]` while keeping `.text` byte-identical to
  the checkbox (ingest's substring tick-back is untouched); `substrateFor` gains `coverage` (writes
  `requirements.md` only) and `wire` (writes `wiring-map.json` only) whitelists; an operation→owner
  map lets a non-build dispatch resolve its worker from the operation alone.
- **`ingest-result.mjs`** surfaces a discovery's `traces_to` REQ-ids in the ledger line.
- **`solution-architect` design-intent correction (v1.1)** — the skill runs at design time (L1a.5,
  before any code exists) but was written as a build-time *verifier*, which forced two defects.
  It taught the worker to emit `entry_call_site: "main.js:42"` — a file:line for code that does not
  exist yet, and one parsed by **no** consumer (reachability is an import-graph BFS from
  `entry_point` to `engine`; the Mermaid view reads `use_case`/`engine`/`affordance`; the slicer
  reads `wiring_seam`). `entry_call_site` is now **design intent**: the symbolic composition-root
  attachment named from the profile's `entry_point` + mechanism, never an invented line
  (`domain.schema.json` description updated to match). Separately, Core-process step 4 made a
  pipeline-blind worker run the orchestrator-owned `trace-lint.mjs` as mandatory craft — removed;
  the oracle stays the orchestrator's, the same rule that keeps `t0-verify.mjs` out of
  `task-executor`. No schema-*required* field changed (`WiringEntry` still requires only
  `use_case` + `engine`), so trace-lint and the spine fixtures are untouched.
- **Orchestrator prose extraction** — `skills/tech-lead/SKILL.md` sheds its gate playbook and
  invocation matrix into `references/gates.md` + `references/invocation.md` (loaded on demand); the
  §25 line ratchet drops **750 → 450** so the win is held as a regression guard.
- **Structural suite split (Track C)** — `tests/structural.mjs` becomes a thin runner threading one
  shared context (`tests/lib/harness.mjs`) through per-domain modules in `tests/structural/*.mjs`,
  isolating a thrown module as a single failure so the suite never aborts. The filename is kept
  (docs cite it — §26c). A new check lands in the module matching its owner, so a skill change
  touches one small file. Adds `tests/lib/jsdoc.mjs` for contract coverage. **506 checks** green.
- **Script co-location** — `verdict-ledger.mjs` moves `scripts/shapeup-sdlc/` →
  `skills/spec-evaluator/scripts/`, matching the v1.0 rule that runtime scripts live inside their
  owning skill. Adds `scripts/README.md` drawing the public-entrypoint vs dev-tooling line.
- **Design docs reconciled to the schema** — `design/02` + `design/04` gain the **Wire / L1a.5**
  step and `solution-architect`, which existed in the routing tables but never in the workflow
  narrative; `design/07` corrected to 11 workers / 20 operations with the `solution-architect`
  payload+result rows and the three SHARED spine records; `design/05` + `design/06` updated for the
  test split and the relocated script. Adds `docs/skills/changelog-solution-architect.md`.

## [1.2.0] - 2026-07-15

**Absorb & Audit (dwarves-kit × shapeup-sdlc) — P1–P4 landed, P5 shaped.** The machine gets a
safety spine, the session gets advisory honesty checks, the metrics shards get a reader, and a
context compaction gets a mechanical "re-read the files" reflex. **No behavior change to
worker skills — all machinery is orchestrator-layer** (hooks/, tech-lead scripts/schemas,
tests, docs); every new data flow is a schema-governed JSON record registered once in the
domain registry.

### Added
- **P1 — `hooks/safety-spine.mjs`** (PreToolUse `Bash|Read|Write|Edit|MultiEdit`): denies
  destructive-fs (`rm -rf` on unrecoverable targets, wide `git clean`), git-destructive
  (force-push, push-to-main, `git reset --hard`), sql-destructive (`DROP`/`TRUNCATE`),
  secret reads (`.env`, `*.pem`, `*.key`, ssh/cloud credentials — shell readers and the
  `Read` tool alike), and self-protects its own override file. Escape hatch:
  human-authored `.shapeup-sdlc/safety-overrides.json` (`$defs/SafetyOverrides`) — a corrupt
  overrides file is treated as absent (override channel fails closed), and every exercised
  override is logged as a `SAFETY-OVERRIDE` pathology row. Denies log `SAFETY` rows.
- **P2 — advisory Stop hooks**, both harness-scoped and mechanically incapable of blocking
  (exit 0 always, at most a `systemMessage` — "QA is a level-up, not a gate"):
  `hooks/anti-rationalization.mjs` (a completion claim in the final message is checked
  against board frontmatter, the latest T0 verdict, and open escalates — contradictions are
  named out loud) and `hooks/slop-cleaner.mjs` (TODO/FIXME, `console.log`/`debugger`,
  commented-out-code blocks, 400+-line single-file adds — in added lines of the session's
  diff only).
- **P3 — `skills/tech-lead/scripts/stats.mjs`**: the telemetry read-plane over
  `docs/shapeup-sdlc/metrics/*.jsonl` — rounds per pitch, hammer-cut rate,
  attempt-budget exhaustions, QA promotion rate, round-count trend. Emits a self-validated
  `$defs/StatsReport` (`--format table` for humans); read-only by construction (only read
  APIs imported; a structural test asserts the metrics dir is byte-identical after a run).
  `MetricsRow` gains optional `at` + `attempt_exhaustions` fields so exhaustions are
  harvested facts, never re-derived (single-judge rule).
- **P4 — compaction resilience**: `skills/tech-lead/scripts/run-snapshot.mjs` derives a
  `$defs/RunSnapshot` from files only (pointer, `harness-run.md`, board, `t0/verdicts/`
  filenames, `orders/`−`results/` diff); `hooks/compact-snapshot.mjs` (PreCompact) persists
  it before compaction (PreCompact cannot inject context — verified); and
  `hooks/session-rehydrate.mjs` (SessionStart, matcher `compact|resume`) injects the
  fresh-derived `rehydrate_hint` as `additionalContext`: *trust the files, not the summary*.
- **P5 — risk lanes, design only**: `docs/design/04-functional-design.md` §4.7 (tiny/normal/
  full lanes, selection reusing ba's `lens: lite` predicate, per-lane `--auto` gate sets) and
  a draft `$defs/Lane` with a machine-readable `x-lane-policy`. New (design-marked)
  invariant: **lanes thin ceremony, never verification** — no lane skips EVAL, T0, or hooks.
  No runtime reads any of it yet.
- **Structural tests #25–#30** (265 → 369 checks): the tech-lead prompt line-count ratchet
  (≤750), the doc-drift check (skill counts, two-way hook inventory, cited-path existence,
  self-asserted checks floor), and fixture suites for every new hook and script.

### Changed
- `hooks/hooks.json` — registers the safety spine (PreToolUse), both advisory hooks (Stop),
  the compaction pair (PreCompact + SessionStart `compact|resume`).
- Docs synced and now drift-checked: README hook inventory completed (including the
  previously undocumented `validate-envelope.mjs` PreToolUse entry — pre-existing drift),
  design/03 gains §3.2b (advisory hooks) + §3.2c (compaction resilience), design/04 resolves
  the `--auto` gate-set inconsistency (the GATE L0.7/Flags table is authoritative:
  L1a/L1b/L3/L4), design/06 adds the three new invariants, design/07 adds the v1.2 entities
  and the read-plane ERD, and exact test-count literals became ratcheting floors
  ("330+ checks").
- `skills/tech-lead/SKILL.md` — **untouched** (724 lines; the ratchet now enforces it).

## [1.1.0] - 2026-07-14

**Central domain registry + tier-direction discipline.** Every cross-boundary record type and
payload field is now defined exactly once, and persisted links are linted to flow
LOCAL→SHARED only. No behavior change to the SDLC loop; all architectural invariants intact.

### Added
- **`skills/tech-lead/schemas/domain.schema.json`** — the central domain registry: every
  cross-boundary record type (`$defs`) annotated with tier/location/writer/readers, the
  `x-erd` relationship map, and the `x-payload-by-worker` / `x-result-by-worker` tables. The
  envelope schemas `$ref` it; no skill defines its own cross-boundary field.
- **`$ref` resolution in `validate-envelope.mjs`** — same-document (`#/$defs/Name`) and
  sibling-file (`domain.schema.json#/$defs/Name`) pointers, with a file cache and a
  cycle guard; still zero-dep.
- **Two new spec-lint rules** (`spec-lint.mjs`):
  - `TIER-DIRECTION` (red) — a committed (SHARED) spec doc wikilinking the LOCAL board
    (`[[tasks/...]]`): task ids are machine-local and `.shapeup-sdlc/` is gitignored, so a
    committed task link dangles on every fresh clone; cite the UC or scope_id instead.
  - `UC-ANCHOR` (red) — an implementation task with empty `use_case_refs` or a ref that
    resolves to no `usecases/UC-*.md` (single-anchor rule; SPIKE/CHORE/DOCS/MIGRATION exempt).
- **"Envelope contract — the domain layer" section in every worker SKILL.md** that lacked one
  (advisor-protocol, coach, scope-hammer, translator, tech-lead): documents the WorkOrder
  in / WorkResult out dispatch and maps standalone flags 1:1 onto the registry's
  per-worker payload/result fields.
- **`docs/design/` suite** (README + 01–07): objective & product value, high-level design,
  system design, functional design, verification & quality strategy, appendix, and the
  domain ERD that `domain.schema.json` mechanizes.
- **`examples/simulate-task-executor-flow.sh`** — end-to-end walkthrough of the
  compile-order → task-executor → ingest-result dispatch cycle.
- Structural test section #24 (domain registry: every `$ref` resolves, the payload map is
  consistent, validation discriminates through the ref chain): 223 → 265 checks.

### Changed
- `work-order.schema.json` / `work-result.schema.json` slimmed to `$ref` the domain registry
  instead of inlining shared record definitions (−200 lines of duplication).
- ba-pitch-analyzer templates and references aligned to tier direction: SHARED templates no
  longer link `[[tasks/...]]` or `[[run-state]]`; risk tables cite the UC instead of a task.
- `board-derive.mjs` / `compile-order.mjs` — header pointers to the domain registry.

## [1.0.0] - 2026-07-13

**Pure-skill architecture** (`docs/plan/pure-skill-architecture.md`, phases P0–P4 landed in
one pass). The orchestrator layer now owns ALL pipeline management and feeds each executor a
structured envelope; worker skills contain only craft. The high-level SDLC design is
unchanged: same three-phase loop, same gates L0–L4, and every architectural invariant intact
(single judge, EVAL exactly once per round, two-level circuit breaker, mechanical hill,
ledger single-source-of-truth, role separation) — they are application-layer policy and live
in tech-lead, exactly where clean architecture puts policy.

### Added
- **P0 — the two-envelope port.** `skills/tech-lead/schemas/work-order.schema.json` +
  `work-result.schema.json` (the harness's canonical ports) and
  `skills/tech-lead/scripts/validate-envelope.mjs` — a zero-dep validator that doubles as a
  PreToolUse hook (wired in `hooks/hooks.json` on Skill|Agent): a dispatch whose `--order`
  file is missing or schema-invalid is DENIED; no `--order` → defer (standalone stays free).
- **P1 — the pipeline sub-layer (scripts, not LLM skills — DD-7).**
  `compile-order.mjs` assembles a WorkOrder from facts only (scope contract, this scope's
  tasks + parsed ACs, promoted round-ledger decisions, the previous attempt's AEGIS triples,
  per-operation substrate whitelists) — replacing tech-lead's hand-assembled `isolated_brief()`
  and every worker's GATE A/B plumbing. `ingest-result.mjs` is the single writer of shared
  state: ticks AC boxes, flips task/board status, appends the Execution Log, propagates
  unblocks, appends discoveries to the ledger, applies the judge's refuted list + verdict
  JSONL, queues escalates — schema-validated, so a malformed result never mutates the board.
- **P3 — the planner's mechanical layer.** `board-derive.mjs` (unlocks = depends_on inverse
  with `--write`, Σ hours, critical path, Appetite-Guard arithmetic, board-vs-T0 drift flag —
  KB-BA-001's asymmetric edges become structurally impossible) and `spec-lint.mjs` (PA1
  directory-thinking, PA2 size cap, substrate DISJOINT check, spec-structure/wikilink/
  edge-symmetry walk — the worker no longer grades its own output).
- **New skill: `scope-architect`** — Phase 6b + `--remap`/`--split` extracted from
  ba-pitch-analyzer as its own pure worker (distinct authority: sole writer of
  `scopes/*.json`; distinct failure mode: PA1), with trigger-eval dataset.
- Structural test sections #20–#23 (envelope discrimination + hook deny/defer, compile-order
  fact-threading, ingest single-writer round-trip incl. refute/unblock/reject, board-derive +
  spec-lint discrimination): 223 checks total.

### Changed
- **P2 — task-executor rewritten pure** (580 → ~210 lines): WorkOrder in → code + WorkResult
  out. Deleted GATE A/B/E, Phase 3 doc fan-out, all standalone-vs-brief branching; kept the
  craft verbatim (PLAN assumptions + observable criteria, Karpathy minimum-code/surgical, UI
  Layer 1/2/3, contract-reference, Non-Go stop, ESCALATE, zero-memory rule). New
  anti-rationalization table + verification checklist (agent-skills anatomy).
- **P3 — spec-evaluator rewritten pure** (462 → ~230 lines): criteria/verdict/refuted-boxes
  return as data; `.verdicts` append, task-file annotation, box un-ticking and run-state
  writes moved to ingest. Skeptical posture, T0-citation (sha256 recomputed), affordance-only
  UI grading, dimension model — unchanged.
- **P3 — ba-pitch-analyzer rewritten pure** (670 lines/15 flags/12 prose modes → ~190 lines,
  4 operations): mode write-rules are now per-operation substrate whitelists in
  compile-order, enforced by the sandbox hook instead of trusted to prose. Stateless: no
  run-state.md, no pitch_hash, no counters. Standalone keeps two flags (input, `--lens`).
- **P3 — orient / qa-edge-hunter aligned**: output-path conventions moved into the order;
  QA findings return in `discoveries[]` (ingest appends the ledger; single-writer preserved
  mechanically).
- **tech-lead 1.0**: BUILD is four calls — compile order → dispatch (`--order`) → ingest
  result → t0-verify; MAP SCOPES dispatches ba-pitch-analyzer then scope-architect;
  delegation/round-protocol references rewritten to the envelope port; GATE L1b disjointness
  re-assertion now runs `spec-lint.mjs`.
- **Scripts live inside their owning skill** (per the custom-skills packaging model — a
  skill's scripts ship beside its SKILL.md, so they exist on every channel that ships
  `skills/`): the orchestrator pipeline (`compile-order`, `ingest-result`,
  `validate-envelope`, `t0-verify`, `aegis-digest` + the two envelope schemas) moved to
  `skills/tech-lead/scripts|schemas/`; the planner mechanics (`board-derive`, `spec-lint`)
  to `skills/ba-pitch-analyzer/scripts/`; `sandbox-guard.mjs` to `hooks/` beside
  `gate-l2.mjs` (it is a PreToolUse hook, not skill tooling). Skill prose references its own
  scripts skill-relatively and sibling skills' scripts as `skills/<name>/scripts/…`
  (plugin-root relative). `scripts/shapeup-sdlc/` retains only dev/CI tooling (oracles,
  trigger-eval, verdict-ledger, distribute, migrations).
- Structural test #12 reworked from a pattern whitelist to existence checks: skill-local
  `scripts/` references must resolve inside that skill's directory; cross-skill
  `skills/<name>/scripts|schemas/` references must exist. Spec-lint's glob matcher inlined
  from sandbox-guard so the ba skill stays self-contained.
- **Migration `0004__pure-skill-architecture.sh`** for existing installs (skill code itself
  is replaced by `migrate.sh` step 1, which now also carries the bundled scripts/schemas +
  the new scope-architect skill): (1) refreshes the target's AGENTS.md
  `<!-- HARNESS_START/END -->` block — the old block documents retired flags an agent would
  still try to use, and `migrate.sh` never touched AGENTS.md before; byte-stable on re-run,
  user content outside the block preserved; (2) runs `board-derive.mjs --write` per local
  board so pre-v1.0 hand-authored `unlocks` don't trip spec-lint's EDGE-SYMMETRY red;
  (3) flags (never deletes) retired `briefs/` dirs and worker-written `run-state.md`.

### Removed
- **P4 — the legacy brief format** (`briefs/r<N>-a<M>.md`) and `--brief` mode; all
  standalone-vs-orchestrated dual-mode branching inside workers; ba's 15-flag surface
  (`--tasks-only`, `--from-discovered`, `--remap`, `--surface-only`, `--status`, `--assess`,
  gate-skip flags — each now caller context: an operation, a whitelist, or a script);
  task-executor's plumbing reference files (gates/context-loading/doc-update-rules/
  implementation-rules); ba's gates.md + audit-rules.md; worker-held state everywhere
  (**D6 closed — mechanically**, not aspirationally: the delegation.md caveat is gone).

## [0.5.0] - 2026-07-13

Root-caused and fixed the `island-escape` Ship-Gate findings (KB-BA-001/KB-BA-002): both KB
entries were symptoms of structural defects, now mechanized into the harness instead of left
as worker steering.

### Fixed
- **GATE L2 hook fail-open since v0.4.0** (`hooks/gate-l2.mjs`). The hook resolved the task
  board at `<spec>/tasks/_index.md`, which the Local Tasks Architecture emptied — so the
  round-EVAL gate silently stopped enforcing (island-escape reached EVAL with 16/20 task files
  `status: ready`). It now resolves `.shapeup-sdlc/<slug>/tasks/` (slug from `--feature`, spec
  path convention as fallback, `<spec>/tasks/` kept for pre-v0.4.0 layouts) and stays fail-open
  only when no board exists on the machine (legitimate boardless grading, spec-evaluator v0.9).
  4 new structural tests (#14).
- **Sandbox guard (PA3) blocked the doer's own bookkeeping**
  (`scripts/shapeup-sdlc/sandbox-guard.mjs`). On scoped runs the guard denied every write
  outside the substrate — including task-executor P3's required doc updates (status, AC ticks,
  `tasks/_index.md`, run-state, the P3.7 discovery ledger), which is the mechanism behind the
  stale board. New run-trace carve-out: writes under the ACTIVE feature's
  `.shapeup-sdlc/<slug>/` root are always allowed; `.shapeup-sdlc/active-scope` (the guard's
  own pointer) and other features' roots remain guarded. 4 new structural tests (#17).

### Changed
- **`ba-pitch-analyzer` v3.3 — Link-Field Integrity + drift handling.**
  - `unlocks` is now a DERIVED field: recomputed as the full board's `depends_on` inverse on
    every board write (Phase 6, `--tasks-only`, `--from-discovered`). The reconcile mode's
    regenerate-whitelist now explicitly includes existing tasks' `unlocks` frontmatter —
    the old "Regenerate ONLY" list prohibited the back-patch, which is what produced
    island-escape's 10 asymmetric edges. Audit L3-06 upgraded from "field present" to an
    edge-symmetry check.
  - UC `related_tasks` RETIRED (schema, template, synthesis S-01 single-source, spec-evaluator
    CMP-2 rephrased with identical semantics). Rule: never declare a bidirectional field
    across the committed/local boundary — task ids renumber per machine, so reverse lookup is
    always computed live. Pre-v3.3 specs keep the field ignored (non-regression).
  - Bare `--tasks-only` bootstrap initializes task `status` from committed mechanical truth at
    SCOPE granularity (hill shard FINISHED → done; join on scope, never task id). Companion to
    the GATE L2 fix — without it the repaired hook would hard-block re-EVAL on every freshly
    bootstrapped machine for a finished feature.
  - `--from-discovered` gains a drift check that FLAGS (never fixes) board-vs-T0 status
    disagreement as ⚠️ markers in `tasks/_index.md`; `--remap` reports drift in its gate block
    only (its write contract stays `scopes/*.json` + `scope-board.md`). Status authority stays
    with task-executor / the tech lead.
- **`coach` — new `harness-defect` category at GATE COACH-1.** Feedback whose root cause is
  the mechanism itself (a fail-open hook, a gate reading the wrong file, contradicting skill
  contracts) is no longer force-fit into a worker KB: the PO can now categorize it
  `harness-defect`, and the coach files it to the committed defect register
  (`docs/shapeup-sdlc/knowledge-base/harness-defects.md`) as a drafted raw idea for the
  Betting Table — durable and PO-visible, but read by no worker. Step 3's merge pass also
  reclassifies wrong-premise KB rules into the register instead of re-teaching them
  (KB-BA-002 was exactly this class: it filed a PA3/gate defect as BA steering, on a premise
  task-executor v1.2 and tech-lead v0.5 contradict).

## [0.4.0] - 2026-07-12

### Changed
- **Local Tasks Architecture** (`docs/plan/local-tasks-architecture.md`). The task board
  (`tasks/TASK-NNN*.md` + `tasks/_index.md`) moves out of the committed SHARED spec dir
  (`docs/shapeup-sdlc/<slug>/spec/`) into the LOCAL, gitignored run-trace root
  (`.shapeup-sdlc/<slug>/tasks/`). The shared repo now carries only high-level requirements —
  `usecases/`, `domain-model.md`, `contracts/`, `scopes/`, `scope-summary.md` — never
  implementation-planning detail.
  - **`ba-pitch-analyzer` v3.2**: Phase 6 writes `tasks/` to the LOCAL root. New bare
    `--tasks-only [spec_folder]` bootstrap mode regenerates a missing local board from the
    committed spec alone (no discovered-ledger reconciliation).
  - **`spec-evaluator` v0.9**: grading source of truth moves from a task file's own
    `## Acceptance Criteria` onto the committed `usecases/UC-*.md` (Steps, Error Cases,
    Invariants, Test Surface) + `domain-model.md`. A local task file, when present, is
    read only for traceability and AC-checkbox bookkeeping — its absence is no longer a
    hard stop (new GATE V0.2b).
  - **`tech-lead` v0.15**: GATE L1b (Board Review) now reviews the SHARED plan —
    `usecases/_index.md` + `scopes/*.json` + `scope-summary.md` — instead of the LOCAL task
    board, keeping implementation detail out of the PO gate on any spec with scope contracts.
    New bootstrap check auto-invokes `ba-pitch-analyzer --tasks-only` when a teammate (or a
    resumed run) has the shared spec but no local board yet.
  - **`task-executor` v1.5**: GATE A resolves `tasks/<task_id>*.md` from the LOCAL root; a
    missing local board next to a present shared `usecases/` is a soft, bootstrappable
    condition, not a hard failure.
  - **Migration `0003__local-tasks-architecture.sh`**: moves any pre-v0.4.0 committed
    `docs/shapeup-sdlc/<slug>/spec/tasks/` to `.shapeup-sdlc/<slug>/tasks/` for every existing
    feature slug, idempotently.

## [0.3.0] - 2026-07-12

### Added
- **v0.3.0 harness upgrade (design spec v1.1 + file-organization addendum).** Design paper:
  `docs/v3/`. Six agent pathologies (PA1–PA6) now each have a mechanical countermeasure, active
  only when a spec folder has scope contracts (`docs/shapeup-sdlc/<slug>/scopes/*.json`) —
  fully non-regression on pre-v0.3.0 specs.
  - **T0 mechanical layer** (`scripts/shapeup-sdlc/t0-verify.mjs`, `scripts/shapeup-sdlc/aegis-digest.mjs`): every build
    attempt runs the scope's Playwright fixtures + an optional DB probe, then — on green — a
    **seesaw regression check** against every already-FINISHED scope's fixtures. Writes a citable
    JSON verdict artifact (sha256'd) that `spec-evaluator`'s new GATE V0.7 requires — a verdict
    is now structurally invalid on a scoped spec without citing it (closes the "hospitality
    trap", PA4). Zero LLM tokens; deterministic tooling, not a second judge (DD-7). A seesaw
    regression triggers a safe `git stash` (never a hard discard) + retry, not a silent merge
    (PA5). Failures are distilled by the AEGIS digester into `{file, line, core_message}` triples
    fed into the next attempt's brief — no raw log dumps (PA6).
  - **Sandbox guard** (`scripts/shapeup-sdlc/sandbox-guard.mjs`, new `PreToolUse` hook on `Edit|Write|MultiEdit`):
    blocks any write outside the active scope's `allowed_file_substrate` (+ declared
    `shared_substrate`), reading a `.shapeup-sdlc/active-scope` pointer written by `tech-lead` at
    scope checkout. Fail-open when no harness round is in progress; every denial is logged as a
    `PA3` pathology event to `docs/shapeup-sdlc/metrics/<machine-id>.jsonl`.
  - **Scope contracts** (`ba-pitch-analyzer` v3.1, new Phase 6b/GATE 6b): groups the task board
    into vertically-sliced, committed scope contracts — import/business-flow slicing (never by
    directory, PA1 lint), a size lint (PA2), an `affordance_manifest` (Layer 1 of the UI
    anatomy), and `e2e_verification_fixtures` authored at contract time. New `--remap` mode
    reconciles discovered tasks into scopes or splits a stuck one.
  - **`advisor-protocol`** (new skill): the `ESCALATE` grammar (design-decision / spec-ambiguity /
    substrate-expansion) workers use instead of guessing or asking ad hoc, capped at 3/scope/round,
    answers persisted immediately to a new committed `round-ledger.md` so they survive
    `task-executor`'s **zero-memory handoff** (isolated per-attempt briefs, no prior-attempt chat
    history — flat per-attempt token cost, PA6).
  - **`scope-hammer`** (new skill): GATE H's census → baseline comparison (never vs. a perfect
    ideal) → cut list + ship verdict, handling all three stop triggers (normal stop, outer
    round-budget breaker, inner per-scope attempt-budget breaker) — `tech-lead` SHIP now
    delegates here instead of hammering inline.
  - **Two-level circuit breaker** (`tech-lead` v0.13, DD-9): the existing `--max-rounds` becomes
    the OUTER breaker; a new per-scope `--attempts` (default 5) is the INNER breaker — an
    exhausted scope queues a GATE H hammer *proposal* instead of blocking the round. New GATE
    L0.8 (four-layer model/budget resolution, incl. `.claude/settings.local.json`) and mechanical
    **hill-phase derivation** (`UPHILL_UNKNOWN`/`UPHILL_SOLVED`/`DOWNHILL_EXECUTION`/`FINISHED`,
    committed `hill/<scope-id>.yml` shards) — never self-reported by a worker (DD-10, closes the
    confidence-score risk outright).
  - **Task-executor UI discipline** (v1.4): Layer 1/2/3 anatomy embedded in Phase 2 — bind only to
    the affordance manifest's `test_id`/`role`/`data-state`, hardcoded data arrays banned (the T0
    DB probe exists precisely to catch a pretty frontend over a hollow backend), pixel-perfect
    styling frozen out of this cycle. `spec-evaluator` (v0.8) grades UI **affordance-only** —
    never pixels/colors/fonts — so the freeze can't leak back in through the judge.
  - **File organization** (design spec addendum, Tiers A/B/C): scope contracts and hill shards
    move to the committed `docs/shapeup-sdlc/<slug>/` tree (never a gitignored runtime file — a
    teammate needs scope A's substrate to respect disjointness, and the sandbox hook enforces
    committed truth); the metrics harvest shards to `docs/shapeup-sdlc/metrics/<machine-id>.jsonl`
    so concurrent runs never merge-conflict on one file; new committed Tier C templates
    (`.claude/settings.local.example.json`, `.env.shapeup.example`) with matching `.gitignore`
    rules for the real per-member files. The env file/keys are `SHAPEUP_`-namespaced
    (`.env.shapeup.local`, `SHAPEUP_T0_DATABASE_URL`) so they can never collide with, or be
    mistaken for, the target project's own `.env`/`.env.local`.
  - **Scripts consolidated under `scripts/shapeup-sdlc/`** (mirrors the `docs/shapeup-sdlc/` /
    `.shapeup-sdlc/` naming): `lib/`, `migrations/`, `oracles/`, `distribute.js`, and every
    runtime script (`t0-verify.mjs`, `aegis-digest.mjs`, `sandbox-guard.mjs`, `trigger-eval.mjs`,
    `verdict-ledger.mjs`) moved out of the flat `scripts/` root. `install-harness.sh` and
    `migrate.sh` stay at the stable top-level `scripts/` path on purpose — they are the update
    mechanism's own bookmarked entrypoints, so they are the one thing this reorg must not move.
    `hooks/hooks.json`, `package.json`, `tests/structural.mjs`, and every skill/doc reference
    were repointed at the new paths; test #12's shipped-skill-path guard now matches
    `scripts/shapeup-sdlc/(t0-verify|aegis-digest|sandbox-guard)\.mjs`.
  - **Migration `0002`** brings a pre-0.3.0 install up to the file-organization addendum via
    `migrate.sh`: shards a flat `docs/shapeup-sdlc/metrics.jsonl` into
    `metrics/<machine-id>.jsonl` (old file retired to `metrics.jsonl.migrated`, never deleted),
    adds the Tier C `.gitignore` rules, and drops the Tier C example templates — the same three
    steps a fresh `install-harness.sh` run already did, now available to existing installs too.
  - Structural coverage grew 195 checks (3 new sections: sandbox guard allow/deny + pathology
    telemetry, T0 verdict/artifact/seesaw discrimination, AEGIS digest extraction/dedup).
- **Trigger-eval evidence layer (Stage C1, dismantles the F1 fiction).** The real version of the
  evidence layer the prior roadmap claimed "LANDED" but never committed. Each skill now has
  `skills/<name>/evals/trigger-evals.json` — 103 `{query, should_trigger}` cases across 9 skills,
  every dataset pairing positives with **cross-skill hard negatives** (a sibling's queries, tagged
  `expected_other`) plus an out-of-harness control. `scripts/shapeup-sdlc/trigger-eval.mjs` (repo-only) measures
  **real Skill-tool activation** with the plugin installed (`--plugin-dir .`), explicitly *not* the
  slash-command self-invocation that made the prior TPR≈0 a proxy artifact. Two honesty guards: the
  baseline (`evals/baselines/trigger-evals.baseline.json`) ships `status: "unmeasured"` /
  `results: null` and **no number is fabricated** until an auth'd run produces it; and a measurement
  run that produces no parseable model events **aborts without writing** rather than recording every
  case as a non-trigger. Structural **#16** enforces dataset shape + the honesty invariant (an
  `unmeasured` baseline carrying results fails CI). Coverage grew 137 → **159 checks**.
- **Judge calibration — verdict ledger (Stage D1, closes F3).** `spec-evaluator` (v0.7) gains
  `references/verdict-ledger.md`: (1) **re-probe on FAIL** — re-run a failing probe once before
  finalizing; if the two disagree the FAIL stands but is marked flaky/confidence-low; (2)
  **per-criterion confidence** (high/medium/low) by a fixed rule, reported but never overriding the
  verdict; (3) an append-only **`.verdicts-<task>.jsonl` ledger** that flags verdict **flips**
  across runs (a flip forces confidence low and a stability line in the report). New GATE V2.1b +
  Phase B.0 steps, two hard rules, and a report stability block. The single-judge invariant is
  untouched — same judge, same probe, bookkeeping over its own outputs (no second grader). A
  repo-only `scripts/shapeup-sdlc/verdict-ledger.mjs` implements the flip/confidence grammar with structural test
  **#15** proving it discriminates an unstable judge from a stable one; **not shipped** (F9).
  Structural coverage grew 127 → **137 checks**.
- **GATE L2 is now runtime-enforced (Stage E1, closes half of F2).** A `PreToolUse` hook
  (`hooks/gate-l2.mjs`, matcher `Skill`) hard-blocks the once-per-round EVAL delegation
  (`spec-evaluator --single-pass`/`--feature`, no `--task`) whenever `tasks/_index.md` is not fully
  green — the deny message names the unfinished tasks and routes back to BUILD. It reads two
  independent sources (per-task frontmatter `status:` + the board table) and **fails closed** on a
  partial board, **open** when there's nothing to verify (no `--spec`, no board, per-task eval,
  other skill) so it can't break legitimate or standalone runs. This is the audit's "one real gate
  beats ten honor-system ones" — every other ⏸ GATE remains a prompt-level instruction. Structural
  test **#14** exercises deny/allow against temp board fixtures; **#4** was hardened to reject the
  invalid-event bug class (the dead `ShapeupSessionStart` → real `SessionStart`) and to assert every
  hook-referenced script exists. Structural coverage grew 119 → **127 checks**.
- **Anti-leniency regression fixture (Stage C2, judge-first).** The first Tier-2 functional fixture
  — `examples/eval-planted-bug/` — plants a FizzBuzz AC4 bug (`15` → `Fizz`) in a build dressed to
  look done: every AC box ticked, its own test suite green-but-blind. The skeptical
  `spec-evaluator` must FAIL it by probing the running CLI (TS-04), not trusting the green suite; a
  known-correct control build must PASS. The bug's reality is proven **deterministically** by
  structural test **#13** via the `process` oracle (PASS on correct, FAIL on buggy) — no Claude
  auth needed; the LLM behavioral assertion (`evals.json` + `EXPECTED-VERDICT.md`) is documented for
  the auth-gated `eval-gate` run. Repo-only dev/CI asset (not shipped, per F9). Structural coverage
  grew 107 → **119 checks**. See `examples/eval-planted-bug/README.md`.
- **Evaluation contract complete (Stage G).** `spec-evaluator` can now judge non-UI deliverables
  with evidence-cited verdicts. `references/probing.md` describes each oracle as a **self-contained
  spawn-and-grade procedure** (with an inline `expect` grammar) the evaluator runs via Bash —
  `process` (CLI/scripts), `test` (libraries; zero-test suite FAILs), `snapshot` (generators/pure
  refactors; diff vs golden), `http` (services; unreachable = FAIL every criterion), plus `ui`
  (Playwright). The single-judge invariant is untouched — the oracle changes only *how* evidence is
  gathered. See `docs/audit/evaluation-contract-spec.md`.
- **Executable reference implementations (dev/CI only).** `scripts/shapeup-sdlc/oracles/*.mjs` + `examples/*`
  implement that exact grammar with negative-control tests, so the documented procedure is proven to
  discriminate. They are **not shipped** (and not called by the installed skill) — see "Runtime
  model" in the spec.
- **Install-safety guard.** Structural test **#12** fails any shipped skill file that references a
  repo-only path (`scripts/`, `examples/`, `docs/audit|plan|research/`, `tests/`) that would not
  exist in an install. Fixes finding **F9** (shipped skills had dangling refs to the oracle runners,
  example contracts, and `docs/` cross-refs). Structural coverage grew 62 → **107 checks**.

### Changed
- **Versioned migration system.** Updating an install is now a Flyway/Rails-style migration:
  `scripts/migrate.sh` updates code (replaces skills) then applies pending
  `scripts/shapeup-sdlc/migrations/NNNN__*.sh` in order, tracked in a committed
  `docs/shapeup-sdlc/.harness-migrations` ledger + `.harness-version` stamp. Idempotent; every
  future version adds its own migration. The old flat-KB transform is now migration `0001`.
  Runner lives in `scripts/shapeup-sdlc/lib/lib-migrate.sh`. See `docs/audit/migration-system.md`.

### Removed
- **PowerShell scripts** (`install-harness.ps1`, `lib/lib-harness.ps1`, `migrate-knowledge-base.ps1`)
  — the harness is bash-only now (macOS / Linux; Windows via WSL or Git Bash), keeping a single,
  well-tested code path.
- **`scripts/migrate-knowledge-base.sh`** — superseded by `scripts/migrate.sh` (its transform is
  migration `0001`). Update existing installs with `migrate.sh` instead.

## [0.2.6] - 2026-06-23

### Fixed
- **`curl | bash` / `irm | iex` install was broken in 0.2.5.** The shared lib refactor made the
  installer source a sibling `lib/lib-harness.{sh,ps1}` that does not exist when the script is
  piped, failing with `lib/lib-harness.sh: No such file or directory`. Both installers and the
  migration scripts now bootstrap the lib: source the sibling file when run from a clone, or
  download it from the repo when piped.

### Added
- **Remote update one-liner.** Existing installs can upgrade with a piped
  `migrate-knowledge-base.sh` (auto-detects installed CLIs under `--yes`); documented in the README.

## [0.2.5] - 2026-06-23

### Added
- **Team-shared, read-back knowledge base.** `/coach` now files each guideline by skill under
  committed `docs/shapeup-sdlc/knowledge-base/<skill>.md` (shared on `git pull`) instead of one
  flat, gitignored `.shapeup-sdlc/knowledge-base.md` that was never read back. New **GATE COACH-1**
  asks the PO which skill each rule belongs to (`task-executor`, `ba-pitch-analyzer`,
  `qa-edge-hunter`) — never assumes. `spec-evaluator` is deliberately not coachable (single-judge
  rule: the KB is guidance, not an invariant).
- **Read-side hooks**: `task-executor` (Phase 1), `ba-pitch-analyzer` (Phase 1), and
  `qa-edge-hunter` (Phase Q1) each load their own knowledge-base file at the top of their run.
- **Migration scripts** (`scripts/migrate-knowledge-base.sh` and `.ps1`): one-time, idempotent,
  non-destructive upgrade for existing installs. Prompts for which AI CLI(s) are in use (Claude
  Code / Antigravity / Codex) — auto-detecting under `--yes`/`-Yes` — and **replaces the installed
  skills** for each, then moves an old flat knowledge base into the new committed location,
  preserving rules into `_INBOX.md` for `/coach` to categorize (never auto-assigned), and retires
  the old file.
- **Shared installer library** (`scripts/lib/lib-harness.sh` and `.ps1`): factors out source
  resolution, CLI detection/selection, and per-skill replacement. **Both `install-harness` and
  `migrate-knowledge-base` now reuse it** — the installer no longer duplicates source-download or
  skill-copy logic.

### Changed
- `tech-lead` 0.12: GATE L4 hands raw feedback to `/coach`, which now owns categorization; the
  tech lead no longer points at the local knowledge-base path.

## [0.2.0] - 2026-06-19

### Added
- **Local scaffolding installer** (`scripts/install-harness.sh` and `install-harness.ps1`): installs
  the harness as local files into any target repository, configuring Claude Code (`.claude/skills/`),
  Antigravity (`.agents/skills/`, `.agents/subagents/`), and Codex (`.codex/skills/`) in one command.
- Remote install downloads the source tarball and `antigravity-subagents.zip` directly from the
  latest GitHub Release asset — no `git clone` of the repo required.
- Release workflow now archives and publishes `antigravity-subagents.zip` and `cursor-rules.zip`
  as GitHub Release assets, making them available for the remote installer.

### Changed
- **Two-root workspace.** Collapsed the three runtime artifact roots into two, keyed off
  the feature `<slug>` and split by collaboration need (`shapeup` v2.2, `tech-lead` v0.9):
  - **Shared** (committed): `docs/shapeup-sdlc/<slug>/shaping/` + `docs/shapeup-sdlc/<slug>/spec/`,
    plus the harvest feed `docs/shapeup-sdlc/metrics.jsonl`.
  - **Local** (hidden, gitignorable — one line `.shapeup-sdlc/`): run-state, digest, `orient/`,
    `evaluation/`, `qa/`, `discovery/ledger.md`, `harness-run.md`, `spikes/`.

  Migration for in-flight specs in target repos (old → new):
  - `docs/shaping/<slug>/`        → `docs/shapeup-sdlc/<slug>/shaping/`
  - `.claude/specs/<slug>/` (deliverable docs) → `docs/shapeup-sdlc/<slug>/spec/`
  - `.claude/specs/<slug>/` (orient/ · evaluation/ · qa/ · discovery/ · run-state · harness-run) → `.shapeup-sdlc/<slug>/`
  - `.claude/shapeup/runs/<slug>/` → `.shapeup-sdlc/<slug>/`
  - `.claude/shapeup/runs/metrics.jsonl` → `docs/shapeup-sdlc/metrics.jsonl`

  The `.gitignore` carve-out (`.claude/shapeup/runs/*/` keeping `metrics.jsonl` tracked) is
  replaced by a single `.shapeup-sdlc/` line, since the committed metrics feed now lives in
  the shared root.

## [0.1.0] - 2026-06-17

### Added
- Initial release of the Shape Up SDLC harness, packaging eight skills:
  - `shapeup` v2.1 — shaping, breadboarding, spike, framing/kickoff docs, plus a
    per-run context-compaction digest (derived decision read model) consumed at each gate
    (reuses material from [rjs/shaping-skills](https://github.com/rjs/shaping-skills)).
  - `translator` — non-English intake normalization (GATE L0).
  - `orient` — builder-led codebase recon (step 7).
  - `ba-pitch-analyzer` v2.9 — scope mapping into a DDD document tree + Test Surface.
  - `task-executor` v1.3 — vertical building of `TASK-NNN` specs.
  - `spec-evaluator` v0.5 — the single judge, once per round.
  - `qa-edge-hunter` v1.0 — post-PASS exploratory edge hunt.
  - `tech-lead` v0.8 — end-to-end orchestrator; SHIP harvests one fact-only signal row
    to `docs/shapeup-sdlc/metrics.jsonl`.
- `/ship` command, `reviewer` agent, and a `SessionStart` hook.
- Self-hosting marketplace manifest so the repo installs directly from GitHub.
- CI workflow (`claude plugin validate --strict`) and tag-driven release workflow.
- `docs/roadmap.md` — full annotated pipeline diagram.
