---
type: ship-report
feature: todo-cli
date: 2026-08-16
verdict: pass
rounds_used: 3
qa: run
intake_sha256: ee86f87135d2d5efb42cce1bb629247b8a3a5b880236b15006d227d198de21d8
---

# todo-cli — ship report

Frozen at GATE L4. Every figure below is derived from run artifacts on disk — the trial
ledger, the verdict artifacts, the board — never from a summary of the run.

## Outcome

| | |
|---|---|
| Verdict | **pass** |
| Rounds used | 3 |
| Board | 7/7 tasks done |
| T0 artifacts | 10 |
| QA | run |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| scope-cli-core | 11/11 | 0 | 8 | kept | no change |
| scope-integration-test | 1/1 | 0 | 2 | kept | no change |

## Ratchet

Measured over this run's trial ledger. A monotone series is a ratchet working; a flat or
sawtooth series says the loop is still a budgeted retry loop wearing a ratchet's shape.

| | |
|---|---|
| Trials | 10 across 2 scope(s), 2 with more than one attempt |
| Improvement rate | 0.5 — kept ÷ trials after the first |
| Monotone rate | 0.5 — multi-trial scopes whose score never decreased |
| Sawtooth count | 1 — a revert immediately after a keep |
| Mean trials to green | 3 |
| Statuses | kept 6, reverted 3, rebased 1 |

## Evaluation

| id | criterion | verdict | evidence |
|----|-----------|---------|----------|
| UC-AddTodo Steps 1-6 | `add <text>` appends, prints `added #n: text`, exit 0 | PASS | live re-probe: `add a; add b` → stdout `added #1: a` / `added #2: b`; store = `[{"text":"a","done":false},{"text":"b","done":false}]` |
| UC-AddTodo TS-REQ-text-missing | missing `<text>` rejected cleanly | PASS | live re-probe: `todo add` (no arg) → exit 2, argparse usage error, no traceback, no store file created |
| UC-AddTodo Error Cases | corrupted store → `error: corrupted store at <path>`, exit 1 | PASS | live re-probe, all 3 corruption shapes × `add` |
| UC-AddTodo INV-05 | `$TODO_STORE` unset falls back to `~/.todo.json` | PASS | live re-probe (see Regression focus above) |
| UC-ListTodos Steps 1-5 | numbered `[ ]`/`[x]` list, `(no items)` when empty | PASS | live re-probe: 2-item store → `1. [ ] a` / `2. [ ] b`; fresh path → `(no items)` |
| UC-ListTodos TS-NOGO-01 | no ANSI escapes | PASS | live re-probe: `cat -v` on list output, no `^[[` sequences |
| UC-ListTodos Error Cases | corrupted store → uniform error | PASS | live re-probe, all 3 corruption shapes × `list` |
| UC-CompleteTodo Steps 1-8 | `done <n>` marks done, prints `done #n: text`, exit 0 | PASS | live re-probe: 3-item store, `done 2` → `done #2: b` |
| UC-CompleteTodo INV-02 | isolation of other items | PASS | live re-probe: after `done 2` on a 3-item store, item 1 and item 3's text/done byte-identical to seed, count/order unchanged |
| UC-CompleteTodo Error Cases + TS-REQ-n-boundary | `0/3/abc` rejected, `1/2` accepted, exact text | PASS | live re-probe: `done 0/1/2/3/abc` on 2-item store → 0/3/abc rejected (exact `error: no item N (list has K items)` / `error: invalid item number 'X'`), 1/2 accepted |
| UC-RemoveTodo Steps 1-8 | `rm <n>` removes, prints `removed #n: text`, exit 0 | PASS | live re-probe: `rm 1` on 2-item store → `removed #1: a`, store now `[{"text":"b","done":false}]` |
| UC-RemoveTodo INV-03 | reindex + isolation | PASS | live re-probe: 3-item store, `rm 2` → `removed #2: b`, `list` → `1. [ ] a` / `2. [ ] c` |
| UC-RemoveTodo Error Cases + TS-REQ-n-boundary | boundary rejection, exact text, no write | PASS | live re-probe: `rm 0/3/xyz` rejected (count stays 2), `rm 1` accepted (count → 1) |
| domain-model repository contract | `load()` returns `[]` on missing; `save()` full-list atomic; extra unknown keys on elements tolerated (not rejected) | PASS | live re-probe: nonexistent path → `[]`/`(no items)`; store with extra keys (`priority`, `extra`) on an element round-trips and lists fine, not treated as corruption |
| Non-Go: no TUI/colors/prompts | plain text only | PASS | live re-probe `cat -v` clean; no stdin read attempted |
| Non-Go: stdlib-only | no third-party deps | PASS | `bin/todo`, `todo/store.py`, `todo/commands.py` import only `argparse`/`json`/`os`/`sys`/`tempfile` |

