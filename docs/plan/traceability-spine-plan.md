# Traceability Spine + Wiring Reachability — Implementation Plan

> Companion to `docs/research/workflow-gap-redesign.md`; scoped against
> `docs/plan/conformance-audit-report.md`.
>
> **Scope discipline.** This plan does exactly two things, both mechanically checkable:
> 1. **Covers-closure** — no customer requirement can silently vanish in translation.
> 2. **Reachability** — no engine can ship orphaned from the running application.
>
> It deliberately does **not** try to fix hollow tests, semantic redefinition, or the
> scope/betting failures the audit also found — those need judgment and process gates, not a
> closure script, and are listed as explicit non-goals in §4. Over-reaching here would
> reproduce the exact disease the audit named (a green check that certifies nothing real).
>
> **Governing rule (from the research):** if a script can't check it, it's decoration. Every
> artifact below is either a checkable oracle or a durable anchor an oracle reads — nothing that
> merely *asserts* quality without proving it.

---

## 0. The tier decision (foundation — unchanged)

One question decides where every file lives:

> If I `rm -rf .shapeup-sdlc/` and a teammate clones fresh, must this file still exist and
> still mean the same thing? **Yes → SHARED** (`docs/shapeup-sdlc/`). **No, I can regenerate
> it from SHARED inputs → LOCAL** (`.shapeup-sdlc/`, gitignored run-trace).

"REQ-ids" is **two** artifacts that land on opposite sides:

| Artifact | Tier | Location | Rationale |
|---|---|---|---|
| **Requirement registry** — `REQ-id ↔ clause text ↔ status(covered\|CUT-PO-approved)` | **SHARED** | `docs/shapeup-sdlc/<slug>/requirements.md` | Input truth, not run-trace; teammates must audit coverage/cuts on a fresh clone; ids must be **stable** or every `covers:` link rots; CUT is PO governance (same class as a round-ledger Decision) |
| **Coverage report** — which REQ reaches which AC *this run* | **LOCAL** | `.shapeup-sdlc/<slug>/trace/report.json` | Recomputed each run by `trace-lint` from board + registry; references machine-local task ids that renumber |

**Direction check** — every new link flows the sanctioned LOCAL→SHARED way, identical to the
proven `use_case_refs` pattern:

```
LOCAL task    --use_case_refs-->  SHARED UC     (existing)
LOCAL AC      --covers-->         SHARED REQ    (new — same direction)
LOCAL finding --traces_to-->      SHARED REQ    (new — same direction)
```

Tier is **monotonic up the durability chain**: `REQ ⊇ UC ⊇ scope ⊇ task` (most-durable →
machine-local). The registry cannot sit below the use-cases that realize it.

**REQ-id stability rule** (makes `covers:` safe): REQ-ids behave like `scope_id` (stable
cross-machine key), never like `TASK-NNN` (renumbers). Assign `REQ-1…` once; new clause →
append; dropped clause → mark `CUT`, never delete (supersede-never-delete).

### Full tier map (spine additions in **bold**)

**SHARED — `docs/shapeup-sdlc/`:** `<slug>/spec/**`, `<slug>/scopes/*.json`,
`<slug>/hill/*.yml`, `<slug>/round-ledger.md`, `<slug>/scope-board.md`,
`metrics/<machine-id>.jsonl`, `knowledge-base/<skill>.md`, `pitch.md`,
**`<slug>/requirements.md`**, **`<slug>/wiring-map.json`**, **`<slug>/project-profile.json`**.

**LOCAL — `.shapeup-sdlc/`:** `<slug>/tasks/TASK-*.md`, `<slug>/orders|results|escalates/*.json`,
`<slug>/t0/verdicts/*.json`, `<slug>/seesaw/registry.json`, `<slug>/discovery/ledger.md`,
`<slug>/evaluation/**`, `<slug>/qa/**`, `<slug>/orient/**`, `active-scope`,
`safety-overrides.json`, `<slug>/run-snapshot.json`, **`<slug>/trace/report.json`**.

---

## 1. Covers-closure — no requirement vanishes silently

**Audit finding this closes:** the 🔴 dropped clauses — *"Players can side-step or lure enemies
into traps"* (§2.2, no AC anywhere) and *"low-res world textures"* (§2.3, absorbed into a
different section's cap and never built). Under this mechanism both go **red on day one**.

### 1.1 Requirement registry (SHARED)
- `docs/shapeup-sdlc/<slug>/requirements.md` — a committed table:
  `| REQ-id | clause (verbatim) | source | status | note |` where status ∈
  `covered | CUT (PO-approved)`.
- **Writer:** `ba-pitch-analyzer` via a new `coverage` operation (extracts atomic clauses from
  the REQ source — see Open Decision A). Extraction is judgment (LLM); ids are assigned once and
  frozen.
