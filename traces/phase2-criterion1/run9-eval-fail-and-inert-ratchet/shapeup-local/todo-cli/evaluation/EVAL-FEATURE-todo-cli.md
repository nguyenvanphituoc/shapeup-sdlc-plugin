---
type: eval-report
feature: todo-cli
order_id: todo-cli/evaluate
run_id: todo-cli-20260815T171521Z-b135247d
round: 1
dimensions: [spec-conformance]
verdict: FAIL
generated_at: 2026-08-16
---

# EVAL — todo-cli (feature-level, round 1)

**VERDICT: FAIL** (spec-conformance threshold is 100% of `[cmd]` criteria; 6 criteria failed)

Probe method: `[cmd]` only — non-UI CLI. Every probe ran the real binary
`node bin/todo.js` with `HOME` pointed at a disposable sandbox (`/tmp/evh*`), so
`os.homedir()` resolved the store to a throwaway `~/.todo.json`. Grading source is the
committed `shapeup/todo-cli/spec/**` (UC Steps / Invariants / Error Cases / Test Surface,
`ux-behavior.md` Error Catalog, `contracts/todo-repository.contract.md`, `_index.md` Non-Go).
Task-file checklists were read for traceability only and were not graded against.

---

## T0 citations (sha256 recomputed from disk by this evaluator)

| Scope | Artifact | sha256 (recomputed) | Matches `t0/trials.jsonl` |
|---|---|---|---|
| foundation | `.shapeup/todo-cli/t0/verdicts/r1-a1-t1.json` | `c5674059c7bd6280ae87ff66c62374b700558153742bd27a412bea1477b1dee6` | yes |
| add-todo | `.shapeup/todo-cli/t0/verdicts/r1-a1-t2.json` | `3677f5c89c0bf456310ac7d67f1f59b6de971d6171e60ac59a12c0e145959ae6` | yes |
| complete-todo | `.shapeup/todo-cli/t0/verdicts/r1-a1-t3.json` | `0b8635d7dd500bf0d7f16da507b78fb93489a1b608822b367a7c4922e20909d1` | yes |
| list-todos | `.shapeup/todo-cli/t0/verdicts/r1-a1-t4.json` | `21d4821e80315f2cd3cdeadf7b8959fd15709c71db459919e14d06e755d057f5` | yes |
| remove-todo | `.shapeup/todo-cli/t0/verdicts/r1-a1-t5.json` | `762d76ea08c1719d0cdf8033c5d9fa2bd2c1d165dafc2620db859db40f1d0d70` | yes |
| cli-integration-test | `.shapeup/todo-cli/t0/verdicts/r1-a1-t6.json` | `2fe1781cf5dc3f7dcd50b99e3a2d87dc5f76f4ed679c2b8ba8a493c22d6b347c` | yes |

All six T0 artifacts are present and green as recorded. **Note:** T0's `foundation` verdict
recorded 2/2 fixtures green, but re-running that scope's own declared fixture now yields
`pass 6 / fail 1` — see BUG-05. T0 is a point-in-time fact and is cited as such; it is not
evidence that the fixture is green today.

---

## spec-conformance — criteria table

