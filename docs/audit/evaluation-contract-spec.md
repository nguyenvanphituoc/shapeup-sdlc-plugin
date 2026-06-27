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
| `ui`      | running web app | Playwright action | DOM snapshot / screenshot / network | in-skill (Playwright CLI) |
| `process` | CLI / script    | spawn with argv + sandboxed env | exit code + stdout/stderr + crash check | `scripts/oracles/process-oracle.mjs` ✅ |
| `test`    | library / module| run the project's own test suite | suite exit + failing-test names | `scripts/oracles/test-oracle.mjs` ✅ |
| `snapshot`| pure refactor / generator output | diff actual vs golden | unified diff (empty = PASS) | `scripts/oracles/snapshot-oracle.mjs` ✅ |
| `http`    | service / API   | start server + request | status + response body assertion | `scripts/oracles/http-oracle.mjs` ✅ |

New oracle types are added by registering a probe runner in `scripts/oracles/index.mjs` — mirroring
how `spec-evaluator` already loads pluggable *dimensions*. The contract interface is fixed
(`{ fails, results }`, each result `{ id, desc, pass, evidence }`); implementations grow.

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
   `ui` keeps the current Playwright path; every non-`ui` oracle is a **self-contained
   spawn-and-grade procedure** the evaluator performs with the Bash tool. See the "Oracle dispatch"
   section in `skills/spec-evaluator/references/probing.md`.
3. ✅ **DONE — Reference probe runner** `scripts/oracles/process-oracle.mjs` (declarative-contract
   driven; reference contract `examples/todo-cli/todo.contract.json`), exercised by structural test
   #6 (incl. a do-nothing negative control proving it discriminates). **NB (see Runtime model
   below):** this runner — and `examples/` — are repo-only **dev/CI reference implementations**,
   not shipped plugin assets and not invoked by the installed skill; they keep the documented
   `probing.md` grammar honest.
4. ✅ **DONE — Add `test` + `snapshot` oracles** (cover libraries and refactors — the two most
   common non-UI deliverables). `scripts/oracles/test-oracle.mjs` runs the deliverable's own suite
   and grades exit + parsed failing-test names (a suite that runs zero tests FAILs, per probing.md
   TDD-1); `scripts/oracles/snapshot-oracle.mjs` diffs observed stdout against a committed golden
   (empty diff = PASS). Worked fixtures: `examples/lib-mathx/` (green suite + a red-suite negative
   control) and `examples/refactor-greet/` (golden + a do-nothing negative control). Both are
   exercised by structural tests #9 and #10, each with a negative control proving the grader
   discriminates.
5. ✅ **DONE — `http` oracle** (services). `scripts/oracles/http-oracle.mjs` picks a free port,
   spawns the server with `$PORT`, polls until reachable (an unreachable service FAILs every
   criterion — absence of evidence), then asserts status + body/JSON per request and tears the
   server down. Worked fixture `examples/http-ping/` (working server + a reachable-but-broken 500
   server as the negative control); structural test #11.

Steps 1–3 (2026-06-26) made "build a CLI" evaluable; steps 4–5 (2026-06-27) close libraries,
refactors, and services — "build anything" with a declared, evidence-cited oracle for every non-UI
deliverable.

## Runtime model — what ships vs. what is dev/CI (install-safety, F9)

The **only** thing that ships and runs at the user's site is the prose in
`skills/spec-evaluator/references/probing.md`: a Claude plugin install copies recognized component
dirs (`skills/`, `commands/`, `hooks/`, …) to the plugin cache and **blocks path traversal outside
the plugin**; the scaffolding installer copies only `skills/`; `distribute.js` inlines SKILL.md +
`references/*.md` into one prompt for Cursor/Antigravity. So `scripts/`, `examples/`, and
`docs/` are **absent at runtime**. The evaluator (an LLM with Bash) therefore executes each oracle
as the self-contained procedure documented in `probing.md` — it does **not** call a bundled script.

`scripts/oracles/*.mjs` + `examples/*` are deliberately **repo-only dev/CI assets**: executable
reference implementations of the exact `probing.md` grammar, with negative-control tests
(structural #6, #8–#11) that keep the documented procedure honest and discriminating. They never
need to ship. Structural test **#12** enforces install-safety: a shipped skill file may not
reference a repo-only path (the regression guard for F9 — see
`independent-audit-and-evolution-plan.md`).

## Why up front (the PO's call)
Generalizing the contract *now* avoids baking a UI-only assumption deeper into the Test Surface and
the evaluator as more pitches accumulate. The cost is one schema field + a dispatch switch; the
payoff is that the harness's headline promise becomes true rather than aspirational.