- **Non-destructive:** the original requirement source is never edited; the registry is a
  separate derived file.

### 1.2 `covers:` on acceptance criteria (LOCAL board → SHARED REQ)
- Board markdown grammar: `- [ ] <AC text> (covers: REQ-3, REQ-7)`.
- Schema: `TaskRef.acceptance_criteria` becomes **optionally** `{ text: string, covers?: string[] }`
  **while still accepting plain `string[]`** — additive, so pre-existing boards keep parsing
  (the ✦ non-regression invariant). `parseTaskFile()` in `compile-order.mjs:54` normalizes both
  forms; **`.text` stays byte-identical to the checkbox** so `ingest-result`'s substring tick-back
  (`AcResult.ac`) is untouched.

### 1.3 `traces_to:` on findings (optional, LOCAL findings → SHARED REQ)
- `CriterionVerdict` (spec-evaluator) and `Discovery` (qa-edge-hunter) gain `traces_to?: string[]`
  — a checkable REQ-id back-link so an edge case maps to a business requirement **by id**, not by
  grepping `ledger.md` (research Q3). Purely an anchoring/navigation aid; the lint only checks the
  id resolves in the registry.

### 1.4 `trace-lint.mjs` — the covers-closure oracle
- **Home:** `skills/tech-lead/scripts/trace-lint.mjs` (orchestrator-owned, like `compile-order`),
  reading SHARED `requirements.md` + the LOCAL board.
- **The single totality assertion:** every `REQ-id` with status `covered` must be named by
  **≥1 AC's `covers:`**. A REQ that is neither covered nor `CUT (PO-approved)` is **red**.
- **What it deliberately does NOT assert:** it does **not** count or grade tests. "REQ reaches a
  test" was cut — see §4.1: a green test that asserts nothing real would satisfy it, so the arm
  would be decoration by this plan's own rule.
- **Output:** `.shapeup-sdlc/<slug>/trace/report.json` (LOCAL, regenerated each run).
- **Staged severity (critical):** ships **advisory (warn-only)** first. It goes ~100% red on any
  board with no `covers:` yet — that's the intended demonstration, not a gate. It is promoted to a
  **red/blocking** gate only after the `coverage` op + `covers:` land, or it breaks every legacy
  run the instant it enters the pipeline.

**Honest boundary.** This catches a *deletion*, not a *contradiction*. The audit found side-step
was not only dropped but actively forbidden by INV-13; a token AC covering the REQ while INV-13
still forbids movement would pass `trace-lint`. Detecting that the covering AC contradicts (or
hollows out) the clause is a fidelity concern → §4.2, out of scope here.

---

## 2. Reachability — no engine ships orphaned from the running app

**Audit finding this closes:** the §4 asset pipeline — **631 lines, 26 passing tests, zero call
sites** in `main.js` — and the five scopes whose engines were never wired to a player. Under this
mechanism an unreachable UC engine is **red**.

- **Artifact:** `docs/shapeup-sdlc/<slug>/wiring-map.json` (SHARED). Per UC:
  `engine → wiring seam → entry-point call site → player-visible affordance`.
- **New worker `solution-architect`** at gate **L1a.5** (between `analyze` and `map-scopes`).
  Registration surface in `domain.schema.json` (all required — a worker is not just a path):
  - `WorkerName` enum += `solution-architect`
  - `Operation` enum += `wire`
  - `x-payload-by-worker` + `x-result-by-worker` rows
  - `WiringMap` `$def` (+ any nested record types)
  - `substrateFor()` template in `compile-order.mjs` for the new operation
  - **`x-writer`:** `solution-architect` writes `wiring-map.json` directly (precedent:
    `ScopeContract` is written directly by `scope-architect`, bypassing `ingest-result`).
- **Reachability oracle:** folded into `trace-lint.mjs` (§1.4) — one oracle owns both closure and
  reachability. A UC whose engine does not reach the profile's `entry_point` via the import graph
  → **red**.
- **Entry point is profile-gated** (§3): reachability reads `entry_point` from
  `project-profile.json` — it is not hardcoded (`main.js` for a game is not the seam for a
  web-service).
- **Diagram for free:** Mermaid auto-rendered from the wiring map (a *view* of a checked graph, so
  it cannot drift — same principle as mechanical hill derivation).

**Honest boundary.** Reachability catches a **dead module** (0 import sites), not a **dead
data-path**. `pressure-plate` was fully imported, reachable, and unit-tested — the level simply
authored zero of them; `rolling-boulder` likewise. A reachable-but-never-exercised branch is
invisible to a static wiring lint; confirming a mechanic actually runs is a human/runtime concern
→ §4.4.

