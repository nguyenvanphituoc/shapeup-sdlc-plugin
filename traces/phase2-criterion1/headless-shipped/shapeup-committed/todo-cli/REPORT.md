---
type: ship-report
feature: todo-cli
date: 2026-08-16
verdict: FAIL
rounds_used: 2
qa: skipped
intake_sha256: c00ef2138131c2b3ef2a4de080c4cb308354a2a8d54c2bd958a6f935774d893f
---

# todo-cli — ship report

Frozen at GATE L4. Every figure below is derived from run artifacts on disk — the trial
ledger, the verdict artifacts, the board — never from a summary of the run.

## Outcome

| | |
|---|---|
| Verdict | **FAIL** |
| Rounds used | 2 |
| Board | 7/7 tasks done |
| T0 artifacts | 12 |
| QA | skipped |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| add-todo | 1/1 | 0 | 2 | kept | no change |
| cli-integration-test | 1/1 | 0 | 2 | kept | no change |
| complete-todo | 1/1 | 0 | 2 | kept | no change |
| foundation | 2/2 | 0 | 2 | kept | no change |
| list-todos | 1/1 | 0 | 2 | kept | no change |
| remove-todo | 1/1 | 0 | 2 | kept | no change |

## Ratchet

Measured over this run's trial ledger. A monotone series is a ratchet working; a flat or
sawtooth series says the loop is still a budgeted retry loop wearing a ratchet's shape.

| | |
|---|---|
| Trials | 12 across 6 scope(s), 6 with more than one attempt |
| Improvement rate | 1 — kept ÷ trials after the first |
| Monotone rate | 1 — multi-trial scopes whose score never decreased |
| Sawtooth count | 0 — a revert immediately after a keep |
| Mean trials to green | 1 |
| Statuses | kept 12 |

## Evaluation

| # | Criterion (committed spec) | Probe | Verdict | Conf | Re-probed |
|---|---|---|---|---|---|
| 1 | UC-CompleteTodo Steps 2–4 — index validated *before* `TodoRepository.load()`; `E_MISSING_INDEX` handling = "no store access attempted" | [cmd] | **FAIL** | high | yes |
| 2 | UC-RemoveTodo Steps 2–4 — same ordering rule | [cmd] | **FAIL** | high | yes |
| 3 | ux-behavior#Error-Catalog `E_MISSING_INDEX` message is `Error: missing index` (both `done` and `rm`) | [cmd] | **FAIL** | high | yes |
| 4 | ux-behavior#Error-Catalog `E_INVALID_INDEX` message is `Error: "<n>" is not a valid index` (both `done` and `rm`) | [cmd] | **FAIL** | high | yes |
| 5 | ux-behavior#Error-Catalog `E_INDEX_OUT_OF_RANGE` message is `Error: no todo at index <n>` (both `done` and `rm`) | [cmd] | **FAIL** | high | yes |
| 6 | UC-AddTodo `E_STORE_WRITE_FAILED` — stderr message + exit 1, never a bare stack trace | [cmd] | PASS | low (flip) | yes |
| 7 | UC-ListTodos INV-04 / TS-INV-04 — missing store file prints `No todos yet.`, exit 0 | [cmd] | PASS | high | no |
| 8 | UC-ListTodos Step 3 — items printed `N) [ ] text` / `N) [x] text`, 1-based, store order | [cmd] | PASS | high | no |
| 9 | UC-ListTodos INV-03 / TS-INV-03, TS-INV-03b — `list` never mutates the store, incl. corrupted | [data] | PASS | high | no |
| 10 | UC-ListTodos TS-NOGO-02 — plain text only, no ANSI / cursor-control escapes | [cmd] | PASS | high | no |
| 11 | UC-AddTodo Steps 4–6 — appends `{text, done:false}`, reports new 1-based position | [cmd]+[data] | PASS | high | no |
| 12 | UC-AddTodo INV-02 / TS-INV-02 — `add` only appends, never reorders | [data] | PASS | high | no |
| 13 | UC-AddTodo `E_MISSING_TEXT` / TS-ERR — missing or whitespace-only text rejected, exit 1, no store access | [cmd] | PASS* | high | no |
| 14 | UC-AddTodo INV-01 / TS-INV-01 — a failed `add` leaves the store byte-for-byte unchanged | [data] | PASS | high | no |
| 15 | UC-AddTodo RULE-02 — text stored verbatim after trim | [data] | PASS | high | no |
| 16 | contract `load()` — invalid JSON → `E_STORE_CORRUPTED`, exit 1, file never auto-overwritten | [cmd]+[data] | PASS | high | no |
| 17 | contract `load()` — parses but is not an array → treated as corruption, not coerced | [cmd] | PASS | high | no |
| 18 | contract `load()` — `ENOENT` → `[]`, not an error | [cmd] | PASS | high | no |
| 19 | contract `load()` — other read errors → `Error: could not read todo store: <reason>`, exit 1 | [cmd] | PASS | high | no |
| 20 | contract `save()` — no partial write; prior on-disk contents preserved on failure | [data] | PASS | high | no |
| 21 | UC-CompleteTodo INV-06 / TS-INV-06 — `done <n>` idempotent, same output + exit 0 twice | [cmd]+[data] | PASS | high | no |
| 22 | UC-CompleteTodo/UC-RemoveTodo Step 3 + RULE-05 — strict integer parse, no bare `Number()`/`parseInt()` coercion | [cmd] | PASS | high | no |
| 23 | TS-REQ-index-boundary (`done` + `rm`) — `0` and `length+1` rejected; `1` and `length` accepted | [cmd] | PASS | high | no |
| 24 | UC-CompleteTodo INV-05 / UC-RemoveTodo INV-07 — a failed `done`/`rm` never mutates the store | [data] | PASS | high | no |
| 25 | UC-RemoveTodo INV-08 / TS-INV-08 — removal shifts later items left, alters no `text`/`done` | [cmd]+[data] | PASS | high | no |
| 26 | `_index.md` Non-Go — no sync/server/accounts, no colours/TUI/interactive prompts, no stable ids, no store-location config | [cmd]+[data] | PASS | high | no |
| — | ux-behavior#Error-Catalog `E_UNKNOWN_COMMAND` — exact usage string, exit 1 | [cmd] | PASS | high | no |