| # | Criterion (committed spec text) | Probe | Verdict | Conf. | Re-probed | Evidence |
|---|---|---|---|---|---|---|
| 1 | UC-ListTodos INV-04 — missing store prints `No todos yet.`, exit 0 | cmd | PASS | high | — | `HOME=/tmp/evh node bin/todo.js list` on fresh HOME → stdout `No todos yet.`, exit 0 |
| 2 | UC-ListTodos Step 3 — `N) [ ] text` / `N) [x] text`, 1-based, store order | cmd | PASS | high | — | after 2 adds + `done 2`: `1) [ ] buy milk` / `2) [x] write spec` |
| 3 | UC-ListTodos INV-03 / INV-03b — `list` never writes, incl. corrupted store | cmd | PASS | high | — | corrupted `not json{{` byte-identical after `list`; exit 1 |
| 4 | UC-ListTodos TS-NOGO-02 — plain text, no ANSI/cursor escapes | cmd | PASS | high | — | `od -c` of list stdout = `1 ) [ ] a n s i t e s t \n`, zero escape bytes |
| 5 | UC-AddTodo Steps 4–6 — append + 1-based position confirmation | cmd | PASS | high | — | `Added: "1) buy milk"`, `Added: "2) write spec"` |
| 6 | UC-AddTodo INV-02 — append only, never reorders (TS-INV-02) | cmd | PASS | high | — | store `[{a},{b},{c}]` in insertion order after 3 adds |
| 7 | UC-AddTodo E_MISSING_TEXT — omitted / whitespace-only text, exit 1, no store access | cmd | PASS | high | — | `add` and `add "   "` → stderr `Error: missing todo text (E_MISSING_TEXT)`, exit 1, no store file created |
| 8 | UC-AddTodo INV-01 — failed `add` leaves store byte-identical (TS-INV-01) | cmd | PASS | high | — | read-only store + `add "y"` → file still `[{"text":"seed","done":false}]` |
| 9 | UC-AddTodo E_STORE_WRITE_FAILED — stderr message, exit 1 (never a bare stack trace, `ux-behavior#Global-convention`) | cmd | **FAIL** | high | yes | Uncaught `StoreWriteError` prints a full Node stack trace — `bin/todo.js:27` (see BUG-01) |
| 10 | Contract `load()` — corrupted JSON → `E_STORE_CORRUPTED`, exit 1, file never auto-overwritten | cmd | PASS | high | — | all four commands on `not json{{` → `Error: todo store is corrupted (…) — fix or delete the file`, exit 1, file unchanged |
| 11 | Contract `load()` — parses but is not an array → `StoreCorruptedError` | cmd | PASS | high | — | `{"a":1}` store + `list` → corrupted-store message, exit 1 |
| 12 | Contract `save()` — no partial write; prior contents preserved on failure | cmd | PASS | high | — | store byte-identical after three failed EACCES writes (`add`/`done`/`rm`) |
| 13 | UC-CompleteTodo INV-06 — `done <n>` idempotent, same success output twice (TS-INV-06) | cmd | PASS | high | — | `done 2` twice → both exit 0, both `Done: "2) write spec"` |
| 14 | UC-CompleteTodo/UC-RemoveTodo Step 3 — strict integer parse, no bare coercion (RULE-05) | cmd | PASS | high | — | `abc`, `2.5`, `3abc`, `""` all rejected E_INVALID_INDEX; `""` not coerced to 0 |
| 15 | TS-REQ-index-boundary — `0`/`len+1` rejected, `1`/`len` accepted (done + rm) | cmd | PASS | high | — | 3-item store: `done 0`/`done 4` exit 1; `done 1`/`done 3` exit 0 |
| 16 | UC-CompleteTodo INV-05 / UC-RemoveTodo INV-07 — failed op never mutates store | cmd | PASS | high | — | store byte-identical after `done 0/4`, `rm 0/9`, `rm abc`, `rm` |
| 17 | UC-RemoveTodo INV-08 — remove shifts later items left, texts unaltered | cmd | PASS | high | — | `[a,b,c]` → `rm 1` → `list` = `1) [x] write spec` pattern verified; 3-item fixture renumbers 1..2 |
| 18 | UC-CompleteTodo Steps 2–4 — index validated **before** `TodoRepository.load()`; E_MISSING_INDEX has "no store access attempted" | cmd | **FAIL** | high | yes | corrupted store + `todo done` → `E_STORE_CORRUPTED`, not `E_MISSING_INDEX` — `bin/todo.js:53` (BUG-02) |
| 19 | UC-RemoveTodo Steps 2–4 — same ordering rule for `rm` | cmd | **FAIL** | high | yes | corrupted store + `todo rm abc` → `E_STORE_CORRUPTED`, not `E_INVALID_INDEX` — `bin/todo.js:85` (BUG-02) |
| 20 | `ux-behavior#Error-Catalog` E_MISSING_INDEX user message `Error: missing index` | cmd | **FAIL** | high | yes | actual `Error: E_MISSING_INDEX - index is required` — `lib/parse-index.js:5` (BUG-03) |
| 21 | `ux-behavior#Error-Catalog` E_INVALID_INDEX user message `Error: "<n>" is not a valid index` | cmd | **FAIL** | high | yes | actual `Error: E_INVALID_INDEX - invalid index: "zz"` — `lib/parse-index.js:13` (BUG-03) |
| 22 | `ux-behavior#Error-Catalog` E_INDEX_OUT_OF_RANGE user message `Error: no todo at index <n>` | cmd | **FAIL** | high | yes | actual `Error: E_INDEX_OUT_OF_RANGE - index 7 out of range (1-1)` — `lib/parse-index.js:21` (BUG-03) |
| 23 | `ux-behavior` E_UNKNOWN_COMMAND — `Error: unknown command "<cmd>". Usage: …` | cmd | PASS | high | — | `todo bogus` → exact catalog string, exit 1 |
| 24 | `_index.md` Non-Go — no colors/TUI/interactive prompts | cmd | PASS | high | — | criterion 4 (no ANSI) + every error path exits immediately, never blocks on stdin |
| 25 | `_index.md` Non-Go — no config/flags for store location; path fixed to `~/.todo.json` | data | PASS | high | — | `lib/todo-repository.js:31-33` resolves `os.homedir()/.todo.json` only; no env/flag override; store observed at `$HOME/.todo.json` |
| 26 | `_index.md` Non-Go — no sync/server/accounts, no persisted item ids | data | PASS | high | — | store file is a bare `[{text,done}]` array, no `id` field, no network code |

