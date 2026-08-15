---
type: eval-report
feature: todo-cli
round: 2
worker: spec-evaluator
order_id: todo-cli/evaluate
run_id: todo-cli-20260815T152011Z-1a6a2efb
dimensions: [spec-conformance]
verdict: FAIL
generated_at: 2026-08-15
---

# EVAL — Feature `todo-cli` (round 2, spec-conformance)

## Verdict: **FAIL**

Round 2 closed the round-1 gap in `UC-AddTodo`'s engine — `src/commands/add.js` now exists and
its unit fixture is green (T0 `r2-a1-t3`, 1/1) — but the decisive round-1 defect is **unchanged**:

```
$ cat bin/todo.js
#!/usr/bin/env node
// Placeholder entry point — command dispatch is implemented in a later task.
```

`bin/todo.js` is still the `foundation` scope's two-line shebang placeholder. It has **zero
call sites** into `src/commands/*` (`grep -rn "commands/" bin src` returns nothing outside
`src/commands/` itself). Every documented invocation — `add`, `list`, `done`, `rm`, an unknown
subcommand, and no subcommand at all — prints nothing to stdout or stderr and exits **0**,
including the error paths the pitch names as its core requirement ("reject bad index without
crashing", "survives a corrupted or missing store file").

All four command engines are individually correct at the module level (44 unit assertions pass
across six files). That is not the graded oracle. Every `## Test Surface` row in all four
committed use cases specifies **`Oracle: process`** — `todo <cmd>` run as a process. A correct
orphaned engine is not a shipped use case, and `wiring-map.md` says so explicitly: each UC's
`entry_call_site` is "`bin/todo.js` — the `"<cmd>"` dispatch branch". None of those four
branches exists.

---

## T0 citations (sha256 recomputed from disk by the evaluator)

| scope_id | path | sha256 (recomputed) | T0 overall |
|---|---|---|---|
| complete-todo | `.shapeup/todo-cli/t0/verdicts/r2-a1-t1.json` | `599cbd8f8cf698a2d370db1ea2d520247bd468d3362015230f59d89b63ec6176` | green (1/1) |
| foundation | `.shapeup/todo-cli/t0/verdicts/r2-a1-t2.json` | `1f843bed60cb589c21910f81e3a8710742d928748d011495803a6b1cce375534` | green (2/2) |
| add-todo | `.shapeup/todo-cli/t0/verdicts/r2-a1-t3.json` | `78c3f1bc01124deeca445c5563d15fb01a6552652f77edf7d3bcbbc17c10c765` | green (1/1) |
| remove-todo | `.shapeup/todo-cli/t0/verdicts/r2-a1-t4.json` | `2e0a8214fc2a90bff85ebd7b5e3f4853a9169cbf9d72fff3f5f41b1ce52d5e00` | green (1/1) |
| cli-integration | `.shapeup/todo-cli/t0/verdicts/r1-a3-t1.json` | `8758eaa6fbbd210be6842736a9735e3350718ff1dafb3ff37e61e584003d996c` | **red** (0/2) — newest T0 this scope has |
| list-todos | `.shapeup/todo-cli/t0/verdicts/r1-a1-t4.json` | `49bb4b6595fcabd96e631d5f50f55f6a6286d4df66ec02f71d60b078bd0b7e7b` | green (1/1) — newest T0 this scope has |

Every digest was recomputed with `shasum -a 256` against the file on disk and matches
`.shapeup/todo-cli/t0/trials.jsonl`. No hash was taken on trust.

### Structural precondition defect (not a criterion)

`cli-integration` — the scope that owns `bin/todo.js` and the whole dispatch chain — carries
**no round-2 T0 verdict at all**. Its only artifacts are round 1 attempts a1/a2/a3, all red at
0/2 fixtures with `delta: "no change"`, all three attempts burned. Both fixtures its scope
contract declares still do not exist on disk:

```
$ ls test/cli.test.js test/integration/cli.test.js
ls: test/cli.test.js: No such file or directory
ls: test/integration/cli.test.js: No such file or directory
```

So the red is "the test was never written", not "the test fails". Round 2 dispatched
`complete-todo`, `foundation`, `add-todo`, and `remove-todo` — and never re-dispatched
`cli-integration`, the one scope whose absence fails every use case. `list-todos` was likewise
not dispatched in round 2 (its round-1 green still stands).

The WorkOrder listed no `t0_artifacts[]`; the citations above were selected by the evaluator
from `t0/trials.jsonl` and re-hashed independently.

---

## Probe environment

Clean empty cwds (`/tmp/todoprobe`, `/tmp/todoprobe2`, `/tmp/p3`), `node v24.15.0`, invoked as
`node /Volumes/LibertyMobi/workspace/phase2-todo-cli-headless/bin/todo.js <args>`. Every FAIL
below was probed in at least two independent clean directories; **both passes agreed — no
flips, confidence high.**

Representative transcript (`/tmp/todoprobe`, empty directory):

```
$ node bin/todo.js add "Buy milk"   → (no output) exit=0
$ node bin/todo.js list             → (no output) exit=0
$ ls -a                             → no ./.todo.json was ever created
$ node bin/todo.js done 1           → (no output) exit=0
$ node bin/todo.js rm 1             → (no output) exit=0
$ node bin/todo.js add              → (no output) exit=0
$ node bin/todo.js                  → (no output) exit=0
$ node bin/todo.js badcmd           → (no output) exit=0
$ node bin/todo.js done abc         → (no output) exit=0
$ node bin/todo.js done 99          → (no output) exit=0
# with ./.todo.json = 'not json {{{'
$ node bin/todo.js list             → (no output) exit=0
```

Module-level control (proves the engines themselves are not the defect):

```
test/domain/todo-list.test.js   pass 9  fail 0
test/store.test.js              pass 6  fail 0
test/commands/add.test.js       pass 7  fail 0
test/commands/list.test.js      pass 6  fail 0
test/commands/done.test.js      pass 11 fail 0
test/commands/rm.test.js        pass 11 fail 0
```

---

## Criteria — dimension `spec-conformance` (hard threshold: 100%)

| # | Criterion (committed spec text) | Verdict | Conf. | Re-probed | Evidence |
|---|---|---|---|---|---|
| 1 | UC-AddTodo Steps 1–6 — append item, persist, print confirmation, exit 0 | FAIL | high | yes | `bin/todo.js:2` — `todo add "Buy milk"` in a clean cwd emits nothing, exits 0, writes no `./.todo.json`; the working engine at `src/commands/add.js:89` has no call site |
| 2 | UC-AddTodo Error Case `MISSING_TEXT` — stderr "text is required", exit 1, no store write | FAIL | high | yes | `bin/todo.js:2` — `todo add` with no argument exits 0, empty stderr; `src/commands/add.js:70` unreachable |
| 3 | UC-AddTodo Error Case `STORE_CORRUPTED` — stderr names corrupted store, exit 1, no stack trace | FAIL | high | yes | `bin/todo.js:2` — with `./.todo.json` = `not json {{{`, `todo add "x"` exits 0 silently |
| 4 | UC-AddTodo TS-INV-01 — third item's id not reused after `rm` | FAIL | high | yes | `bin/todo.js:2` — the CLI never writes a store file, so the process-oracle probe the TS row specifies cannot observe any id |
| 5 | UC-AddTodo TS-NOGO-01 — no ANSI escapes / interactive prompt in `add` output | PASS | medium | no | `od -c` of stdout shows no escape sequence and no prompt; **vacuously satisfied** — the command produces no output at all |
| 6 | UC-ListTodos Steps 1–3 — render `[i] [x\| ] <text>`, exit 0 | FAIL | high | yes | `bin/todo.js:2` — `todo list` prints nothing; the correct renderer at `src/commands/list.js:76` has no call site |
| 7 | UC-ListTodos TS-INV-02 / ux-behavior RULE-04 — missing store prints "no todos yet", exit 0, never blank | FAIL | high | yes | `bin/todo.js:2` — stdout is empty, which RULE-04 explicitly forbids; `src/commands/list.js:70` unreachable |
| 8 | UC-ListTodos TS-ERR-STORE_CORRUPTED — exit 1, stderr names the store, no stack trace | FAIL | high | yes | `bin/todo.js:2` — `todo list` against a corrupted store exits 0 with empty stderr |
| 9 | UC-CompleteTodo Steps 1–8 — mark item at 1-based index done, save, exit 0 | FAIL | high | yes | `bin/todo.js:2` — `todo done 1` no-ops; `src/commands/done.js:99` unreachable from the entry point |
| 10 | UC-CompleteTodo Error Cases `MISSING_INDEX` / `INVALID_INDEX` / `INDEX_OUT_OF_RANGE` (RULE-05) | FAIL | high | yes | `bin/todo.js:2` — `todo done`, `todo done abc`, `todo done 99` all exit 0 with empty stderr |
| 11 | UC-CompleteTodo TS-REQ-n-boundary — 0 and length+1 rejected, 1 and length accepted | FAIL | high | yes | `bin/todo.js:2` — the process neither accepts nor rejects any index |
| 12 | UC-CompleteTodo TS-ERR-STORE_CORRUPTED — exit 1, no stack trace | FAIL | high | yes | `bin/todo.js:2` — exits 0 against a corrupted store |
| 13 | UC-CompleteTodo TS-NOGO-03 / RULE-06 — `done 1` twice succeeds idempotently | FAIL | high | yes | `bin/todo.js:2` — no item can be marked done a first time, so idempotence is unobservable at the process oracle |
| 14 | UC-RemoveTodo Steps 1–8 — splice item at index, save without decrementing `nextId`, exit 0 | FAIL | high | yes | `bin/todo.js:2` — `todo rm 1` no-ops; `src/commands/rm.js:101` unreachable from the entry point |
| 15 | UC-RemoveTodo Error Cases `MISSING_INDEX` / `INVALID_INDEX` / `INDEX_OUT_OF_RANGE` (RULE-07) | FAIL | high | yes | `bin/todo.js:2` — `todo rm` and `todo rm 0` both exit 0 with empty stderr |
| 16 | UC-RemoveTodo TS-INV-01 — id never recycled after removal, `nextId` not decremented | FAIL | high | yes | `bin/todo.js:2` — unverifiable at the specified process oracle; the CLI never writes a store to inspect |
| 17 | UC-RemoveTodo TS-REQ-n-boundary — on a 3-item list, 0 and (now-)4 rejected, 1 accepted and list shrinks | FAIL | high | yes | `bin/todo.js:2` — no list can be built through the CLI, so no boundary can be exercised |
| 18 | ux-behavior cross-cutting `UNKNOWN_COMMAND` — unrecognized or absent `argv[2]` prints usage, exit 1 | FAIL | high | yes | `bin/todo.js:2` — `todo badcmd` and bare `todo` both exit 0 with no usage line; the `cli:dispatch` affordance's `error` state does not exist |
| 19 | Contract `TodoStoreRepository` — commands perform store I/O through `foundation`'s `load()`/`save()` | FAIL | high | yes | `src/store.js:74` has zero production call sites (`grep require.*store` finds only `test/store.test.js:27`); `src/commands/add.js:25`, `done.js:25`, `list.js:23`, `rm.js:25` each inline a private duplicate loader |
| 20 | scope-summary Done-when (`cli-integration`) — real dispatcher plus TASK-009 subprocess round-trip test | FAIL | high | yes | `bin/todo.js:2` — T0 red on all three round-1 attempts (0/2 fixtures), no round-2 attempt; both declared fixtures `test/cli.test.js` and `test/integration/cli.test.js` do not exist on disk |
| 21 | Non-Go — no sync, no server, no accounts | PASS | high | no | `package.json` declares no dependencies; no network module is required anywhere under `src/` or `bin/` |
| 22 | Non-Go — no TUI, no colors, no interactive prompts | PASS | high | no | No ANSI escape sequences and no stdin prompts across 11 probed invocations (`od -c` on `list` stdout is empty) |

**Dimension result: FAIL — 3 / 22 criteria pass (threshold 100%).**
Overall PASS requires all active dimensions to pass; the halo effect is banned.

---

## Stability

No criterion flipped. All 19 round-2 FAILs that also appear in
`.shapeup/todo-cli/evaluation/.verdicts-evaluate.jsonl` (run 1) held the same FAIL verdict with
the same root cause, and both re-probes agreed within this run. Criteria 13 and 17 are new to
run 2 (they were folded into other rows in run 1) — no prior line exists, so no flip is
possible. Criteria 5, 21, 22 held PASS. **Confidence high throughout, except criterion 5 which
stays medium because its pass is vacuous** (nothing is printed, so nothing can be colored).

---

## Bugs

### BUG-01 — blocker — the composition root was never written

- **Criterion:** #1, #6, #9, #14, #18, #20 (all four UC Steps + `UNKNOWN_COMMAND` + Done-when)
- **File:** `bin/todo.js:2`
- **Repro:** `cd /tmp/empty && node <repo>/bin/todo.js add "Buy milk"; echo $?`
- **Expected:** stdout `Added: [1] Buy milk`, exit 0, `./.todo.json` created.
- **Actual:** no output, exit 0, no file created. Same for `list`, `done <n>`, `rm <n>`,
  `badcmd`, and bare `todo`.
- **Fix:** implement the `argv[2]` → `{add,list,done,rm}` dispatcher per
  `wiring-map.md` and `scopes/cli-integration.md`: `require('../src/commands/<name>.js')`,
  invoke `run(argv.slice(3), …)`, `process.exit()` with the returned code, and emit
  `todo: unknown command '<cmd>' — usage: todo <add|list|done|rm>` + exit 1 for anything else.

### BUG-02 — major — the store engine is orphaned and duplicated four times

- **Criterion:** #19 (contract `TodoStoreRepository`)
- **File:** `src/store.js:74` (module export with no production consumer); duplicates at
  `src/commands/add.js:25`, `src/commands/done.js:25`, `src/commands/list.js:23`,
  `src/commands/rm.js:25`
- **Repro:** `grep -rn "require.*store" bin src test` → only `test/store.test.js:27`.
- **Expected:** per `contracts/todo-store.contract.md` and `wiring-map.md`, all four command
  engines load/save through the single repository implementation.
- **Actual:** each command carries a private copy of `loadStore`/`saveStore`/`isValidShape` and
  its own `class StoreCorruptedError`. The copies have already drifted from `src/store.js`
  (which is `./.todo.json` cwd-relative via a module constant, while the commands take a
  `cwd` option and `path.join`), so a fix to one is not a fix to the others — and an
  `instanceof StoreCorruptedError` check will not match across module boundaries.

### BUG-03 — major — `cli-integration`'s declared verification fixtures do not exist

- **Criterion:** #20 (Done-when)
- **File:** `shapeup/todo-cli/scopes/cli-integration.md:6` (`e2e_verification_fixtures`)
- **Repro:** `ls test/cli.test.js test/integration/cli.test.js` → both `No such file or directory`.
- **Expected:** two subprocess round-trip fixtures exercising `bin/todo.js` → all four commands
  → the shared store.
- **Actual:** neither file was ever created; the scope's three round-1 T0 attempts were red for
  that reason (0/2, `delta: "no change"`), and it received no round-2 attempt at all. The T0
  signal for the only scope that matters is therefore both red and stale.

---

## NEXT ACTION

Re-dispatch **`cli-integration` only** (TASK-008 then TASK-009). Every other scope is green at
T0 and correct at the module level; nothing else needs to change. Concretely:

1. Write the real `bin/todo.js` dispatcher (BUG-01) — this alone flips criteria 1–4, 6–18, 20.
2. Write `test/cli.test.js` and `test/integration/cli.test.js` (BUG-03) so the scope has a
   non-vacuous T0 signal.
3. Optionally fold the four duplicated loaders back onto `src/store.js` (BUG-02) — required for
   criterion 19, and cheap to do while the dispatcher lands.

Note for the orchestrator: `cli-integration` has already burned its three-attempt budget in
round 1. It needs an explicit budget reset (or a scope-hammer decision) before it can be
re-dispatched, or round 3 will repeat round 2's omission.
