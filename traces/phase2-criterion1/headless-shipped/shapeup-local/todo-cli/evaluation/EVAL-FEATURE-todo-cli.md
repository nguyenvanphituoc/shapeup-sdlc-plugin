---
type: eval-report
feature: todo-cli
order_id: todo-cli/evaluate-r2
run_id: todo-cli-20260815T171521Z-b135247d
round: 2
worker: spec-evaluator
dimensions: [spec-conformance]
verdict: FAIL
generated_at: 2026-08-16
---

# EVAL — Feature `todo-cli` (round 2, spec-conformance)

## Verdict: **FAIL**

`spec-conformance` hard threshold is 100% of `[cmd]` criteria + contract triplet + Non-Go list.
**21 of 26 criteria PASS, 5 FAIL** → dimension fails → overall FAIL. Only one dimension was
active (`payload.dimensions: ["spec-conformance"]`), so no halo lift is possible or attempted.

All five remaining failures live in **two code sites**: the load-before-validate ordering in
`cmdDone`/`cmdRm`, and the `rm` error renderer that prefixes the machine error code onto the
user-facing message.

---

## T0 citations (sha256 recomputed from disk by this judge; handed hashes not trusted)

The order carried no `payload.t0_artifacts[]`; the round-2 attempt-1 verdict artifacts were read
directly from `.shapeup/todo-cli/t0/verdicts/` and re-hashed here.

| Scope | Artifact | sha256 (recomputed) | Overall |
|---|---|---|---|
| foundation | `.shapeup/todo-cli/t0/verdicts/r2-a1-t1.json` | `12d91c29c1c4707800d925debade76aebf483c4aedfa22af696240615d441899` | green (2/2) |
| remove-todo | `.shapeup/todo-cli/t0/verdicts/r2-a1-t2.json` | `37150c1ec50c7fb5528540135c825f6c2ea27d96440823a9c957f0b1024c1db9` | green (1/1) |
| list-todos | `.shapeup/todo-cli/t0/verdicts/r2-a1-t3.json` | `53f3b7e3f984f87beaedc1b1277333ea401e6a708e63c0e071259d1af937d3ee` | green (1/1) |
| add-todo | `.shapeup/todo-cli/t0/verdicts/r2-a1-t4.json` | `4aef0c5ba3850d9f48eef7f2fd3f710b843066025d8846b23c25cf929bfc28cc` | green (1/1) |
| complete-todo | `.shapeup/todo-cli/t0/verdicts/r2-a1-t5.json` | `33b9973ffae96696d7c3af49cda4c1fc429ba8f0a7a813155b9a1042ebc0841c` | green (1/1) |
| cli-integration-test | `.shapeup/todo-cli/t0/verdicts/r2-a1-t6.json` | `d356ff61089656b2aa7020e62261c1e91b848f93024f06028a59d6bb3ede6554` | green (1/1) |

All six scopes are green at T0. **Green T0 fixtures did not prevent five spec violations** — the
committed fixtures encode the implementation's own error strings and step ordering, not the
`ux-behavior#Error-Catalog` text or the UC `## Steps` order. The judge grades the committed spec.

> Note: the prior round-2 report on disk cited a different scope→artifact mapping and different
> hashes for the same filenames. This report's hashes are the ones recomputed from disk now.

## Probe method

`bin/todo.js` executed as a real process for every criterion, with `HOME` pointed at a fresh
`mktemp -d` per probe group so the store resolves to an isolated `$HOME/.todo.json`
(`lib/todo-repository.js:32`) and the operator's real store is never touched. Store state was
inspected with `cat` and compared with `shasum -a 256` before/after for every invariant. Write
failures were forced with `chmod 0400` on the store file; read failures with `chmod 0000`.
Plain-text (Non-Go) checks used `od -c` on raw stdout.

---

## Criteria — dimension `spec-conformance`

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

## Stability block

| Criterion | r1 | r2 | Note |
|---|---|---|---|
| UC-AddTodo `E_STORE_WRITE_FAILED` — no bare stack trace | FAIL | **PASS** | **Flip** → confidence forced to `low`. `repo.save()` in `cmdAdd` is now wrapped (`bin/todo.js:28-34`) and a `chmod 0400` store yields `Error: could not save todo store: EACCES…`, exit 1. Re-probed; stable within this run, but the flip against a round the trial log reports as `delta: "no change"` means the ledger and the trial log disagree about what moved. |
| `E_MISSING_INDEX` / `E_INVALID_INDEX` / `E_INDEX_OUT_OF_RANGE` messages | FAIL | FAIL | Narrowed, not fixed: the `done` path now emits the exact catalog strings; the `rm` path still prefixes the error code. |
| UC-CompleteTodo / UC-RemoveTodo step ordering | FAIL | FAIL | Unchanged. |

Every FAIL above was re-probed once and reproduced identically → confidence `high`.

---

## Bugs

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

## Spec defects surfaced (block a clean PASS if not resolved)

- **SD-1 — success-message quoting is specified two ways.** `ux-behavior#done-command` /
  `#rm-command` state `Done: N) <text>` and `Removed: N) <text>` (unquoted), while
  `UC-CompleteTodo`/`UC-RemoveTodo` `## System Flow` show `Done: "2) buy milk"` and
  `Removed: "2) buy milk"` (quoted). The build emits the quoted form
  (`bin/todo.js:89`, `bin/todo.js:121`). Not graded as a FAIL because the committed spec
  contradicts itself; pick one form and make the other match.
- **SD-2 — corrupted-store message path rendering.** The catalog writes the path literally as
  `~/.todo.json`; the build interpolates the absolute resolved path
  (`lib/todo-repository.js:50,54`). Graded PASS (message text otherwise identical), but the
  spec should say whether the literal `~` or the resolved path is intended.

---

## NEXT ACTION

Round 3, scopes `remove-todo` (BUG-2, BUG-3) and `complete-todo` (BUG-1), plus a one-line touch
in `add-todo` (BUG-4). Three edits total, all in `bin/todo.js`:

1. `cmdDone` / `cmdRm`: validate presence + integer form of `args[0]` **before** `repo.load()`;
   keep the range check after the load (it needs `items.length`).
2. `bin/todo.js:106`: drop the `${err.code} - ` prefix.
3. `bin/todo.js:12`: drop the ` (E_MISSING_TEXT)` suffix.

Then extend the committed fixtures so they assert the **catalog strings and the corrupted-store +
missing-index ordering** — the current fixtures went green through all five violations, which is
the reason two rounds of green T0 produced a FAIL verdict.
