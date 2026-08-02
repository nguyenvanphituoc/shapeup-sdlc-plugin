# State Model — who writes what

Reference for the orchestrator. Moved out of `SKILL.md` so the front door stays a runbook: the
first screen a model reads decides whether it acts or describes, and every line of architecture
prose ahead of the first tool call is a line it can summarise instead of execute.

---

## State ownership (D6, mechanically closed in v1.0)

Workers are stateless; the orchestrator layer is the **sole writer of ALL run-state**. Every
worker receives a structured **WorkOrder** envelope (`.shapeup/<slug>/orders/`, compiled by
`compile-order.mjs`) and returns a **WorkResult** envelope (`results/`); the deterministic
`ingest-result.mjs` performs every shared-state write — board status, AC ticks, unblock
propagation, discovery-ledger appends, verdict bookkeeping.

No worker writes `run-state.md`, `tasks/_index.md`, or the ledger. Everything a worker used to
write into shared files, it now returns as data.

The tech lead owns `harness-run.md` — rounds, gate decisions, Hill positions, verdicts,
`discovered_rounds`, config, language record. The board (`tasks/_index.md`, LOCAL root — v3.2) is
**execution truth**, maintained exclusively through ingest.

**The run receipt (v1.4).** `scripts/init-run.mjs` opens the run and writes
`.shapeup/<slug>/receipt.json` plus `.shapeup/active-scope` before any gate. The
receipt is the mechanical fact that a run *started* — distinct from every other artifact here,
which records what a run *did*. That distinction is load-bearing: the guards that check a run's
progress (`anti-rationalization.mjs`) are all scoped to an active run, so before the receipt
existed, a run that never started was invisible to every one of them. `hooks/gate-zerowork.mjs`
reads only the receipt's presence, which is why it can see a total failure that leaves no other
trace. See `references/gates.md` — GATE L0.1.

## Central domain registry

Every record type and payload field that crosses a skill boundary is defined exactly once in
`skills/tech-lead/schemas/domain.schema.json` — the envelope schemas (`work-order.schema.json`,
`work-result.schema.json`) only `$ref` it. The registry annotates each entity's tier
(SHARED/LOCAL), location, sole writer, and readers, carries the machine-readable ERD (`x-erd`),
and maps which payload fields each worker may rely on (`x-payload-by-worker`).

A new cross-boundary field is added THERE first (structural test #24 enforces the map's
consistency); a skill inventing its own undeclared field is a defect — the orchestrator, not the
worker, owns the vocabulary.

## Two ledgers, split by promotion timing

(Addendum §F.3 — only when scope contracts exist.)

`harness-run.md` stays the LOCAL (`.shapeup/<slug>/`, gitignored) full run trace: it can be
rebuilt or lost without consequence.

A second, committed `round-ledger.md` (`shapeup/<slug>/round-ledger.md`, SHARED,
Tier A) holds only what must survive a crash or a `.shapeup/` wipe:

- the resolved model/budget matrix (L0.8/L0.9),
- the **Decisions** table — every gate crossing and every advisor-protocol ESCALATE answer,
  promoted the instant it is given, never batched to round close.

Gate crossings resolved from a **gate answer set** (`scripts/gate-answers.mjs`) are written here
with their source — `preset:ci`, `file:.shapeup/gate-answers.json` — and the set's
`authorized_by`. A headless run that ships must always be able to name the human behind its
sign-off; that name lives here and nowhere else.

The tech lead is the sole writer of both. `round-ledger.md` is simply the subset that must never
live only in a session or a gitignored file. No scope contracts → `round-ledger.md` is not
written, and `harness-run.md`'s "Decisions log" is the only ledger, exactly as in v0.2.6.