**What it front-loads (enabling, not enforcing).** Declaring each UC's entry-point call site *at
L1a.5, before scope-architect* gives the slicer the integration seam up front — the missing input
behind the four identical `main.js` substrate-expansion escalations in round 1. This plan supplies
that input; it does **not** add the re-slice enforcement rule (§4.3).

---

## 3. Project Profile — supplies the reachability entry point

The profile exists in this plan for one load-bearing reason: **reachability needs to know the
entry point, and that is archetype-specific.**

- **Location: SHARED** `docs/shapeup-sdlc/<slug>/project-profile.json` (`.shapeup-sdlc/` is
  gitignored; a declaration that must survive clone cannot live there).
- **Fields:** `archetype ∈ {client-only-game | web-service | mobile | library | data-pipeline}`
  and `entry_point` (the seam `trace-lint` reachability resolves against). Validate `archetype`
  against the enum — a typo must fail, not silently disable the check.
- **Owner: `tech-lead` at L0**, not `compile-order.mjs` (which stays pipeline-blind).
- **Role-gating (skip SysRS/Auth/CI-CD) is explicitly out of scope of this plan** — those roles
  do not exist as workers, so gating them fixes no audit finding. The profile is introduced here
  only as the entry-point/archetype declaration reachability depends on.

---

## 4. Non-goals (what this plan does NOT fix, and where it belongs)

Naming these keeps the two oracles honest and prevents the plan from certifying more than it
proves. Each is a real audit finding that needs **judgment or a process gate**, not a closure
script.

- **4.1 Hollow green tests** (audit's Green Fixture Paradox — *"damages the party"* asserting a
  `<div>`'s `data-state`). Not addressed; this is why the "≥1 test" totality arm was cut. Belongs
  in a `spec-evaluator` **consequence-state dimension** (audit CA-1): a consequence-verb REQ must
  bind to a named persistent-state entity and its citation must assert that state before/after.
- **4.2 Semantic redefinition** (*"AABB"* → boolean lookup; *"illusory wall"* → remote door;
  *"custom shader"* → stock addon). A covering AC + green test satisfies closure while meaning
  something else. Belongs in the judge, not a lint.
- **4.3 Substrate/scope bottleneck enforcement** (main.js single-writer; *"declined by
  precedent"* ×4). This plan front-loads the seam (§2); the **re-slice-after-one-decline** rule
  (audit CA-2) is a separate scope-architect / advisor-protocol change.
- **4.4 Betting & human-verification** (`appetite: null` → built everything; fixture ≠ product;
  every player-visible defect found by a human after "T0-green"). Untouched. Belongs in a
  forced-appetite gate + a human-walk round exit criterion (audit CA-3).
- **4.5 Release-scribe** — deferred (PO control); no consumer for a deploy-surface branch yet.

---

## 5. Schema footprint (domain.schema.json — one place, per registry discipline)

- `TaskRef.acceptance_criteria` → accept `string | {text, covers?}` (additive).
- `CriterionVerdict.traces_to?: string[]`, `Discovery.traces_to?: string[]`.
- New `$def`: `RequirementClause` (REQ-id, clause, source, status, note) + `x-tier: SHARED`,
  `x-location`, `x-writer: ba-pitch-analyzer`.
- New `$def`: `WiringMap` + `x-writer: solution-architect`.
- New `$def`: `ProjectProfile` (archetype, entry_point) + `x-writer: tech-lead`.
- `WorkerName` += `solution-architect`; `Operation` += `coverage`, `wire`; payload/result tables
  updated; `x-erd` relationships for REQ↔AC and REQ↔finding.

---

## 6. Build order (staged so nothing breaks legacy runs)

1. **`trace-lint.mjs` standalone, read-only, advisory** — covers-closure only against a fixture
   project; prove it goes red on the dropped clauses. This is the research's "smallest step that
   proves the redesign."
2. **Resolve Open Decision A (REQ source) + tier the registry as SHARED with frozen ids.** Blocks
   everything downstream.
3. **Additive `covers` on AC** (keep `string[]` valid) + BA `coverage` op writing
   `requirements.md`; optional `traces_to` on findings.
4. **Profile in SHARED tier (archetype + entry_point)** → then `solution-architect` +
   `wiring-map.json` + reachability folded into `trace-lint`.
5. **Promote `trace-lint` to a red/blocking gate** once `covers:` is populated.

---

## 7. Open decision (needed before step 3)

- **A — REQ source of truth.** The flow today is `pitch.md → spec tree`; there is no
  `docs/req-*.md`. Where are atomic clauses extracted from — the pitch, a separate customer
  requirements doc, or the use-case bodies? This determines what `ba-pitch-analyzer coverage`
  reads and how stable the clause set is across re-runs.

> (Former Open Decision B — the REQ→test link — is removed: the "≥1 test" totality arm was cut in
> §1.4 / §4.1, so there is no test arm left to wire.)
