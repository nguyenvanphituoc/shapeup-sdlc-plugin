---
type: harness-run
feature: todo-cli
spec_folder: shapeup/todo-cli/spec/
lens: standard
eval_dimensions: [spec-conformance, test-surface-conformance]
max_rounds: 3
attempt_budget: 5
wall_clock_budget_s: ~
auto_level: interactive
gate_answers: .shapeup/todo-cli/gate-answers.json
lane: full
stack: Python 3 stdlib-only (3.10.16 on this machine) — json + argparse, no dependencies, no install step. Entry point bin/todo; use-case engines under todo/.
run_cmd: TODO_STORE=<throwaway.json> python3 bin/todo <subcommand> [args]
app_url: ~
status: shipped
final_verdict: pass
rounds_used: 3
discovered_rounds: 0
deploy: not performed — no deploy target in scope (local CLI)
started_at: 2026-08-16T08:47:25.530Z
closed_at: 2026-08-16T11:35:00.000Z
---

# Harness run — todo-cli

Opened by ``harness init run`` (GATE L0.1). The tech lead is the sole writer from here on.

## Rounds

| Phase | Round | Result | Duration | Notes |
|-------|-------|--------|----------|-------|
| Init  | —     | run opened | — | intake recorded, receipt written |
| BUILD | 1     | dispatched nothing | — | both scopes failed `compile` schema validation (HD-002); 0 attempts used |
| BUILD | 1     | both scopes green | — | after HD-003 fix: scope-cli-core 7/7 `kept` (+6), scope-integration-test 1/1, 10 integration tests OK |
| EVAL  | 1     | PASS | — | 31/31 criteria (16 spec-conformance + 15 test-surface), 0 bugs, 0 refuted |
| BUILD+EVAL | 2 | PASS (redundant) | — | re-ran an already-green board — fast-forward defect (HD-004 sibling); consumed the outer budget |
| QA    | —     | 10 findings | — | dispatched by hand after HD-004 skipped it silently; 4 TL-reproduced |
| BUILD | 3     | scope-cli-core 11/11 | — | 4 promoted QA findings fixed; fixtures 8–11 added as gates, each verified failing pre-fix |
| EVAL  | 3     | PASS | — | 31/31 re-probed against the post-fix binary; no regression on TS-INV-05 or the corrupted-store contract |

## Decisions log

| Gate | Decision | Source | Note |
|------|----------|--------|------|
| L0 | proceed | file:.shapeup/todo-cli/gate-answers.json | PO answered the L0 collect-list live: stack=Python 3 stdlib-only (entry bin/todo), eval dims=[spec-conformance, test-surface-conformance], proceed into Building without an upstream /shapeup pass. Recorded 2026-08-16. |
| L1a | proceed | file:.shapeup/todo-cli/gate-answers.json | PO accepted the orient read: store-persistence was the right area to spike, Rank 0 accepted, no further spike required. Two product decisions answered at the same gate (see "Intake amended at L1a" below). |
| L1a.5 | proceed | file:.shapeup/todo-cli/gate-answers.json | Wiring map accepted (4/4 UCs have a full engine → seam → entry-point → affordance chain). One review finding closed before slicing — see "Test Surface gap closed at L1a.5" below. |
| L1b | proceed | file:.shapeup/todo-cli/gate-answers.json | Board accepted: 2 scopes, disjointness 0 red/0 warn, no SPIKE blockers. One correction ordered before BUILD — see "Wiring map realigned at L1b" below. |
| L2 | proceed | file:.shapeup/todo-cli/gate-answers.json | Both scopes T0-green on the verifier's own evidence. Reported round-1 failure was HD-003, not a build defect — see "GATE L2" below. |
| L3 | stop | file:.shapeup/todo-cli/gate-answers.json | Round 1 PASS accepted: 31/31 criteria, 0 bugs, 0 refuted, T0 cited by sha256. Loop closed with round 2 of 2 unspent. |
| QA | run | file:.shapeup/todo-cli/gate-answers.json | Post-PASS edge hunt requested; one open observation (empty vs unset `$TODO_STORE`) handed to it. **It did not run** — HD-004 discarded the decision; dispatched by hand afterwards. |
| H | accept-cut-list | file:.shapeup/todo-cli/gate-answers.json | 4 of 10 QA findings promoted to must-fix and built in round 3 (T0 11/11, EVAL r3 PASS). Remaining 6 QA + atomic-write note accepted as cut, carried to the ledger as raw ideas. |
| L4 | ship | file:.shapeup/todo-cli/gate-answers.json | PO signed off. BUILT & VERIFIED; deploy not performed. 6 QA nice-to-haves + 3 hygiene items carried; HD-001..HD-004 filed for the Betting Table. |