\* Criterion 13 passes as a **superset**: stderr reads `Error: missing todo text (E_MISSING_TEXT)`
where the catalog specifies `Error: missing todo text`. Graded PASS for consistency with round 1,
recorded below as a low-severity finding.

---

### Refuted criteria and bugs

### BUG-1 — `done` reads the store before validating the index (high)
- **Criterion:** UC-CompleteTodo `## Steps` 2–4 + Error Cases (`E_MISSING_INDEX`: "no store access attempted")
- **Location:** `bin/todo.js:60-77` (`repo.load()` at :63 precedes `parseIndex()` at :72)
- **Repro:** `HOME=$T` with `printf 'not json{{' > $T/.todo.json`; `node bin/todo.js done`
- **Expected:** `Error: missing index`, exit 1, store never opened
- **Actual:** `Error: todo store is corrupted (…/.todo.json) — fix or delete the file`, exit 1
- **Fix shape:** call `parseIndex(args[0])` for presence + integer form first, load second, range-check third — matching the spec's three-phase order.

### BUG-2 — `rm` reads the store before validating the index (high)
- **Criterion:** UC-RemoveTodo `## Steps` 2–4 + Error Cases (`E_MISSING_INDEX`: "no store access attempted")
- **Location:** `bin/todo.js:92-109` (`repo.load()` at :95 precedes `parseIndex()` at :104)
- **Repro:** same corrupted store; `node bin/todo.js rm`
- **Expected:** `Error: missing index`, exit 1, store never opened
- **Actual:** `Error: todo store is corrupted (…/.todo.json) — fix or delete the file`, exit 1

### BUG-3 — `rm` prefixes the machine error code onto every index error message (high)
- **Criterion:** `ux-behavior#Error-Catalog` rows `E_MISSING_INDEX`, `E_INVALID_INDEX`, `E_INDEX_OUT_OF_RANGE` (covers criteria 3, 4, 5)
- **Location:** `bin/todo.js:106` — `` console.error(`Error: ${err.code} - ${err.message}`) ``
- **Repro:** 1-item store; `node bin/todo.js rm abc`, `node bin/todo.js rm 9`, `node bin/todo.js rm`
- **Expected:** `Error: "abc" is not a valid index` / `Error: no todo at index 9` / `Error: missing index`
- **Actual:** `Error: E_INVALID_INDEX - "abc" is not a valid index` / `Error: E_INDEX_OUT_OF_RANGE - no todo at index 9` / `Error: E_MISSING_INDEX - missing index`
- **Fix shape:** render as `` `Error: ${err.message}` ``, identical to `cmdDone` at `bin/todo.js:74`.

### BUG-4 — `add` appends the error code to the missing-text message (low)
- **Criterion:** `ux-behavior#Error-Catalog` row `E_MISSING_TEXT` — user message `Error: missing todo text`
- **Location:** `bin/todo.js:12`
- **Actual:** `Error: missing todo text (E_MISSING_TEXT)` — a superset of the catalog string, so graded PASS, but it is the same class of leak as BUG-3 and should be normalised in the same edit.

---

## Discovered, not built

+ npm test (node --test test/) currently fails with MODULE_NOT_FOUND on this Node version/repo layout — pre-existing, unrelated to this scope, not touched

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
