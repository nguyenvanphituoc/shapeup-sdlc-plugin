# Evaluation Contract — generalizing the judge to "build anything"

> Spec for the abstraction that lets `spec-evaluator` produce evidence-cited verdicts for **any**
> deliverable, not only browser-driven UIs. Decided **up front** (PO, 2026-06-26). This is Stage G
> of `independent-audit-and-evolution-plan.md`, promoted ahead of the AEGIS loop.

## Problem

Today the evaluator's only oracle is **Playwright driving a running app** for `[ui]` criteria. A
CLI, a library, a data pipeline, or a pure refactor has no defined way to be judged — so the
harness's promise to "build anything with evaluation output and edge cases handled" silently
collapses to "build web UIs." `examples/todo-cli/eval-cli-contract.mjs` already demonstrates a
*second* oracle (process-level) works. This spec makes that pattern first-class.

## The contract

Every acceptance criterion declares **how it is verified** via an `oracle` tag. The evaluator
selects the matching probe, runs it, and records cited evidence. The single-judge invariant is
untouched — there is still exactly one verdict per criterion, evidence-or-FAIL.

```
criterion:
  id:        AC-3
  statement: "bad index fails gracefully"
  oracle:    process            # which evaluation mechanism verifies this
  probe:     { argv: ["done","99"], store: "[]" }
  expect:    { exit: "!=0", stdout: "/no item/", no_crash: true }
```

### Oracle types (the extensible registry)

| `oracle` | Deliverable | Probe = | Evidence cited | Implementation |
|----------|-------------|---------|----------------|----------------|
| `ui`      | running web app | Playwright action | DOM snapshot / screenshot / network | existing (Playwright CLI) |
| `process` | CLI / script    | spawn with argv + sandboxed env | exit code + stdout/stderr + crash check | `examples/todo-cli/eval-cli-contract.mjs` (reference) |
| `test`    | library / module| run the project's own test suite | suite exit + failing-test names | runner shells out to `npm test` / `pytest` / etc. |
| `snapshot`| pure refactor / generator output | diff actual vs golden | unified diff (empty = PASS) | golden-file comparator |
| `http`    | service / API   | request with body | status + response body assertion | curl/fetch probe |

New oracle types are added by registering a probe runner — mirroring how `spec-evaluator` already
loads pluggable *dimensions*. The contract interface is fixed; implementations grow.

### Invariant rules (carry over from the evaluator's design)
- **Absence of evidence = FAIL.** A criterion whose probe cannot run, or whose oracle is
  unspecified, FAILs — it is never silently passed.
- **Probe behavior, not code presence.** Every oracle observes runtime output, never greps source.
- **One verdict per criterion**, single judge. The contract changes *how* evidence is gathered, not
  *who* decides.
- **Edge cases are criteria, not extras.** The `process` oracle's value (see the todo-cli E1–E6
  rows) is that "handles a corrupted store without crashing" is an acceptance criterion with a
  declared probe — exactly the "edge cases handled" half of the goal.

## How this lands (incremental, doesn't break today's runs)
1. ✅ **DONE — Define the `oracle:` tag** in `ba-pitch-analyzer`'s Test Surface schema (default
   `ui` so existing pitches are unchanged). See the `Oracle` column + registry in
   `skills/ba-pitch-analyzer/references/test-surface.md`.
2. ✅ **DONE — Generalize `spec-evaluator`/`references/probing.md`** to dispatch on `oracle:` —
   `ui` keeps the current Playwright path; `process` runs the shared spawn-and-grade runner. See
   the "Oracle dispatch" section in `skills/spec-evaluator/references/probing.md`.
3. ✅ **DONE — Promote `eval-cli-contract.mjs`** to a shared probe runner the evaluator can call:
   `scripts/oracles/process-oracle.mjs` (declarative-contract driven; reference contract
   `examples/todo-cli/todo.contract.json`). The example now delegates to it; structural test #6
   exercises it (incl. a do-nothing negative control proving it discriminates).
4. **TODO — Add `test` + `snapshot` oracles** next (cover libraries and refactors — the two most
   common non-UI deliverables). Reuse the dispatch + runner pattern from steps 1–3.
5. **TODO — `http` last** (services), reusing the `process` sandbox pattern.

Steps 1–3 (landed 2026-06-26) make "build a CLI" a first-class, evaluable deliverable. Steps 4–5
close most of "anything." Each step is independently shippable and adds an oracle row to the table
above.

## Why up front (the PO's call)
Generalizing the contract *now* avoids baking a UI-only assumption deeper into the Test Surface and
the evaluator as more pitches accumulate. The cost is one schema field + a dispatch switch; the
payoff is that the harness's headline promise becomes true rather than aspirational.