## QA and the fix round (rounds 2–3)

**QA was requested and silently skipped.** The PO answered `run`; `harness gate --resolve QA`
returned `run`, exit 0; `shapeup-run.js` compared that decision — which arrives as a model-written
sentence, not a token — against the string `"run"`, got false, and moved on. No log line, no
warning. Filed as **HD-004**. It surfaced only because `scope-hammer` states its own inputs:
*"no `hunt-report.md` exists on disk anywhere — H0.2 is empty by construction."* A census that had
reported "0 QA findings" as a clean result would have buried it.

A second, independent block sat behind it: the QA payload passes `app_url: rs.app_url`, which is
`null` for a CLI, and the order schema requires a string. **The QA phase is unreachable for any
non-UI deliverable** — worth weighing against this intake's opening line, that the point of the
exercise was "a non-UI deliverable (no browser, no Playwright)".

**The hunt, once dispatched by hand, found 10 issues** across 13 charters, every one with a repro.
The tech lead independently reproduced QA-001, QA-002, QA-004 and QA-009 before letting the census
see them. `scope-hammer` then re-ran against the real output and split the list: four collide with
explicit pitch language ("a CLI that crashes on a typo is worse than no CLI"; `$TODO_STORE` as "a
real constraint, not a detail") and were promoted; six stayed nice-to-have.

**Round 3 fixed the four**, and the fixtures came first: QA-001/004/005/010 were encoded as e2e
fixtures 8–11 on `scope-cli-core` and **each was verified failing before the fix**, so the round was
gated on mechanical evidence rather than on a report. `bugs` was deliberately not injected — the
schema says it is written by `harness compile` from the prior EVAL result and "never by a caller",
and EVAL had passed, so the scope contract's fixtures carried the work instead. Final: T0 11/11
`kept`, EVAL round 3 PASS 31/31 re-probed against the post-fix binary, integration suite 10/10.

**One product decision the tech lead made rather than escalating.** QA-004 needed semantics for a
set-but-empty `$TODO_STORE`; "verbatim" is unusable, since an empty path cannot be opened. Chosen:
a clean `error: $TODO_STORE is set but empty`, exit 1, nothing written — because an empty value is
almost always a scripting bug (`TODO_STORE=$UNSET_VAR`) and silently writing to the real store is
the precise hazard the pitch invokes `$TODO_STORE` to prevent. The *unset* branch was left
untouched and `TS-INV-05` re-verified. Surfaced at L4 for the PO to overturn.

**Consequence to carry:** `domain-model.md`'s `StorePath` invariant reads "no third path branch",
and this fix adds a third outcome. The evaluator caught it and classified it non-blocking (no
graded criterion fails, the behaviour is strictly safer). The spec core is frozen at ship time, so
it was not edited — it is a carry-forward, and the same drift class as the wiring map at L1b.

**A note on the QA hunter's own disclosure.** Its first probe omitted `TODO_STORE=` and wrote one
throwaway item to the invoking user's real `~/.todo.json`. It caught this itself, confirmed the
file had not existed before, removed it, and reported the lapse in `deviations[]`; the tech lead
verified `~/.todo.json` is absent. Worth recording rather than burying: the exact hazard the pitch
names — "can only be exercised by writing to the developer's own todo list" — landed on the agent
hunting for it, through the very fallback branch `INV-05` asserts.

## GATE L2 — the reported failure was the harness, not the build (HD-003)

The round-1 L2 block read `green_scopes: ["scope-integration-test"]`,
`hammer_proposals: ["scope-cli-core"]`. **That inversion was the tell**: the integration scope is
`build_order: 6` and depends on every command existing, so it cannot legitimately pass while
`build_order: 1` fails.

**The implementation was correct throughout.** Driven by hand, every command produced exactly the
specified stdout and exit code. Extracted with `JSON.parse` and run in a shell, all 7 fixtures
passed. T0 nonetheless scored `fixtures_passed: 1/7` on every trial, and the stagnation term ended
the scope after 4 attempts.

**Cause: `contract.mjs`'s `coerce()` strips quotes without unescaping** (`HD-003`), so each fixture
reached `bash` with literal backslashes and died with exit 2. Two things made it read as a flaky
build rather than a broken reader: fixture #1 "passed" because its assertions are too weak to
notice a corrupted `$TODO_STORE`, and `scope-integration-test`'s fixture
(`python3 -m unittest discover …`) contains only single quotes, so the defect never touched it.

**Resolution.** The 7 fixtures were re-emitted with inner quotes unescaped — the form `coerce()`
reads correctly — generated mechanically from the `JSON.parse` ground truth rather than retyped by
hand, verified in the scratchpad, installed, and re-verified in place (7/7 through `contract.mjs`).
The working tree was backed up first, because a red T0 verdict restores the last kept snapshot.

**The verdict was then produced by the verifier, not asserted by the tech lead** — `harness verify
t0` returned `overall: green, 7/7, status: kept, delta: +6 fixtures`, and `reduce graph` derives
`green_scopes_by_round: {"1": [scope-cli-core, scope-integration-test]}` from the artifacts. The
"hill phase is mechanical, never self-reported" invariant is intact.

**Housekeeping.** Three orphan orders (`scope-cli-core-r1-a2/a3/a4`) had no results and never
would — abandoned attempts. They were archived so `pending_orders` is honestly empty before the
relaunch. Also noted, not chased: `reduce graph` still reports the run as
`todo-cli-20260816T035435Z-5c7fd7be`, the pre-`--force` receipt, because the graph's Run node was
written before the re-open and is never refreshed. Cosmetic here, but `SHIP S.7` exports are keyed
by `run_id`, so it is worth a look before anyone trusts those exports.

**Observation for QA, not a defect.** `store.py` resolves with `if env_val:`, so an *empty*
`TODO_STORE` falls back to `~/.todo.json`. `domain-model#StorePath` says "`$TODO_STORE` verbatim
when set", and an empty string is set. No AC covers it and the behaviour is arguably better;
flagged for the edge hunt rather than treated as a violation.

## BUILD round 1 — first launch dispatched nothing (contract encoding defect)

The workflow returned `{"status":"gate_h","breaker":"inner","green_scopes":[]}`. That was **not**
a circuit-breaker trip. Both scope records read `green:false, attempts_used:0, breaker:"none"`:
`harness compile --scope … --round 1 --attempt 1` refused to write either order, so no
`task-executor` was dispatched and the per-scope budget of 5 attempts was never touched. No source
file was created — no `bin/`, no `todo/`, no `tests/`.

**Cause, reproduced directly before acting on the workers' account of it:**

```
✗ $.payload.scope_contract.affordance_manifest[0..6].required_states: expected array, got string

coerce("success, error")   → "success, error"      (string)
coerce("[success, error]") → ["success","error"]   (array)
```

`scope-architect` wrote the Affordances tables' `required_states` cells as unbracketed prose.
`contract.mjs` only yields a list from a bracketed value, so all 9 rows across the two contracts
stayed strings and failed order-schema validation. The same skill applied the rule correctly in
frontmatter (`allowed_file_substrate` parses as an array), so this was an inconsistency within one
writer.

**The more serious half:** `harness verify spec` reported `0 red / 0 warn` on these same contracts
at GATE L1b — the gate the PO signed off on — because it does not validate them against the schema
`compile` enforces. Filed as **HD-002**; the encoding bug is the instance, the lint/compiler
disagreement is the bet.

**Resolution.** PO chose the out-of-band syntax fix over re-dispatching `map-scopes`, because
re-running the slicing skill risked a different cut than the one accepted at L1b. Nine cells were
bracketed via the hooked `Edit` tool — deliberately not through a shell write, which would have
evaded the sandbox guard rather than satisfied it (the standard the `ba` worker had already held
itself to at L1a.5). The stale `active-order` pointer (`wire.json`, finished and ingested) was
cleared first so the guard evaluated current state; that is HD-001's second bet biting again, in a
new phase. Both scopes were then compiled successfully as proof, and the probe orders deleted.

No gate answer was recorded for this: `gate_h` is a workflow return, not a gate, and the run
resumed into BUILD rather than crossing GATE H.

## Wiring map realigned at GATE L1b

**Finding.** `wiring-map.md` named per-use-case engine modules under `todo/usecases/`
(`add_todo.py`, `list_todos.py`, `complete_todo.py`, `remove_todo.py`). It was the only artifact
in the run that said so. All seven frozen tasks, `scopes/scope-cli-core.md` and `scope-board.md`
name a single `todo/commands.py` with `add` / `list_` / `done` / `rm`.

**Why it happened.** ANALYZE runs before WIRE by design (gates.md ⟐ — `wire` reads `usecases/`),
so `ba-pitch-analyzer` wrote the task module layout first and `solution-architect` then proposed a
different one instead of following it. `scope-architect` caught the disagreement and declared it
in its contract's "Deviation note" rather than silently resolving it — the right behaviour, and
the reason this surfaced at a gate instead of mid-build.

**Why it was not cosmetic.** `scope-cli-core.allowed_file_substrate` is exactly
`[bin/todo, todo/store.py, todo/commands.py]`. `todo/usecases/` is absent, so a `task-executor`
trusting the committed wiring map would have been hook-denied by the substrate guard and spent one
of five attempts discovering it. The committed deliverable would also have shipped naming four
modules that never exist.

**Decision.** PO accepted `todo/commands.py` as the build surface — for a 1-day appetite and four
short functions, four single-function modules is over-structure, and it is what six of seven
artifacts already said. `wire` was re-dispatched to `solution-architect` (sole writer of
`wiring-map.md`; substrate `[shapeup/todo-cli/wiring-map.md]`, a bare path unaffected by HD-001)
to name the real build surface. The design was not relitigated — only the map corrected. The
superseded `results/wire.json` was archived before the re-dispatch.

## Test Surface gap closed at GATE L1a.5

**Finding (tech lead, at the gate).** The store-path resolution order — `$TODO_STORE` verbatim
when set, else `~/.todo.json` — is specified in six places (`domain-model#StorePath`, Step 1 of
all four use cases, `integration#Environment-Variables-Required`) and asserted by **none** of the
14 derived Test Surface rows. Every row seeds `$TODO_STORE`, so the fallback branch is unexercised.
With `test-surface-conformance` a graded dimension this run, this passes 14/14:

```python
def store_path():
    return os.environ["TODO_STORE"]     # KeyError for any user who never sets it
```

That is the pitch's own load-bearing constraint ("a real constraint, not a detail") covered on one
side only. PO elected to close it rather than carry it.

**Provenance.** The item was filed to `discovery/ledger.md` by the tech lead, not by a dispatched
worker — it arrived through no WorkResult, so `reduce ingest` (the normal single writer of the
discoveries channel) did not write it. It sits in its own section, `## Discovered —
todo-cli/gate-L1a.5`, so the per-flow sectioning invariant holds and the unusual provenance is
visible rather than disguised as worker output. A WorkResult was deliberately NOT fabricated to
launder it through ingest: that would have produced a false attestation.

**Closure — took two attempts, because the first hit a harness defect.**

`harness compile --operation reconcile` → `orders/reconcile.json` (substrate: append-only on
`usecases/*.md#Invariants` and `#Test Surface`; `domain-model.md`, UC `#Steps`, `contracts/**` and
`ux-behavior.md` frozen) → dispatched to `ba-pitch-analyzer` at exec tier.

The worker returned `status: escalated`, `artifacts: []`. It had correctly identified the target
UC (UC-AddTodo, from the ledger item's own `traces_to`), correctly declined to re-fold the five
already-resolved orient items, drafted `[INV-05]` and `TS-INV-05` — and was then **denied the
write by its own substrate**. Root cause, verified independently before accepting the claim:
`compile.mjs` emits `append_only` globs carrying a markdown anchor
(`…/usecases/*.md#Invariants`), and `sandbox-guard.mjs` regex-matches the whole string, anchor
included, against a real `file_path` that never has a `#fragment`. The pattern is unsatisfiable
for every file, so `reconcile` and `retrofit-surface` can never write anything. Filed as **HD-001**
in `shapeup/knowledge-base/harness-defects.md`.

The worker behaved exactly as designed under a blocked write: no `sed` workaround, no
self-widening of its substrate, and the full drafted text preserved in `deviations[]` so nothing
was lost. Its result was ingested and attested — `todo-cli/reconcile ran ba-pitch-analyzer`.

**The out-of-band application, stated plainly.** The PO chose "apply out-of-band + file the
defect" (AGENTS.md: mechanism defects go to the Betting Table, never fixed as worker steering).
The tech lead's own Edit was then denied by the *same* defect, one layer up: `liveOrders()` puts
the `.shapeup/active-order` pointer in the live set unconditionally, and nothing ever retires that
pointer — not even a successful `reduce ingest` — so the finished reconcile order was still
fencing every write in the repo. That stale pointer was moved aside (backed up, and rewritten by
the next `compile` anyway; recorded as a second bet under HD-001), and `[INV-05]` + `TS-INV-05`
were transcribed into `spec/usecases/UC-AddTodo.md` **verbatim from ba's `deviations[]` drafts**.
Authorship is ba's; the mechanical write is the tech lead's. No WorkResult was fabricated and no
receipt was forged to make this look like ordinary worker output.

Post-state: spec-lint 0 red / 0 warn, Test Surface now 15 rows (was 14).

## Intake amended at GATE L1a — provenance note

Orient's discovery ledger raised two items it explicitly refused to decide for the PO: the index
base for `done <n>` / `rm <n>`, and the default store path when `$TODO_STORE` is unset. The PO
answered both at L1a: **1-based** indices, **`~/.todo.json`** default.

Those answers had to reach `ba-pitch-analyzer`, and the ANALYZE dispatch payload is
`{pitch, spec_folder, feature, lens, orient_dir}` — there is no field on it that carries a gate
decision. The `pitch` channel is `.shapeup/todo-cli/intake.md`, so the decisions were appended
there as a marked addendum ("PO decisions — recorded at GATE L1a"), together with the spike's
wrong-shape-JSON finding folded in as one error path.

**Consequence, recorded rather than left to drift:** `receipt.json` pins
`intake_sha256 = ee86f871…de21d8`, which is the hash of the intake as opened. After the amendment
the file hashes to `d161b0fa…be2c7a`. Nothing in the kernel re-verifies the hash against the file
(`mintRunId` derives the run id from the receipt's *stored* fields; `reduce graph`, `reduce ship`
and `report facts` only copy the value into reports), so run identity is unaffected — but a
reviewer comparing the two will find them different, and this is why.

## GATE L0 resolution (recorded once, per L0.8)

**Model matrix** — `orch=opus exec=sonnet eval=sonnet qa=sonnet digester=script`.
Source: **skill-shipped defaults**. There is no `.claude/settings.local.json` in this project
(only the Tier-C `settings.local.example.json` template), and the committed
`.claude/settings.json` carries `permissions` but no `env` block, so layers 1–3 of the L0.8
precedence chain contributed nothing and no `/ship` flag overrode them. No model was degraded.

**Budgets** — `round_budget=2` (outer, appetite-informed: the pitch asks for "a single build
round", so 2 buys one fix round), `attempt_budget=5` (inner, per scope, the shipped default).
`wall_clock_budget_s` is unset — this is a local interactive run with no external kill to
undercut.

**Receipt re-opened.** The run was first opened at 03:54:35Z as
`todo-cli-20260816T035435Z-5c7fd7be` with `eval_dimensions: [spec-conformance]`. Adding
`test-surface-conformance` at the PO's direction required `harness init run --force`, because an
eval dimension that never reaches the flag is recorded nowhere and therefore grades nothing.
Nothing was lost: `rounds_used` was 0, `orders/` and `results/` were both empty, and the run
had dispatched no work. The live run is `todo-cli-20260816T084725Z-ddb6d292`.

## Risks carried into the run (declared at L0, not discovered later)

1. **Intake is a raw idea, not a shaped-and-bet pitch.** `idea.md` calls itself one, and there is
   no committed `shapeup/todo-cli/shaping/`. It does carry a problem statement, an explicit
   appetite and no-gos — most of a pitch — but no breadboard, so places/affordances/connections
   are derived by ORIENT + ANALYZE rather than agreed upstream. PO chose this knowingly at L0;
   the exposure is that scope disagreement surfaces at L1b instead of at a Betting Table.
2. **trace-lint's reachability arm is blind to this deliverable.** `kernel/verify/trace.mjs` walks
   the import graph with `SOURCE_EXTS = [.js .mjs .cjs .jsx .ts .tsx]` and an ES/CJS import regex;
   the deliverable is Python. `bin/todo` will resolve on disk (the resolver accepts an
   extensionless existing file) but the BFS will find zero imports, so every engine in
   `wiring-map.md` will be reported unreachable. Those findings are a language mismatch, not
   orphaned modules. The arm is advisory at L1b, so it warns and permits. See
   `shapeup/todo-cli/project-profile.md`. What still holds: the human wiring review at L1a.5 and
   the T0 fixtures that drive the real binary.
