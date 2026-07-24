# Plan — Optimize `skills/` via skill-creator, per-skill script separation, and `tests/structural.mjs` split

**Status:** proposed (2026-07-15) · re-baselined (2026-07-23) · **Baseline:** v1.3.0, `npm test` green
**Method:** the skill-creator skill's audit loop (description-as-trigger, progressive
disclosure, bundled resources, eval-driven iteration) applied to the 13 harness skills,
plus two maintenance refactors it surfaces: script ownership and test modularization.

> **Re-baseline note (2026-07-23, v1.3.0 traceability spine).** Since this plan was drafted the
> spine landed: a 13th skill (`solution-architect`), the `trace-lint.mjs` oracle (tech-lead's 8th
> script), a `coverage` op on ba-pitch-analyzer, three new SHARED artifacts (`requirements.md`,
> `wiring-map.json`, `project-profile.json`), and test section **§31**. The measured facts and
> track targets below are updated to that baseline; the spine surface is now **in scope** for the
> same optimization (its two new skills and one new script get the same treatment, called out
> inline). One target moved from "optional" to **blocking**: tech-lead is now at the ratchet
> ceiling (749/750), so the A3 extraction is a prerequisite for any further prose there, not a
> nice-to-have.

---

## Current state (measured)

| Surface | Fact (v1.3.0, 2026-07-23) |
|---|---|
| Skills | **13 dirs** (was 11 at draft; +`solution-architect` in v1.3); every one has `SKILL.md` + `evals/trigger-evals.json` (test #16 enforces ≥4+/≥3− cases) |
| SKILL.md sizes | tech-lead **749** (ratchet 750 — **at the ceiling**), shapeup 403, qa-edge-hunter 382, orient 273, translator 258, coach 214, spec-evaluator 209, task-executor 203, ba 188, scope-hammer 186, advisor 171, **solution-architect 122**, scope-architect 118 |
| Frontmatter descriptions | ~700–1,300 chars each (tech-lead, qa-edge-hunter, translator, coach are the heaviest; solution-architect's is on the heavier side too and should ship lean from birth). Descriptions are **always in context** for every session — this is the costliest prose in the plugin |
| Per-skill scripts | tech-lead: **8** (`compile-order`, `ingest-result`, `validate-envelope`, `t0-verify`, `run-snapshot`, `stats`, `aegis-digest`, **`trace-lint`**); ba-pitch-analyzer: 2 (`board-derive`, `spec-lint`). `solution-architect` bundles **none** — it writes `wiring-map.json` directly, same as scope-architect writes scopes (correct, not a gap). No other skill bundles scripts |
| Repo-root `scripts/shapeup-sdlc/` | oracles (5 files, dev/CI-only), `verdict-ledger.mjs` (spec-evaluator's reference impl), `trigger-eval.mjs` (Tier-1 harness), migrations, `distribute.js`, shell libs |
| Layer-3 resources | ba (7 refs + 22 templates), spec-evaluator (11 refs), tech-lead (3 refs), shapeup (7 resources), translator (1 ref). **Seven skills have no references/ or scripts/ at all**: task-executor, qa-edge-hunter, coach, orient, advisor-protocol, scope-hammer, scope-architect, solution-architect (the last two write contracts directly — SKILL.md-only is correct for them) |
| `tests/structural.mjs` | **1,726 lines, 31 sections** (§31 = the trace-lint / spine oracle), one file; bespoke `ok/fail/section` micro-framework; self-referential invariants: #25 line ratchet, #26d checks-floor ("N+ checks" in docs must not exceed actual), #26c cited paths (docs cite `tests/structural.mjs` by name) |

---

## Track A — Skill optimization (skill-creator methodology)

### A1. Shrink frontmatter descriptions; move contracts into the body
skill-creator's rule: the description carries **what it does + when to trigger**, nothing
else. Today the descriptions also carry behavioral contracts ("NO verdict, NO score,
never fixes code…", envelope semantics, version changelogs like "v0.13: …"). Those
belong in the SKILL.md body — they load only when the skill triggers, not in every
session's metadata.

- Target: ≤ ~500 chars per description, keeping the pushy trigger phrases and the
  "use even when the user doesn't name it" clause (skill-creator's under-trigger fix).
- Worst offenders first: qa-edge-hunter, tech-lead, translator, coach, task-executor.
  Also trim **solution-architect** (born in v1.3 with a long, example-heavy description — the
  audit-loop verb list + "the asset pipeline has zero call sites" narrative belongs in the body,
  not the always-in-context metadata); shrink it before it counts as legacy prose.
- Guard the win — **two guards, not a length cap.** Length is a symptom; the defect is
  *misplaced content*, so lint the content, not the character count (skill-creator selects
  `best_description` by held-out trigger score, never by length — a hard char ratchet would
  fight its own methodology and could deny the model legitimate pushy trigger context):
  1. *Effectiveness (hard gate):* Tier-1 trigger-evals — see the Safety bullet below. This is
     the arbiter of whether a description triggers correctly.
  2. *Anti-bloat (hard gate):* add a **description-composition lint** to the structural tests —
     fail if a description contains changelog/version markers (`v0.N:` — tech-lead's ends with a
     literal `v0.13: …`) or behavioral-contract prose (`NO verdict, NO score`, envelope
     semantics). These are provably neither what-it-does nor when-to-trigger, yet sit in context
     every session; trigger-evals are blind to them because they measure trigger *accuracy*, not
     token *cost*. This mechanizes "move contracts into the body" without a char cap.
  - Keep **~500 chars as a rewrite target**, not a blocking ratchet — direction for the manual
    rewrite, validated by trigger-evals, not a gate that fails CI.
- Safety: trigger accuracy is already measurable — every skill ships
  `evals/trigger-evals.json`. Re-run Tier-1 (`scripts/shapeup-sdlc/trigger-eval.mjs`)
  before/after; a measured regression on any positive case reverts that skill's edit.

### A2. Description optimization loop (optional, per-skill, billed)
skill-creator ships `scripts.run_loop` (uses `claude -p`): 60/40 train/test split over
the trigger-eval set, 3 runs per query, up to 5 improvement iterations. Reuse each
skill's existing `trigger-evals.json` (convert `query/should_trigger` to the eval-set
shape). Run only where A1's manual rewrite measures worse than baseline. Do **not**
let it write results into the baseline file — the honesty invariant (#16) requires
`method` + `measured_at` if we record numbers.

### A3. Progressive disclosure — slim the skill at the ratchet ceiling (now blocking)
- **tech-lead (749/750 — at the ceiling):** the spine added the WIRE/L1a.5 block and the
  traceability-spine step, consuming the last of the headroom. This extraction is **no longer
  optional** — the next line of prose fails #25. Extract the gate playbooks (L0 intake matrix,
  L1a/L1a.5/L1b review scripts, L3 verdict loop, L4 ship sign-off — ~340 lines) into
  `references/gates.md`, and the Invocation/flags block into `references/invocation.md`, leaving
  the workflow spine + hard rules in SKILL.md. Then **lower the #25 ratchet to ~450** so the cut
  is locked in, per the ratchet's own design ("new logic goes into scripts, not prose"). The new
  WIRE/spine step moves into `references/gates.md` with the other gate scripts.
- **shapeup (403) / qa-edge-hunter (382):** below the 500 guidance; touch only if A4
  adds material. qa-edge-hunter's six lenses are a natural `references/lenses.md`
  extraction if it ever grows.
- **solution-architect (122) / scope-architect (118):** the two direct-writers are lean by
  design (contract-writers, not layered workflows) — leave them; adding layers is negative value.

### A4. Fill missing layer-3 where repeated work signals it
skill-creator's "look for repeated work" test: bundle a resource only when runs keep
re-deriving the same thing. Known candidates (verify against real run transcripts in
`.shapeup-sdlc/` before adding):
- **task-executor:** Layer 1/2/3 UI rules + T0-fixture conventions → `references/`.
- **qa-edge-hunter:** lens catalog + repro-report format → `references/`.
- **coach / advisor-protocol / scope-hammer / solution-architect / scope-architect:** small
  enough (or direct-writers) that SKILL.md-only remains correct; do nothing (adding layers to a
  118–122-line skill is negative value).

### A5. Behavioral eval loop (the heart of skill-creator, run last)
Pick the two highest-leverage workers — **task-executor** and **ba-pitch-analyzer**
(both coachable, both with committed KB feedback history) — and run one full
skill-creator iteration each: 2–3 realistic prompts, with-skill vs current-version
baseline in a workspace, grade with assertions, `generate_review.py` viewer, apply
feedback. spec-evaluator already has its Tier-2 fixture (`examples/eval-planted-bug/`)
— reuse it as that skill's eval rather than inventing prompts. This track is the only
one needing subagent time; everything above is deterministic.

---

## Track B — Script separation per skill

Ownership rule to encode (it's already implicit in test #12): **runtime scripts live
inside the owning skill; repo-root `scripts/` is dev/CI/install-time only.**

1. **Move `scripts/shapeup-sdlc/verdict-ledger.mjs` → `skills/spec-evaluator/scripts/verdict-ledger.mjs`.**
   It is the executable reference impl of spec-evaluator's own grammar
   (`references/verdict-ledger.md`) — the one runtime-relevant script still stranded
   at repo root. After the move the skill can cite it (`scripts/verdict-ledger.mjs`
   is exactly the skill-local form test #12 whitelists). Update test #15's path and
   `references/verdict-ledger.md` if it names the old location.
2. **Deliberately keep at repo root** (shipping them would violate the boundary):
   oracles + `trigger-eval.mjs` (CI evidence layer), `migrations/` + `lib/`
   (install/upgrade-time), `distribute.js` (release-time). Add a one-paragraph
   `scripts/README.md` stating the rule so the next contributor doesn't "helpfully"
   move them.
3. **No re-homing of tech-lead's 7 scripts** — they are all orchestrator-owned by the
   envelope-port architecture (single-writer `ingest-result`, hook-validated
   `compile-order`); splitting them across workers would reopen D6.
4. **Per-script test co-location** comes from Track C (each owning skill gets its own
   test module), which is where the "easier maintenance" payoff lands.

## Track C — Split `tests/structural.mjs`

Goal: same **31 sections**, same zero-dep counter (`ok/fail/section`), but one module
per ownership domain so a skill change touches one small file.

**Why not migrate to `node:test`?** The `#26d` floor counts **assertions dynamically** —
the 399 runtime count comes from ~195 `ok()` call-sites firing inside loops over
discovered files (every skill, hook, oracle fixture), so the count is data-driven and
rises on its own when the repo grows. `node:test`'s reporter model is **test-block-granular
and static**: it observes declared `test()`/`it()` pass/fail events, not the `assert` calls
inside them. A reporter therefore *changes* the ratchet's granularity rather than preserving
it — assertions could be gutted inside a surviving block undetected — and to keep
assertion-count semantics you would rebuild `ok()` as a counting assert-shim anyway (the
custom bit doesn't go away, it just gains a dependency). The `ok/fail/section` "framework"
is three lines, not a reimplemented runner, so the "don't maintain a custom runner" red flag
mostly misfires here. A `node:test`-for-structure + `ok()`-for-counting **hybrid was
considered and deferred**: it buys per-test isolation at the cost of a dependency plus
cross-process counter-aggregation (if parallel) — and item 3 below delivers that isolation
in three lines instead.

```
tests/
├── structural.mjs            # thin runner: imports modules in order, aggregates
│                             # checks/failures, prints the same summary, exit 0/1
│                             # (name kept — docs cite it; #26c would fail otherwise)
├── lib/
│   ├── harness.mjs           # ok/fail/section counters, read/readJSON, frontmatter(), walk()
│   └── fixtures.mjs          # makeSpec/makeLocalSpec/makeCheckout/mkOrder, ask() hook driver
└── structural/
    ├── 01-manifests.mjs      # §1  plugin/marketplace/package agreement
    ├── 02-skills.mjs         # §2,3,12,16  per-skill wellformedness, install-safety, trigger-evals
    ├── 03-hooks.mjs          # §4,14,17,27,28,29  manifest + the five behavioral hook suites
    ├── 04-oracles.mjs        # §6,8,9,10,11,13  oracle registry + discriminating fixtures
    ├── 05-tech-lead.mjs      # §18–22,24,30,31  t0-verify, aegis, envelopes, compile/ingest, domain
    │                         # registry, stats, trace-lint + spine schema surface (all orchestrator-owned)
    ├── 06-ba-pitch-analyzer.mjs  # §23  board-derive + spec-lint
    ├── 07-spec-evaluator.mjs # §15  verdict-ledger (path updated per Track B.1)
    └── 08-docs.mjs           # §5,7,25,26  AGENTS.md-naming guard, migrations, ratchets, doc-drift
```

Mechanics:
- Each module exports `run(ctx)`; the runner threads a shared `{checks, failures}`
  context so the final count (and the checks-floor) is byte-for-byte comparable.
- **Isolate each module in the runner** — wrap every `mod.run(ctx)` in try/catch so a
  thrown section reports as one failure (`ctx.fail(\`${mod.name} threw: ${e.message}\`)`)
  and the run continues to the next module, instead of aborting the whole suite as the
  single-script form does today. This is the one thing `node:test` would have bought that
  matters here — bought in three lines, no dependency, no granularity change:
  `for (const mod of modules) { try { mod.run(ctx); } catch (e) { ctx.fail(...) } }`.
- Pure refactor first, **zero check additions/removals**: assert the post-split check
  count equals the pre-split count (record it in Phase 0).
- `08-docs.mjs` keeps §26d last, as today, so the floor sees the full count.
- Update `tests/README.md`'s section list once, and note new checks land in the module
  matching their owner.
- New checks from Tracks A/B land here afterwards: description-length ratchet → `02-skills.mjs`;
  lowered tech-lead ratchet → `08-docs.mjs`; verdict-ledger path → `07-spec-evaluator.mjs`;
  JSDoc-coverage check (Track D) → the module owning each documented script.

## Track D — JSDoc every function (input/output contracts)

Documentation mandate that rides along with the script work in Tracks B and C:
**every separate function — every `export`ed function, every top-level helper, and
every non-trivial inner function in every `.mjs` script — carries a JSDoc block that
describes its input and output in detail.** The scripts are the harness's executable
contracts (single-writer `ingest-result`, hook-validated `compile-order`, the
`trace-lint` oracle); their signatures are the seams other skills depend on, so the
input/output shape must be legible without reading the body.

Each JSDoc block states, in detail:
- **`@param`** for every parameter — its type (or the precise object shape: which keys,
  which are optional, what each means), units/enums where they exist, and what an
  out-of-range or missing value does (throws? defaults? skips?).
- **`@returns`** — the exact return shape (object keys and their meaning, not just
  `Object`), including the shape on the empty/no-op path.
- **`@throws`** wherever the function can throw (schema-validation failures, malformed
  envelopes, missing artifacts), naming the trigger condition.
- A one-line summary of the side effect for any function that writes shared state
  (which file/section it writes, since single-writer is an invariant, not a convention).

Scope & ownership:
- **In scope:** tech-lead's 8 scripts (`compile-order`, `ingest-result`,
  `validate-envelope`, `t0-verify`, `run-snapshot`, `stats`, `aegis-digest`,
  `trace-lint`), ba-pitch-analyzer's 2 (`board-derive`, `spec-lint`),
  spec-evaluator's `verdict-ledger` (after the Track B.1 move), and the Track C test
  modules + `tests/lib/` helpers (`harness.mjs`, `fixtures.mjs`) — document each
  exported `run(ctx)`, `ok/fail/section`, and every fixture factory as it is created.
- **Repo-root dev/CI scripts** (oracles, `trigger-eval.mjs`, migrations, `distribute.js`,
  shell libs): same mandate, lower priority — do them opportunistically when a Track
  touches the file.
- **Not a rewrite pass:** this is documentation only — **zero behavior change**. A
  function's body is never edited to satisfy its JSDoc; if the body contradicts a
  drafted `@returns`, the JSDoc is describing reality wrong and gets corrected, or a
  genuine bug is surfaced and filed separately (not silently fixed under a docs commit).

Guard the win:
- Add a **JSDoc-coverage check** to the structural tests (lands in the module owning
  each script per Track C: tech-lead scripts → `05-tech-lead.mjs`, ba → `06-…`,
  verdict-ledger → `07-…`, test helpers → wherever `tests/lib/` is asserted). The check
  parses each in-scope `.mjs`, enumerates its function declarations/exports, and fails
  if any lacks a preceding JSDoc block with at least one `@param` (when it takes args)
  and a `@returns` (when it returns a value). Count it into the check total so it feeds
  the #26d checks-floor and can't silently regress.

---

## Sequencing, verification, risks

| Phase | Work | Verify |
|---|---|---|
| 0 | Record baseline: `npm test` check count (**399 as of 2026-07-23, v1.3.0**; was 369 at draft) + Tier-1 trigger baseline status | test green |
| 1 | Track C split (pure refactor) | check count identical; `npm test` green |
| 2 | Track B.1 move + `scripts/README.md`; update §15 + doc citations | `npm test` green (§12, §26c prove no dangle) |
| 3 | Track A1 description rewrites + description ratchet; A3 tech-lead extraction + ratchet lowered | `npm test` green; Tier-1 re-run, no positive-case regression |
| 4 | Track A4 reference additions (evidence-gated) | §3 link checks green |
| 4.5 | Track D JSDoc pass over in-scope `.mjs` + JSDoc-coverage check | `npm test` green; new check counted into floor; diff is comments-only (no logic hunks) |
| 5 | Track A5 eval loop on task-executor + ba (skill-creator workspace/viewer flow); A2 only if A1 regressed | human review via `generate_review.py`; KB feedback addressed |

**Risks & guards**
- *Silently dropping a check during the split* → Phase 1's count-equality assertion.
- *Description rewrite hurts triggering* → Tier-1 measurement before/after (honesty
  invariant forbids guessing); per-skill revert.
- *A "docs-only" JSDoc pass sneaks in a behavior change* → Track D's commit must be
  comments-only; `git diff` shows no hunk touching a statement line, and `npm test`
  stays green with the pre-existing check count plus exactly the new JSDoc-coverage
  checks (no other count drift).
- *tech-lead extraction changes behavior* → extraction moves prose verbatim into
  `references/` with explicit "read when you reach GATE X" pointers (skill-creator's
  progressive-disclosure pattern); §3 verifies the links, the L2/L4 gates stay
  hook-enforced regardless of prose location.
- *Moved verdict-ledger breaks a consumer* → grep finds six citations to update in
  the same commit: test §15 (`vlPath`), `tests/README.md`, `README.md:280`,
  `docs/design/07-domain-erd.md`, `domain.schema.json` (`x-readers` annotation),
  and the script's own usage comment. §26c (cited-path existence) then proves
  none dangle. CHANGELOG entries stay as history.
- Distribution channels that copy only `skills/` (Cursor/Codex per §12 comment)
  **gain** the verdict-ledger script by this plan — a strict improvement.

**Out of scope:** hooks/ internals (just audited in v1.2.0), envelope schemas (including the
v1.3 spine additions — `RequirementClause`/`WiringMap`/`ProjectProfile`, the `covers`/`traces_to`
anchors), the oracle grammar (including the newly-landed `trace-lint.mjs` — it is already
correctly homed under tech-lead and Track B does not move it), and any change to the single-judge
/ single-writer invariants. This plan optimizes the *prose and file layout* of the spine's two new
skills; it does not touch the spine's mechanics or its advisory→gate promotion path.
