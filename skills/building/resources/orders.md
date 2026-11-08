# Orders — what you write before every dispatch

An order is a JSON file at `.shapeup/<slug>/orders/<stem>.json`. It is checked against the order schema when the
dispatch leaves, and the write fence reads its `substrate` for as long as it has no result. Write it by copying the
template for the operation and filling the bracketed fields from the files named in the last column.

## The envelope — the same for every operation

```json
{
  "schema_version": 1,
  "order_id": "<slug>/<stem>",
  "kernel": "<absolute path of this plugin copy's kernel entry point>",
  "run_id": "<run_id from .shapeup/<slug>/receipt.json>",
  "compiled_at": "<any ISO time; `order open` replaces it with the real one>",
  "worker": "<orient | task-executor | spec-evaluator | qa-edge-hunter | building>",
  "mode": "orchestrated",
  "operation": "<orient | execute | fix | evaluate | hunt | plan>",
  "interaction": { "pause_gates": false },
  "substrate": { },
  "payload": { }
}
```

`compiled_at` is not yours to get right: `order open` overwrites it with the clock, because the fence compares it with the result's age and a time typed by hand that runs ahead of the clock keeps the order live after its worker returned. `kernel` is the absolute path, never a variable: a worker runs it as a command, and a command that spells it through a
variable is refused in a headless session. A `plan` order takes `"worker": "building"` and `"mode": "standalone"` —
no sub-agent answers it, it only opens the fence.

The stem is the file name without `.json`: `orient`, `plan-<step>`, `<scope>-r<R>-a<A>`, `evaluate-r<R>`, `hunt`. The
order's own `order_id` is `<slug>/<stem>`, and the result is written to `results/<stem>.json`. **An order with no result is
live**, and a live order keeps its substrate in force — so a worker that never answers stays fenced until the run is
re-opened with `--force` or the result lands.

## Substrate per operation

`allowed` is what the worker may write; `shared` is the sanctioned escape for a path two scopes declare;
`frozen` outranks everything; `own` is the worker's own result and bookkeeping, and only the dispatch that took the order may write it.

| Operation | `allowed` | `frozen` | `own` |
|---|---|---|---|
| `orient` | `.shapeup/<slug>/orient/**` | `shapeup/<slug>/spec/**` | `.shapeup/<slug>/results/orient.json` |
| `execute` / `fix` | the scope contract's `allowed_file_substrate` plus `.shapeup/<slug>/spikes/**`; `shared` = its `shared_substrate` | `.shapeup/<slug>/**` | `results/<stem>.json`, `.shapeup/<slug>/tasks/TASK-*.md`, `.shapeup/<slug>/discovery/**`, `.shapeup/<slug>/spikes/**` |
| `evaluate` | none | `shapeup/<slug>/spec/**`, `.shapeup/<slug>/**` | `.shapeup/<slug>/evaluation/**`, `results/evaluate-r<R>.json` |
| `hunt` | none | `shapeup/<slug>/spec/**`, `.shapeup/<slug>/**` | `.shapeup/<slug>/qa/**`, `results/hunt.json` |
| `plan` (`requirements`) | `shapeup/<slug>/requirements.md` | the spec's domain model, use-case Steps, contracts, UX file; the run's intake, orders, results, receipts and T0 verdicts | — |
| `plan` (`spec`) | `shapeup/<slug>/spec/**`, `.shapeup/<slug>/tasks/**`, `.shapeup/<slug>/working/**` | the intake, project profile, orders, results, receipts, T0 verdicts | — |
| `plan` (`wire`) | `shapeup/<slug>/wiring-map.md` | as `requirements`, plus `shapeup/<slug>/scopes/**` | — |
| `plan` (`scopes`) | `shapeup/<slug>/scopes/*.md`, `shapeup/<slug>/scope-board.md` | as `requirements`, plus `.shapeup/<slug>/tasks/**` | — |

A needed file outside the table is the PO's decision, not yours: widen a scope's substrate by amending its contract, then write the order again.
Do not widen an order to make a worker's escalation go away.

## Payload per operation

Pass a path wherever a path will do; a worker reads files, and an embedded copy goes stale.

| Operation | Payload | Where each field comes from |
|---|---|---|
| `orient` | `pitch`, `feature`, `spec_folder`, `kb_rules_path` | the intake path; the slug; the launch record's spec folder; `shapeup/knowledge-base/orient.md` if it exists |
| `execute` | `scope_contract` (path of `<spec>scopes/<id>.md`), `tasks` (`[{id, body_path}]` for the scope's tasks), `verify.test_cmd`, `kb_rules_path`, `round` | the scope file; the board's tasks whose `scope_id` is the scope; the contract's `e2e_verification_fixtures`; `shapeup/knowledge-base/task-executor.md` |
| `fix` | as `execute`, plus `bugs`, `digested_errors`, `trial_history` | the last verdict's FAIL criteria addressed to this scope's files; the failing lines of the last T0 verdict; the scope's rows in `t0/trials.jsonl`, oldest first, at most 8 |
| `evaluate` | `spec_folder`, `feature`, `dimensions`, `run_cmd`, `t0_artifacts`, `round` | the spec path; the slug; the dimensions the PO named at L0, else the set the spec calls for (a Test Surface turns on test-surface-conformance, Invariants turn on completeness); the project profile's run command; the paths of each scope's latest `t0/verdicts/*.json` for the round |
| `hunt` | `feature`, `spec_folder`, `eval_report`, `app_url`, `round`, `kb_rules_path` | the slug; the spec path; the PASS evaluation report; the running app, or `null` for a deliverable that is not served |
| `plan` | `step`, `feature`, `spec_folder`, `kb_rules_paths` | the substep; the slug; the spec path; the knowledge-base files `resources/guidance.md` lists for planning |

A scope that did not go green in the round has its test-surface rows graded FAIL: name it in an `evaluate` order's `scopes_without_t0` rather than leaving the judge to find the gap.
A criterion the last verdict graded FAIL reaches the next round whether or not the judge filed a bug for it — a FAIL verdict with nothing to fix is how a run stalls.