**Score: 20/26 PASS — dimension threshold is 100%. spec-conformance FAILS.**

## Stability

No prior `.verdicts-*.jsonl` exists for this feature (round 1, first evaluation), so no flip
detection was possible. All six FAILs were re-probed once and reproduced identically on the
second run → confidence high on every one. No flaky criterion observed.

---

## Bugs

### BUG-01 — HIGH — `add` crashes with a raw stack trace when the store write fails
- **Criterion:** #9 (UC-AddTodo Error Case `E_STORE_WRITE_FAILED`; `ux-behavior` global convention "Never a bare stack trace")
- **Location:** `bin/todo.js:27`
- **Repro:**
  ```
  H=/tmp/x; mkdir -p $H; HOME=$H node bin/todo.js add seed
  chmod 444 $H/.todo.json; chmod 555 $H
  HOME=$H node bin/todo.js add second
  ```
- **Expected:** stderr `Error: could not save todo store: <reason>`, exit 1.
- **Actual:** exit 1 with an uncaught `StoreWriteError` — 10 lines of Node stack trace naming
  `lib/todo-repository.js:65`, `bin/todo.js:27`, `Module._compile`, plus `Node.js v24.15.0`.
- **Why it matters:** this is the exact rabbit hole `_index.md` and `integration.md` were
  written to prevent. `cmdDone` (`bin/todo.js:73-79`) and `cmdRm` (`bin/todo.js:105-111`) wrap
  `repo.save()` in try/catch and render the correct one-line message; `cmdAdd` does not.
- **Fix shape:** wrap `repo.save(items)` at `bin/todo.js:27` in the same try/catch the other
  two commands use.

### BUG-02 — MEDIUM — `done`/`rm` load the store before validating the index, inverting the spec's error precedence
- **Criterion:** #18, #19 (UC-CompleteTodo Steps 2–4, UC-RemoveTodo Steps 2–4; both Error
  Case tables state E_MISSING_INDEX means "no store access attempted")
- **Location:** `bin/todo.js:53` (`cmdDone` loads first), `bin/todo.js:85` (`cmdRm` loads first)
- **Repro:**
  ```
  H=/tmp/y; mkdir -p $H; printf '{{bad' > $H/.todo.json
  HOME=$H node bin/todo.js done        # and: done abc / rm / rm abc
  ```
- **Expected:** `Error: missing index` (bare `done`) / `Error: "abc" is not a valid index`
  (`done abc`) — the spec runs Step 2 and Step 3 before the Step 4 load.
- **Actual:** all four invocations print `Error: todo store is corrupted (…)`. The store is
  touched on a path the spec says must not touch it, and the user is told the wrong thing is
  wrong.
- **Fix shape:** in both handlers, parse the raw index argument (missing + strict-integer
  checks) before calling `repo.load()`; keep only the range check after the load, since range
  depends on `items.length`.

### BUG-03 — MEDIUM — index error messages do not match the committed Error Catalog
- **Criterion:** #20, #21, #22 (`ux-behavior.md` Error Catalog "User Message" column, plus the
  `done-command` / `rm-command` state tables)
- **Location:** `lib/parse-index.js:5` (`index is required`), `lib/parse-index.js:13`
  (`invalid index: "<raw>"`), `lib/parse-index.js:21` (`index <n> out of range (1-<len>)`),
  rendered by `bin/todo.js:66` and `bin/todo.js:98` as `Error: ${err.code} - ${err.message}`
