# 05 — Verification & Quality Strategy

[← Back to index](README.md)

## How the harness proves itself

The plugin holds itself to the same standard it imposes on the code it generates: a claim of
correctness isn't accepted without a mechanical check behind it.

| Tier | What it proves | Cost |
|---|---|---|
| **0 — Structural**<br/>`tests/structural.mjs` | The plugin is well-formed and its own gates actually discriminate: every schema parses, every skill has a valid frontmatter contract, the GATE L2 hook warns on a partial board and stays silent on a green one (and never denies — the advisory downgrade is itself pinned, ADR-0001), the planted-bug fixture fails a buggy build and passes the correct one. 880+ checks (the suite asserts its own documented floor, so this number may only grow), split by ownership domain into `tests/structural/*.mjs` behind a thin `structural.mjs` runner that threads one shared context (`tests/lib/`). | Zero LLM calls, zero network — runs in CI on every push. |
| **1 — Functional fixtures**<br/>`examples/eval-planted-bug/` | A with-skill vs without-skill delta — e.g. a FizzBuzz build with a deliberately planted bug, dressed to look done (green self-suite, every AC box ticked), that a properly skeptical judge must still FAIL. | Deterministic half in CI today; the full transcript-graded half needs live Claude auth. |

The oracle registry behind Tier 0 (`oracles/`) is itself proven to
discriminate, not just to run: each of the `test`, `snapshot`, and `http` oracles is checked
against both a correct fixture and a negative control (`examples/lib-mathx`,
`examples/refactor-greet`, `examples/http-ping`) — a grader that rubber-stamps everything would
fail its own test.

---

## 5.1 — The measurement table

Every layer that can be measured, what its metric actually is, and — following the paper's Table
III, which never states a metric without its failure mode — **how each one is commonly misread.**
The misreading column is the load-bearing one: every number below has already been misread at least
once in this project's history, and two of the rows exist because of it.

| # | Layer | Metric | Today | Common misreading | Enforced by |
|---|---|---|---|---|---|
| 1 | **Structure** | checks passing, against a documented floor | **1380 passing, 0 failing** (floor 880+) | *Green structural means the guard works.* It means the file parses. An earlier audit found **26 enforcement points inert behind 610 green checks** — an unfired guard and an absent one look identical from outside, which is why every hook now records a decision (§3.2f). | `tests/structural.mjs` |
| 2 | **Build round** (product) | T0 green, seesaw, acceptance | acceptance **identical to no-harness** on uninterrupted runs | *Acceptance in one context window generalizes.* It says nothing about what happens across one. The harness's measured parity here is a real result and a narrow one. | `skills/tech-lead/scripts/t0-verify.mjs`, `spec-evaluator` |
| 3 | **Continuity / recovery** | gap closed across a handoff | **0/3**, and 0/3 again after the fix | *The hook fired, so it helped.* `session-rehydrate` fired 3/3 and closed 0/3 of the gap — it hands a **pointer** where state was needed. Firing is a precondition for helping, never evidence of it. | **no automated metric — gap** |
| 4 | **Run economics** | turns-to-first-write, $/session | **82–120 turns**, **$4.57–$10.36** (§3.2) | *More gates means more rigor.* Table III's workflow row: more agents can increase activity without value. Cost must be read next to the acceptance delta it bought, which at row 5 is zero. | **no automated metric — gap** |

Two rows have no instrument at all, and they are rows 3 and 4 — recovery and cost. That is not an
oversight in this table; it is the table's most useful output. **The two layers this harness has
never been able to measure automatically are the two where it currently performs worst.**

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

The mechanical half of this invariant used to live in the trigger-eval and Day-1/Day-2 baselines,
which enforced it in CI: an `unmeasured` baseline carrying results failed, a `measured` one lacking
method/model/timestamp failed, and a selftest score could not be laundered into a measured one.
**Those layers have been removed, and with them their enforcement.** What remains is the rule
itself, now upheld by review rather than by a check — which is a weaker guarantee, and is recorded
here as such rather than quietly dropped.

The finding that produced the rule stands regardless: a prior roadmap claimed an evidence layer
that was never committed, and its headline number was a proxy artifact that measured nothing.

### Where these rows are documented

| Rows | Home | Why there |
|---|---|---|
| 2 | [04 — Functional Design](04-functional-design.md) | The build round and its T0/seesaw verification are functional behaviour. |
| 3–4 | [03 — System Design §3.2](03-system-design.md) | Both come from the same benchmark passage on the continuity reflex, and both are properties of the runtime rather than of a skill. |

---
[← Functional Design](04-functional-design.md) · [Back to index](README.md) · [Next: Appendix →](06-appendix.md)
