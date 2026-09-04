# Test Surface — Derivation Rules (v2.9)

`## Test Surface` is a **derived section** on each UC. It is generated *mechanically* from
material that already exists in the spec — never invented. If a test idea cannot cite its
source row below, it does not belong here (it belongs to exploratory QA, post-build).

**Why it exists.** `spec-conformance` grades the AC that were written; it cannot expand
them. The Test Surface is the systematic expansion — boundary values, negative cases,
error-code coverage — done once at spec time so the evaluator (`test-surface-conformance`
dimension) can probe it. Division of labor, a settled design decision:
derivable tests = BA + Evaluator (this file); exploratory edges = `/qa-edge-hunter`,
post-PASS, on the running app.

---

## Derivation table (exhaustive — these five sources, nothing else)

| # | Source (must exist in spec) | Mechanical rule → test entries |
|---|---|---|
| D1 | `## Invariants` `[INV-NN]` | One **violation-attempt** entry per invariant: construct the action that would break it, expect rejection/hold. `TS-INV-NN`. |
| D2 | `## Error Cases` table rows | One entry per error code: trigger the Condition, expect the Code + HTTP status. `TS-ERR-<CODE>`. |
| D3 | Contract Request shape (standard lens: `contracts/*.contract.md`; lite lens: UC `Input` interface) | Per required field: one **missing-field** entry + one **type-violation** entry. Per bounded field (length/range/enum): one **boundary** entry at each edge (min−1, min, max, max+1 where meaningful). `TS-REQ-<field>-<kind>`. |
| D4 | Pitch `No-gos` that touch this UC's actor/action | One **breach-probe** entry per relevant no-go: attempt the excluded behavior via the UC's surface, expect it blocked or absent (a hidden-but-reachable path = FAIL). `TS-NOGO-NN`. |
| D5 | Wiring Map (`wiring-map.md`) — this UC's `affordance` cell | One **reachability** entry per use case: drive that one entry affordance and expect the UC's own exit. `TS-REACH-<UC>` (per-UC, because "one per use case" collides on the first two otherwise). No wiring map ⇒ **this arm is SKIPPED**, never silently empty — the harness's standing absent-artifact rule. |

**Dedup rule:** if D2 already covers a D3 case (e.g. error table has `VALIDATION_400` for
missing field), emit ONE entry and cite both sources — never two entries for one probe.

**Why D5 is not just a fifth rule.** D1–D4 derive from invariants, error tables, contract
shapes and no-gos, and **none of them can express "the user can actually get here."** Grade a UC by
outcome alone and this passes: a Pay button wired to nothing, while the payment engine works
correctly and is exercised by some other path. Order row present, verdict green, and no user can
ever pay — the *orphaned engine*, which is the most common shape of machine-written code (engine
correct, call site missing) and the defect the wiring map exists to prevent. `harness verify trace`
already catches half of it statically at L1b, by proving each engine is reachable from
`entry_point` through the import graph. D5 is the runtime half: the half that notices a live import
path behind a dead button.

**Anti-invention rule (hard):** no entry may introduce a behavior, limit, or field not
present in the five sources. Discovering "we should also test X" during derivation = a spec
gap → surface it at GATE 4 as a question (max 2 rule applies), do not silently add a test.

---

## Entry schema (rows under `## Test Surface` in the UC)

```markdown
## Test Surface
<!-- DERIVED — regenerate via a retrofit-surface order; do not hand-author rows here.
     Source must cite D1–D5. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | http | Attempt withdrawal exceeding balance via the API | Rejected `INSUFFICIENT_FUNDS`, balance unchanged | D1: INV-01 |
| TS-ERR-NOT_FOUND | http | Submit with non-existent aggregate id | 404 `NOT_FOUND` per Error Cases | D2 |
| TS-REQ-amount-missing | http | Omit `amount` from request | 400 validation error, no side effect | D3 + D2 (dedup) |
| TS-REQ-amount-boundary | http | `amount` = 0 / 0.01 / max / max+0.01 | Per contract bounds: edges accepted, outside rejected | D3 |
| TS-NOGO-02 | ui | Attempt export via direct URL (pitch no-go: "no export") | Blocked/absent — no file served | D4 |
| TS-REACH-UC-03 | ui | Drive UC-03's entry affordance (`checkout-submit`, per the wiring map) | UC-03's own exit is reached — `/checkout/success` renders | D5: UC-03 |
```

`Probe` must be executable against the running deliverable — no "verify code does X" static
phrasing.

### The `Oracle` column (evaluation-contract tag)

`Oracle` declares **how the evaluator verifies the row** — it is the dispatch key of the
evaluation contract. One verdict per row, single judge; the oracle changes only *how* evidence is
gathered, never *who* decides.

| `oracle` | When the deliverable is… | Evidence the evaluator cites |
|---|---|---|
| `ui` *(default)* | a running web app | the affordance asserted (test id / role), its state or `data-state`, console |
| `process` | a CLI / script | spawned exit code + stdout/stderr + crash check |
| `test` | a library / module | the project's own test suite (exit + failing-test names) |
| `snapshot` | a generator / pure refactor | unified diff vs a golden file (empty = PASS) |
| `http` | a service / API | response status + body assertion |

**Rules:**
- **Default is `ui`.** A row (or AC) that omits `Oracle` is treated as `ui` — pre-v2.9 specs and
  existing web pitches are unchanged.