- **Repro:** 1-item store → `todo done`, `todo done zz`, `todo done 7`
- **Expected / Actual:**
  | Spec | Actual |
  |---|---|
  | `Error: missing index` | `Error: E_MISSING_INDEX - index is required` |
  | `Error: "zz" is not a valid index` | `Error: E_INVALID_INDEX - invalid index: "zz"` |
  | `Error: no todo at index 7` | `Error: E_INDEX_OUT_OF_RANGE - index 7 out of range (1-1)` |
- **Why it slipped through:** `test/commands/done.test.js:65,76,100,135,148,159` and
  `test/commands/rm.test.js:46,56,109,119,129,138` assert only `assert.match(stderr, /E_…/)`
  — the error *code*, never the catalog's user-facing sentence. The fixtures are green and the
  contract is still violated.
- **Related (not separately graded):** the corrupted-store message prints the expanded absolute
  path (`/tmp/evh2/.todo.json`) where the catalog shows `~/.todo.json`
  (`lib/todo-repository.js:50`). Cosmetic; folded in here for the fixer's convenience.

### BUG-04 — MEDIUM — the declared `npm test` script is broken
- **Criterion:** not a UC criterion — reported as a defect, does not itself drive the verdict
- **Location:** `package.json:9` — `"test": "node --test test/"`
- **Repro:** `npm test`
- **Expected:** the whole suite runs.
- **Actual:** exit 1, `Error: Cannot find module '…/phase2-todo-cli-final/test'` — on Node
  v24.15.0 `node --test <dir>` is resolved as a module path, not a test directory.
  The project's advertised entry point for verification does not run.
- **Fix shape:** `node --test "test/**/*.test.js"` (or `node --test --test-reporter=spec test/**/*.test.js`).

### BUG-05 — LOW — `foundation` scope's own fixture is now red (stale scaffold assertion)
- **Criterion:** not a UC criterion — reported as a T0-drift defect
- **Location:** `test/bin-scaffold.test.js:39`
- **Repro:** `node --test test/bin-scaffold.test.js`
- **Expected:** green, as recorded in `t0/verdicts/r1-a1-t1.json` (2/2 fixtures).
- **Actual:** `pass 6 / fail 1` — *"node bin/todo.js list reaches its stub branch without
  throwing"* asserts `exit === 1`, but `list` now correctly exits 0 (TASK-004 replaced the stub).
  The product is right and the test is stale, but `foundation`'s declared
  `e2e_verification_fixtures` no longer passes, so the scope contract is red at feature level.
- **Fix shape:** delete or rewrite the scaffold-era assertion for `list`.

**Fixture status re-run by this evaluator:** `todo-repository` 7/0, `bin-scaffold` 6/1,
`add` 5/0, `list` 5/0, `done` 12/0, `rm` 10/0, `cli` 4/0.

---

## Spec defects surfaced (not silently passed)

1. **Success-message format is self-contradictory.** `ux-behavior#done-command` specifies
   `Done: N) <text>` (unquoted) while `UC-CompleteTodo` System Flow specifies
   `Done: "2) buy milk"` (quoted); same split for `rm`. The implementation emits the quoted UC
   form. Graded against the UC (the skill's designated source of truth), so **not** counted as a
   FAIL — but the two documents must be reconciled before the next round or this becomes an
   arbitrary judgement call.
2. **`E_MISSING_TEXT` message is a superset, tolerated.** Catalog says
   `Error: missing todo text`; implementation appends ` (E_MISSING_TEXT)`. Counted PASS
   (contains the required sentence) — flagged so the tolerance is a recorded decision rather
   than an unnoticed drift. If BUG-03 is fixed by dropping code prefixes, fix this for symmetry.

---

## NEXT ACTION

Return to the generator for round 2 with three fixes, in priority order:

1. **BUG-01** — wrap `repo.save()` in `cmdAdd` (`bin/todo.js:27`). One-line-shaped fix, highest
   severity: it is the pitch's named rabbit hole reaching the user.
2. **BUG-02** — move index parsing ahead of `repo.load()` in `cmdDone`/`cmdRm`.
3. **BUG-03** — align `lib/parse-index.js` messages (and the `bin/todo.js` renderer) with the
   `ux-behavior` Error Catalog, **and** tighten `test/commands/done.test.js` /
   `test/commands/rm.test.js` to assert the user-facing sentence, not just the error code —
   otherwise the same drift recurs invisibly.

Also fix BUG-04 and BUG-05 so the suite is trustworthy for the next T0. Re-run this evaluation
after the fixes; criteria 9, 18, 19, 20, 21, 22 are the ones to re-probe.
