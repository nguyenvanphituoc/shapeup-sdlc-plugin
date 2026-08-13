# 05 — Verification & Quality Strategy

[← Back to index](README.md)

## How the harness proves itself

The plugin holds itself to the same standard it imposes on the code it generates: a claim of
correctness isn't accepted without a mechanical check behind it.

| Tier | What it proves | Cost |
|---|---|---|
| **0 — Structural**<br/>`tests/structural.mjs` | The plugin is well-formed and its own gates actually discriminate: every schema parses, every skill has a valid frontmatter contract, the GATE L2 hook warns on a partial board and stays silent on a green one (and never denies — the advisory downgrade is itself pinned, ADR-0001), and each registered oracle passes its worked fixture while failing a negative control. 880+ checks (the suite asserts its own documented floor, so this number may only grow), split by ownership domain into `tests/structural/*.mjs` behind a thin `structural.mjs` runner that threads one shared context (`tests/lib/`). | Zero LLM calls, zero network — runs in CI on every push. |

**There is no second tier.** The judge-first functional fixtures were removed along with the rest
of the eval apparatus, and the gap is stated here rather than left as an absence: nothing now
proves the evaluator's skeptical posture — that it FAILs a build dressed to look done, with a green
self-suite and every AC box ticked. Tier 0 proves each *grader* discriminates against a negative
control. Nothing proves the *judge* does.

The oracle registry behind Tier 0 (`oracles/`) is itself proven to
discriminate, not just to run: each of the `test`, `snapshot`, and `http` oracles is checked
against both a correct fixture and a negative control (`examples/lib-mathx`,
`examples/refactor-greet`, `examples/http-ping`) — a grader that rubber-stamps everything would
fail its own test.

---

## 5.1 — The measurement table

Every layer that can be measured, what its metric actually is, and — because a metric stated
without its failure mode invites the misreading — **how each one is commonly misread.**
The misreading column is the load-bearing one: every metric below has already been misread at
least once in this project's history, and two of the rows exist because of it.

| # | Layer | Metric | Today | Common misreading | Enforced by |
|---|---|---|---|---|---|
| 1 | **Structure** | checks passing | **940 passing, 0 failing** (`npm test`, re-run 2026-08-13 with §53–55 added) | *Green structural means the guard works.* It means the file parses. An earlier audit found **26 enforcement points inert behind 610 green checks** — an unfired guard and an absent one look identical from outside, which is why every hook now records a decision (§3.2f). §55 is the same lesson again at the file level: a source file with a raw NUL is skipped by grep, so every content sweep silently reports on an unknown subset — and the first draft of that check, scoped to the shipped roots, could not see the NUL in its own source. | `tests/structural.mjs` |
| 2 | **Build round** (product) | T0 green, seesaw, acceptance | T0/seesaw verdicts are produced per run; **no acceptance-vs-baseline comparison is maintained** | *Acceptance in one context window generalizes.* It says nothing about what happens across one. | `skills/tech-lead/scripts/t0-verify.mjs`, `spec-evaluator` |
| 3 | **Continuity / recovery** | gap closed across a handoff | **instrument partial, unfed** — the dispatch stream is now keyed and ordered, so *re-opened vs resumed* is derivable from the operations a run emits after a rehydrate; nothing yet computes it | *The hook fired, so it helped.* `session-rehydrate` has been observed to fire every time and close none of the gap — it hands a **pointer** where state was needed. Firing is a precondition for helping, never evidence of it. | `export-run.mjs` (records), **no derived metric yet — gap** |
| 4 | **Run economics** | turns-to-first-write, $/session | **instrument exists, unfed** — `stats.mjs --economics` computes cost, wall clock, retries and turns-to-first-write from records the pipeline already writes. **No figure is reported here**, because no complete pipeline run has produced a dataset (§3.2g) | *More gates means more rigor.* More agents can increase activity without value. Cost must be read next to the acceptance delta it bought — and row 2 records no measured delta. | `skills/tech-lead/scripts/stats.mjs --economics` |

Rows 3 and 4 — recovery and cost — were the two with no instrument at all, and that was the table's
most useful output: **the two layers this harness had never been able to measure automatically were
also the two where its observed behavior was weakest.** Row 4 now has one, and the reason it took
so long is worth keeping: the data was never missing. Cost per agent call, wall clock, retries and
model were all being written to the run journal, and orders, results, trial rows and hook decisions
were all being written beside them. What was missing was a **key** — `order_id` identifies a
dispatch within a run and repeats across every run of the same slug, so no record could be
attributed to a run, and a question as basic as "what did this run cost" was unanswerable from data
that was entirely present (§3.2g).

Two things that have NOT changed, stated because a new instrument invites both misreadings:

- **Row 4 is unfed, and an unfed instrument is not a measurement.** The figures below the fold in
  `--economics` are zero-row projections until a full pipeline run produces a trace; the launcher
  defect that blocks one is open in `shapeup/knowledge-base/harness-defects.md`. This row says the
  instrument exists — it does not say anything has been measured.
- **Row 2 is untouched.** The export can hold per-run acceptance, but "versus baseline" needs a
  second arm and no baseline dataset exists. A read plane over one run's records cannot manufacture
  a comparison, and presenting one run's numbers as a delta would be exactly the misreading column
  of row 4.

> **How row 1 went green matters more than that it is green.** Four `sandbox-guard` checks were
> failing because the guard had been re-pointed from the active *scope contract* to the active
> *order's* substrate while the suite still drove it through the old path — no
> `.shapeup/active-order` pointer, so the hook deferred and permitted writes it used to deny. The
> tempting fix was to rewrite the assertions until they passed. That would have converted an open
> question into a green check, which is precisely this row's misreading column. The actual defect
> was real: the pointer had one author, so every lane that never reaches the workflow script was
> unfenced. `compile-order` now publishes it, and the checks were moved onto the WorkOrder path
> and extended to `frozen`/`append_only`, which had no enforcer at all.

### The honesty invariant, applied to all of it

No number above may be written from anything but a run that produced it — no exceptions, and no
number carried forward from a run whose inputs have since changed.

This rule once had a mechanical enforcer in CI, and that enforcement was removed along with the
measurement apparatus it policed. What remains is the rule itself, now upheld by review rather
than by a check — which is a weaker guarantee, and is recorded here as such rather than quietly
dropped.

The finding that produced the rule stands regardless: a roadmap once claimed an evidence layer
that was never committed, and its headline number was a proxy artifact that measured nothing.

### Where these rows are documented

| Rows | Home | Why there |
|---|---|---|
| 2 | [04 — Functional Design](04-functional-design.md) | The build round and its T0/seesaw verification are functional behaviour. |
| 3–4 | [03 — System Design §3.2](03-system-design.md) | Both are discussed alongside the continuity reflex, and both are properties of the runtime rather than of a skill. |
| 4 (instrument) | [03 — System Design §3.2g](03-system-design.md#32g--the-run-key-and-the-record-plane-v18) | The run key and the export are a storage/runtime concern, not a skill's. |

---
[← Functional Design](04-functional-design.md) · [Back to index](README.md) · [Next: Appendix →](06-appendix.md)
