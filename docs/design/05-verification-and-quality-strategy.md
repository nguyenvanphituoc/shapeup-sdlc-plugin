# 05 — Verification & Quality Strategy

[← Back to index](README.md)

## How the harness proves itself

The plugin holds itself to the same standard it imposes on the code it generates: a claim of
correctness isn't accepted without a mechanical check behind it.

| Tier | What it proves | Cost |
|---|---|---|
| **0 — Structural**<br/>`tests/structural.mjs` | The plugin is well-formed and its own gates actually discriminate: every schema parses, every skill has a valid frontmatter contract, the GATE L2 hook warns on a partial board and stays silent on a green one (and never denies — the advisory downgrade is itself pinned, ADR-0001), the planted-bug fixture fails a buggy build and passes the correct one. 880+ checks (the suite asserts its own documented floor, so this number may only grow), split by ownership domain into `tests/structural/*.mjs` behind a thin `structural.mjs` runner that threads one shared context (`tests/lib/`). | Zero LLM calls, zero network — runs in CI on every push. |
| **1 — Trigger evals**<br/>`skills/<name>/evals/trigger-evals.json` | The right skill actually fires for a given request, with cross-skill hard negatives — 134 cases across 12 skills (67 positives / 67 negatives). The committed baseline's per-skill `results` still carry an `advisor-protocol` block from before that skill was removed, and are due a re-measurement. | Requires the plugin installed and a measured `--measure` run; an honesty invariant forbids a fabricated baseline number. |
| **2 — Functional fixtures**<br/>`examples/eval-planted-bug/` | A with-skill vs without-skill delta — e.g. a FizzBuzz build with a deliberately planted bug, dressed to look done (green self-suite, every AC box ticked), that a properly skeptical judge must still FAIL. | Deterministic half in CI today; the full transcript-graded half needs live Claude auth. |
| **3 — Day-1 loop & Day-2 register**<br/>`skills/<name>/evals/day1-rubric.json`, `evals/failure-classes.json` | Whether skill output **improves under revision** (a quality delta), and whether each tool **reduces the error class it was built for**. The two rungs of *Graph Engineering* §VI whose exit criteria are numbers rather than states. | Discrimination + tamper controls run free in CI; the quality number itself needs auth. |

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
| 1 | **Structure** | checks passing, against a documented floor | **1355 passing, 4 failing** (floor 880+) — the four are the sandbox-guard rows below | *Green structural means the guard works.* It means the file parses. An earlier audit found **26 enforcement points inert behind 610 green checks** — an unfired guard and an absent one look identical from outside, which is why every hook now records a decision (§3.2f). | `tests/structural.mjs` |
| 2 | **Activation** | FPR, TPR over cross-skill hard negatives | **FPR 0.0** (n=75, 2026-07-26); TPR diagnostic only. The run predates `advisor-protocol`'s removal — the dataset is now n=67 and the rate awaits re-measurement | *TPR measures description quality.* It also measures the model's activate-versus-ask disposition: 38 of 74 positives are deictic, and a model that names the right skill and asks for the missing input scores as a miss. Quote FPR; treat TPR as a lead. | structural §16, `tools/trigger-eval.mjs` |
| 3 | **Craft quality** (Day 1) | `delta = final − v1`, `improved_runs / n`, rounds-to-approve | **2/13 instrumented, both measured, both ceilinged**: `spec-evaluator` 1.0 (3/3, approves on v1); `task-executor` 1.0 (3/3, approves on v1). Neither has ever executed a revision round. | *A large delta means a good loop.* It can equally mean a bad first draft — the same delta is reached from 0.2→0.8 and 0.7→1.0, and only one of those is a skill worth shipping. Report `v1` alongside `delta`, and the spread alongside the mean. **And its sharper form, now measured twice:** *the delta measures craft.* `task-executor` first scored +0.267, and in all 3 runs that was the model discovering an undocumented convention of the fixture's own oracle. Stating the convention in the prompt collapsed the delta to **exactly zero** — confirming the whole gain had been convention discovery, and leaving a fixture with no headroom at all. A delta is only craft if every graded row is derivable from the spec the skill was given; and once that holds, a delta of 0 against a perfect v1 means the *fixture* is too easy, not that the skill is done. **And the escalation does not work:** a second, harder fixture (12 rows, batch selectors, a committed partial that scores 0.75) produced the identical 3/3 first-draft ceiling. Headroom is a property of task *and model* jointly — raising difficulty against a model that can do the task only raises the bar it clears first try. | structural §48, `tools/skill-loop.mjs` |
| 4 | **Tool efficacy** (Day 2) | baseline rate → current rate, with `reduction_basis` | **1 of 8** classes meet the exit criterion, on a *structural* basis | *The tool exists, so the class is reduced.* And its sharper form: *a structural reduction is a sampled one.* An error made impossible by construction and an error observed to become rarer are different claims; the schema forces the distinction to be written down. | structural §48(f), `evals/failure-classes.json` |
| 5 | **Build round** (product) | T0 green, seesaw, acceptance | acceptance **identical to no-harness** on uninterrupted runs | *Acceptance in one context window generalizes.* It says nothing about what happens across one. The harness's measured parity here is a real result and a narrow one. | `skills/tech-lead/scripts/t0-verify.mjs`, `spec-evaluator` |
| 6 | **Continuity / recovery** | gap closed across a handoff | **0/3**, and 0/3 again after the fix | *The hook fired, so it helped.* `session-rehydrate` fired 3/3 and closed 0/3 of the gap — it hands a **pointer** where state was needed. Firing is a precondition for helping, never evidence of it. | **no automated metric — gap** |
| 7 | **Run economics** | turns-to-first-write, $/session | **82–120 turns**, **$4.57–$10.36** (§3.2) | *More gates means more rigor.* Table III's workflow row: more agents can increase activity without value. Cost must be read next to the acceptance delta it bought, which at row 5 is zero. | **no automated metric — gap** |