- **Pick the oracle from where the behaviour is decided, not from what the user touches.** Two
  questions, in this order. *Which layer decides this?* — that comes from the source rule below.
  *Which runner reaches that layer for this deliverable?* — an API is `http`, a CLI is `process`,
  a library is `test`. Both halves matter: a CLI has no endpoint, so "route validation to `http`"
  is meaningless there, and the answer is `process`.

  | Source | Decided at | Oracle |
  |---|---|---|
  | D1 Invariants | domain / persistence | the deliverable's non-UI runner — never `ui`. The persistence assertion rides inside that row's evidence. |
  | D2 Error Cases | the API | the deliverable's non-UI runner, plus **one** `ui` row *only* when the UC's `## Steps` say the user must SEE the error |
  | D3 Missing field · type violation · boundary | API validation | the deliverable's non-UI runner, **always** |
  | D4 No-gos | both surfaces | `ui` for the affordance's absence **+** the non-UI runner for the endpoint bypass |
  | D5 Reachability | the app's own wiring | `ui` — the one arm whose whole point is the user-facing surface |

  You do not drive a screen to prove that `amount: -1` is rejected: you send the request. Asserting
  validation through the UI is slower, flakier, and tests the form rather than the rule — on the web
  as much as anywhere else. Where this does **not** reach: a use case whose point *is* visual — a
  control that must be disabled, an error the user must read. The UC's own `## Steps` say which, so
  it is a per-UC judgement, not a ratio worth inventing.
- **A D5 row asserts reachability, and stops there.** "Drive the affordance, then assert the
  outcome elsewhere" needs two runners under one verdict, and a row carries exactly one `Oracle`
  today — so a D5 row's Expect must be observable by the oracle that drove it (the UC's own exit
  renders / the next screen is reached). The outcome half is already covered by that UC's D1–D3
  rows at the layer that decides it. Never phrase a D5 Expect as a database or API assertion the
  driving oracle cannot see.
- **The expectation must be observable by that oracle.** A `process` row's Expect is phrased in
  exit code + stdout (e.g. *"exit ≠ 0, message names the file, no stack trace"*); a `test` row's is
  *"suite green, the named case passes"*. Never phrase a row so its only check is reading source.
- This is the half of the goal that makes **"build anything"** real: the same Test Surface
  discipline now derives evaluable rows for a CLI or a library, not only a browser app.

---

## Generation points

1. **Phase 4 (fresh run, v2.9+):** **D1–D4** derived per UC immediately after Error Cases are
   written, included in the GATE 4 review. **D5 cannot be derived here**, and this is a sequencing
   fact rather than an omission: its source is `wiring-map.md`, whose sole writer is
   `solution-architect` at GATE L1a.5 — which runs *after* the analyze operation, because wiring
   needs the use cases this operation produces. At Phase 4 the wiring map is guaranteed absent, so
   the D5 arm is skipped (see point 4), never emitted empty and never guessed at.
2. **retrofit-surface operation (retrofit, incremental reducer):** for pre-v2.9 specs.
   Frozen-zone discipline identical to the reconcile operation (the order's substrate enforces it):
   - READ-ONLY: domain-model, UC Steps/Input/Output/Invariants, ux-behavior, contracts/, tasks/
   - WRITE: append `## Test Surface` to each UC (after Error Cases; skip UCs that already
     have one unless `--force-surface`), log touched UCs in `run-state.human_edited_files`,
     set `run-state.test_surface: true`. Regenerate nothing else.
   - Source material missing (no Invariants, no contracts on lite) → derive from what
     exists; a UC whose five sources are all empty gets a one-line section:
     `_No derivable surface — sources empty. Exploratory coverage only (see qa-edge-hunter)._`
3. **reconcile operation:** when a new `[INV-NN]` is appended to a UC, also
   append its `TS-INV-NN` row (same append-only discipline, same `human_edited_files` log).
4. **D5, after GATE L1a.5 — a retrofit-surface order once the wiring map exists.** The same
   append-only discipline as point 2, reading `wiring-map.md` and appending one
   `TS-REACH-<UC>` row per use case whose `affordance` cell is populated. It is dispatched by the
   tech lead (or run standalone), not automatically by the round loop, so a run that never wires
   simply has no D5 rows — which is the skip, correctly, rather than a hole. A UC the wiring map
   does not name gets no D5 row: the map's own gap is caught at L1a.5 and by
   `harness verify trace`, and inventing a reachability row for it would be an anti-invention
   breach.

## Audit hooks (spec-lint)
- L2: every UC (v2.9 spec or `test_surface: true`) has `## Test Surface` with ≥1 row or the
  explicit empty-sources line.
- L3: every `[INV-NN]` has a matching `TS-INV-NN` row; every Error Case code has a `TS-ERR-*`
  row; every TS row cites D1–D5 in Source; the `Oracle` is one of the registry values (or omitted
  ⇒ `ui`), and is non-`ui` when the UC's deliverable has no browser (CLI/library/service).
- L3 (D5): when `wiring-map.md` exists, every UC whose `affordance` cell is populated has one
  `TS-REACH-<UC>` row. No wiring map ⇒ the check is skipped, not failed — an absent artifact
  disarms its own arm, it never manufactures a finding.