### Refuted criteria and bugs

None blocking. See "Non-blocking observation" above for the one spec-staleness note (not filed as a
bug — no `file:line` defect, no failing criterion).

## QA findings

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary overflow | C-01, C-02, C-03, C-04, C-05, C-06, C-12 | 8 (QA-001..QA-007, plus QA-004 = the flagged lead) | 0 |
| ② Concurrency | C-07 | 1 (QA-008) | 0 |
| ③ State interruption | C-14 | 0 (open scent, no repro obtained) | 0 |
| ④ Cross-UC journey | C-08 | 0 | 0 |
| ⑤ No-go probing | C-09 | 0 | 0 |
| ⑥ Data residue | C-10, C-11 | 2 (QA-009, QA-010) | 0 |

**10 confirmed findings total**, all filed `~` to the discovery ledger via this order's
`discoveries[]` (ingest appends them under `## Discovered — todo-cli/hunt`). Full details,
repro steps, and severity hints live in the WorkResult
(`.shapeup/todo-cli/results/hunt.json`) and, after ingest, in
`.shapeup/todo-cli/discovery/ledger.md`.

Summary (severity hints are advice for PO/TL triage at SHIP S.0 / GATE H — none are promoted
here):
- **QA-001** [①] `todo list` piped to a fast-closing reader (e.g. `| head`) crashes with an
  uncaught `BrokenPipeError` traceback — *ux-degradation*
- **QA-002** [①] Empty-string / whitespace-only `<text>` is silently accepted by `add`,
  contradicting the domain model's "non-empty enforced by the CLI" claim — *boundary-breach*
- **QA-003** [①] Todo text starting with `-` collides with argparse's own flag parsing instead
  of being taken verbatim; error messages leak argparse internals — *ux-degradation*
- **QA-004** [①] An explicitly-set but EMPTY `$TODO_STORE` silently falls back to
  `~/.todo.json` instead of being used verbatim — **confirms the flagged lead** — *data-integrity*
- **QA-005** [①] Store-path I/O errors below the JSON layer (missing parent dir, path is a
  directory, unwritable dir) escape as raw uncaught tracebacks instead of the app's uniform
  `error: ...` pattern — *ux-degradation*
- **QA-006** [①] The first write through a symlinked `$TODO_STORE` silently replaces the
  symlink with a regular file, permanently orphaning whatever it pointed to — *data-integrity*
- **QA-007** [①] A store file `chmod`'d read-only (444) provides no protection — `add` still
  succeeds and silently downgrades the file to mode 600 — *data-integrity*
- **QA-008** [②] Concurrent `add` invocations on one store race (unlocked read-modify-write)
  and silently lose items — 20 concurrent adds left only 17 items, no error reported —
  *data-integrity*
- **QA-009** [⑥] The `done` field is read via Python truthiness, not JSON-boolean semantics —
  a store with `"done": "false"` (a string) displays as done — *data-integrity*
- **QA-010** [⑥] `StoreCorruptedError`'s shape check only validates the JSON root is a list —
  a list element missing a required key ("text"/"done") crashes with a raw `KeyError`
  traceback instead of the uniform corrupted-store error — *ux-degradation*

## Discovered, not built

+ [ORIENT] Corrupted-store error must surface as a clean CLI error, not a raw traceback — the dispatcher needs to catch the domain RuntimeError and print + exit non-zero.
+ [ORIENT] Wrong-shape JSON (valid JSON, non-list root) is a corruption variant not named in the intake; spike confirms it should share the same 'corrupted store' error path/AC as invalid JSON rather than a separate use case.
+ [ORIENT] done <n> / rm <n> index semantics (1-based vs 0-based, behavior on out-of-range or non-integer <n>) need an explicit BA decision and AC, not just 'doesn't crash'.
+ [ORIENT] Default store path chosen in the spike is ~/.todo.json (os.path.expanduser) — the intake only says 'a sensible default'; BA/PO should confirm before it's load-bearing in the wiring map.
~ [ORIENT] Atomic-write approach (tempfile.mkstemp + os.replace) is a save-path implementation detail worth naming in the wiring map so a future edit doesn't regress to a non-atomic open(path, "w"); not directly black-box assertable so not a Test Surface row.

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