Two rows have no instrument at all, and they are rows 6 and 7 — recovery and cost. That is not an
oversight in this table; it is the table's most useful output. **The two layers this harness has
never been able to measure automatically are the two where it currently performs worst.**

> **Row 1 is red, and the red is load-bearing.** Four `sandbox-guard` checks fail: the guard was
> re-pointed from the active *scope contract* to the active *order's* substrate (§3.2), and the
> suite still drives it through the scope-contract path — no `.shapeup/active-order` pointer, so
> the hook defers and permits writes it used to deny. Two readings are possible and they are not
> equivalent: either the tests are stale, or the guard no longer fences the lanes that never
> compile an order (the `--tiny` / prose loop and standalone `/build`, which write no
> `active-order` pointer). Until that is settled the correct move is to leave the rows red —
> rewriting the tests to match the new path would convert an open question into a green check,
> which is exactly the failure mode row 1's misreading column describes.

### The honesty invariant, applied to all of it

No number above may be written from anything but a run that produced it. Mechanically:

- An `unmeasured` baseline carrying results **fails CI** (structural §16, §48).
- A `measured` baseline lacking method, model and timestamp **fails CI** — an unlabeled rate is not
  a measurement, and trigger and quality rates are both model-dependent.
- A Day-2 `reduces` claim without two measured rates *and* a stated `reduction_basis` **fails CI**.
- A selftest score can never be laundered into a measured one: run records carry `mode`, and every
  stored draft carries `source` (`reference-*` vs `model`), both asserted by structural §48.
- A Day-1 measurement that leaves no committed account **fails CI**. `evals/runs/` is gitignored
  run-trace, so `evals/DAY1-REPORT.md` is the only surviving record of a paid run — §48(d7)
  regenerates it from the baseline and byte-compares, then asserts every measured skill+model and
  **every caveat** appears in it. A number published without its caveat is how the last one was
  misread, so the caveat travelling is checked, not trusted.
- An overridden measurement adapter **cannot mint a baseline** without an explicit opt-in flag —
  added after a stub adapter that merely concatenated two fixture files produced a green
  "exit criterion: MET". No structural check can tell a stub from a model, so the refusal lives at
  the only place that knows an override was in play.

This is audit finding **F1** encoded as machinery rather than remembered as a lesson: the prior
roadmap claimed an evidence layer that was never committed, and its headline number was a proxy
artifact that measured nothing.

### Where these rows are documented

| Rows | Home | Why there |
|---|---|---|
| 1–4 | **this file** | They are the harness proving itself — the subject of §05. |
| 5 | [04 — Functional Design](04-functional-design.md) | The build round and its T0/seesaw verification are functional behaviour. |
| 6–7 | [03 — System Design §3.2](03-system-design.md) | Both come from the same benchmark passage on the continuity reflex, and both are properties of the runtime rather than of a skill. |
| method & results | [`evals/DAY1-REPORT.md`](../../evals/DAY1-REPORT.md) | Derived from the committed baseline, never hand-written. Its Method paragraph states the deterministic scorer's known limit — anchor-shaped criteria generalize, phrase-shaped ones score a paraphrase as clean. |
| the work that closes rows 3, 4 and 6 | [`docs/internal/plan/ratchet-and-receipt-plan.md`](../internal/plan/ratchet-and-receipt-plan.md) | A plan holds intent; the report holds results. |

---
[← Functional Design](04-functional-design.md) · [Back to index](README.md) · [Next: Appendix →](06-appendix.md)
