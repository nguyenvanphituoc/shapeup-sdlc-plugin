# Test Surface — Derivation Rules (v2.9)

`## Test Surface` is a **derived section** on each UC. It is generated *mechanically* from
material that already exists in the spec — never invented. If a test idea cannot cite its
source row below, it does not belong here (it belongs to exploratory QA, post-build).

**Why it exists.** `spec-conformance` grades the AC that were written; it cannot expand
them. The Test Surface is the systematic expansion — boundary values, negative cases,
error-code coverage — done once at spec time so the evaluator (`test-surface-conformance`
dimension) can probe it. Division of labor settled at the QA meeting (2026-06-11):
derivable tests = BA + Evaluator (this file); exploratory edges = `/qa-edge-hunter`,
post-PASS, on the running app.

---

## Derivation table (exhaustive — these four sources, nothing else)

| # | Source (must exist in spec) | Mechanical rule → test entries |
|---|---|---|
| D1 | `## Invariants` `[INV-NN]` | One **violation-attempt** entry per invariant: construct the action that would break it, expect rejection/hold. `TS-INV-NN`. |
| D2 | `## Error Cases` table rows | One entry per error code: trigger the Condition, expect the Code + HTTP status. `TS-ERR-<CODE>`. |
| D3 | Contract Request shape (standard lens: `contracts/*.contract.md`; lite lens: UC `Input` interface) | Per required field: one **missing-field** entry + one **type-violation** entry. Per bounded field (length/range/enum): one **boundary** entry at each edge (min−1, min, max, max+1 where meaningful). `TS-REQ-<field>-<kind>`. |
| D4 | Pitch `No-gos` that touch this UC's actor/action | One **breach-probe** entry per relevant no-go: attempt the excluded behavior via the UC's surface, expect it blocked or absent (a hidden-but-reachable path = FAIL). `TS-NOGO-NN`. |

**Dedup rule:** if D2 already covers a D3 case (e.g. error table has `VALIDATION_400` for
missing field), emit ONE entry and cite both sources — never two entries for one probe.

**Anti-invention rule (hard):** no entry may introduce a behavior, limit, or field not
present in the four sources. Discovering "we should also test X" during derivation = a spec
gap → surface it at GATE 4 as a question (max 2 rule applies), do not silently add a test.

---

## Entry schema (rows under `## Test Surface` in the UC)

```markdown
## Test Surface
<!-- DERIVED — regenerate via `--surface-only`; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Probe | Expect | Source |
|---|---|---|---|
| TS-INV-01 | Attempt withdrawal exceeding balance via UC input | Rejected `INSUFFICIENT_FUNDS`, balance unchanged | D1: INV-01 |
| TS-ERR-NOT_FOUND | Submit with non-existent aggregate id | 404 `NOT_FOUND` per Error Cases | D2 |
| TS-REQ-amount-missing | Omit `amount` from request | 400 validation error, no side effect | D3 + D2 (dedup) |
| TS-REQ-amount-boundary | `amount` = 0 / 0.01 / max / max+0.01 | Per contract bounds: edges accepted, outside rejected | D3 |
| TS-NOGO-02 | Attempt export via direct URL (pitch no-go: "no export") | Blocked/absent — no file served | D4 |
```

`Probe` must be executable against the running app or API (the evaluator's `cmd`/`ui`/`data`
handlers) — no "verify code does X" static phrasing.

---

## Generation points

1. **Phase 4 (fresh run, v2.9+):** derived per UC immediately after Error Cases are
   written, included in the GATE 4 review.
2. **`--surface-only <spec-dir>` (retrofit, incremental reducer):** for pre-v2.9 specs.
   Frozen-zone discipline identical to `--tasks-only`:
   - READ-ONLY: domain-model, UC Steps/Input/Output/Invariants, ux-behavior, contracts/, tasks/
   - WRITE: append `## Test Surface` to each UC (after Error Cases; skip UCs that already
     have one unless `--force-surface`), log touched UCs in `run-state.human_edited_files`,
     set `run-state.test_surface: true`. Regenerate nothing else.
   - Source material missing (no Invariants, no contracts on lite) → derive from what
     exists; a UC whose four sources are all empty gets a one-line section:
     `_No derivable surface — sources empty. Exploratory coverage only (see qa-edge-hunter)._`
3. **`--tasks-only --from-discovered`:** when a new `[INV-NN]` is appended to a UC, also
   append its `TS-INV-NN` row (same append-only discipline, same `human_edited_files` log).

## Audit hooks (Phase 7a)
- L2: every UC (v2.9 spec or `test_surface: true`) has `## Test Surface` with ≥1 row or the
  explicit empty-sources line.
- L3: every `[INV-NN]` has a matching `TS-INV-NN` row; every Error Case code has a `TS-ERR-*`
  row; every TS row cites D1–D4 in Source.
