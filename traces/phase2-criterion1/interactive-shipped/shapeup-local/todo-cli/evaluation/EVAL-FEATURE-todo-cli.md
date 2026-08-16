---
type: eval-report
feature: todo-cli
task: FEATURE
verdict: pass
dimensions_run: [spec-conformance, test-surface-conformance]
dimensions_ignored: []
bug_count: 0
browser_mode: cli
evaluator: spec-evaluator v0.1
eval_at: 2026-08-16
round: 3
linked_docs: ["[[usecases/UC-AddTodo]]", "[[usecases/UC-ListTodos]]", "[[usecases/UC-CompleteTodo]]", "[[usecases/UC-RemoveTodo]]", "[[domain-model]]", "[[contracts/todo-store.contract.md]]", "[[scope-summary]]"]
t0_citation:
  - scope_id: scope-cli-core
    artifact: .shapeup/todo-cli/t0/verdicts/r3-a2-t1.json
    sha256: 71ac331d04c1e2458c1b213d7613e582f568920f10b6467633d343933fa2d4ba
  - scope_id: scope-integration-test
    artifact: .shapeup/todo-cli/t0/verdicts/r2-a1-t2.json
    sha256: 3ff702d46723d4e656f1052f42a7786ae04ff0216d7022e36cf9512b6e3397d4
---

## OVERALL: PASS — spec-conformance and test-surface-conformance both green. 0 blocking bugs, 1 non-blocking observation.

Run command: `TODO_STORE=<throwaway path> python3 bin/todo <subcommand> [args]`.

Round 3 is a re-grade after a fix round: post-PASS QA hunt found 10 issues (`.shapeup/todo-cli/qa/hunt-report.md`), the PO promoted 4 to must-fix (QA-001 BrokenPipeError, QA-004 empty-`$TODO_STORE`, QA-005 raw OS-error tracebacks, QA-010 malformed store element), and `task-executor` changed `bin/todo` and `todo/store.py` to close them (`todo/commands.py` and `tests/test_integration.py` confirmed untouched by mtime: 17:22 / 17:26 vs. `bin/todo`/`store.py` at 18:18). Round 2's PASS was **not** taken on trust — every criterion below was independently re-probed against the CURRENT running binary, not re-cited from round 2.

Both T0 artifacts were re-hashed from disk and match the citations above: `r3-a2-t1.json` (scope-cli-core, latest of two round-3 attempts, both identical 11/11 fixtures green — fixtures 1-7 are the original scope, fixtures 8-11 newly encode QA-001/004/005/010) and `r2-a1-t2.json` (scope-integration-test — carried forward unchanged since `tests/test_integration.py` was not touched this round; re-ran it directly: `python3 -m unittest tests.test_integration` → 10/10 pass, matching the T0 fixture).

## Regression focus (round 3's actual job)

**INV-05 / TS-INV-05 (unset `$TODO_STORE` fallback) — no regression.** Live re-probe:
`env -u TODO_STORE HOME=$H python3 bin/todo add "x"` → exit 0, `$H/.todo.json` created with the
item; followed with `list`/`done 1`/`list` against the same fallback path — all worked correctly.
The QA-004 fix (distinguishing unset from set-but-empty in `todo/store.py:22-27`) did not touch the
unset branch's logic (`env_val is None` → default path), and live testing confirms it still works
identically to round 2.

**Uniform corrupted-store contract — no regression, and the new QA-010 case matches the existing two exactly.** Live-probed all three corruption shapes (invalid JSON, valid-JSON-non-list-root, valid-JSON-list-with-an-element-missing `text` or `done`) against all four commands (`list`, `add`, `done`, `rm`) = 12 combinations. Every one produced exit 1, stderr exactly `error: corrupted store at <path>`, no traceback, and the store file byte-unchanged (sha256 verified before/after a rejected `add` on a corrupted store). The message is reconstructed independently in `bin/todo:47` from the resolved `path` variable, not from the exception's internal text, so `todo/store.py`'s new richer internal message (`f"corrupted store at {path}: {e}"`, `store.py:48`) never leaks to stderr — format is unchanged.

**Exact stdout/exit-code contract — no regression.** Re-verified `added #n: <text>`, `done #n: <text>`, `removed #n: <text>`, `1. [x] `/`1. [ ] ` markers, `(no items)`, `error: no item N (list has K items)`, `error: invalid item number 'X'`, 1-based indexing, and exit 1 for every domain error — all byte-exact against the current binary.

## spec-conformance — PASS (threshold: all-pass, 16/16)
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

## test-surface-conformance — PASS (threshold: all Test Surface rows pass, 15/15)
All 15 committed Test Surface rows across UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo
(TS-INV-01..05, TS-ERR-* ×6, TS-REQ-* ×3, TS-NOGO-01) — PASS. The committed spec's Test Surface
tables are unchanged since round 2 (spec folder is frozen substrate this round); every row was
independently live re-probed against the current binary (not re-cited from round 2's conclusions)
and cross-checked against T0 `r3-a2-t1.json` (11/11 fixtures green — fixtures 1-7 map 1:1 to the
original 7 rows/dispatch checks, fixture 7 is the TS-INV-05 unset-fallback check). Fixtures 8-11 are
additional QA-fix regression checks (QA-001 BrokenPipeError, QA-004 empty-store, QA-005 I/O errors,
QA-010 malformed element) — not themselves committed Test Surface rows (no `TS-*` id exists for them
in the frozen spec), so they are cited as supporting build-verification evidence, not counted toward
the 15/15 committed-row total. No regressions, no flips vs. round 1/round 2.

## Non-blocking observation (spec staleness, not a bug)
`domain-model.md`'s `StorePath` VO invariant reads: *"Resolution order is exactly: `$TODO_STORE`
verbatim when set; else `os.path.expanduser("~/.todo.json")`. No third path branch."* The QA-004 fix
(`todo/store.py:22-27`) adds a third, distinct behavior for a **set-but-empty** `$TODO_STORE`: it now
raises a clean `error: $TODO_STORE is set but empty` (exit 1) instead of using `""` "verbatim" (which
would itself have been a nonsense path) or silently falling back to the real `~/.todo.json` (round 1/2's
actual bug, per QA-004's repro). No committed Test Surface row exercises this exact case — TS-INV-05
only covers *unset*, not *set-but-empty* — so this doesn't fail any graded criterion, and the new
behavior is strictly safer than round 1/2's (which also technically violated the same "no third branch"
text, just silently). Flagging per the anti-leniency rule that an untestable/ambiguous criterion is a
spec defect to surface: recommend `domain-model.md` be updated in a future cycle to document the
set-but-empty case as an explicit third resolution outcome (reject) rather than leaving the VO
invariant text stale against intentional, PO-directed behavior.

## Verdict stability (round 3)
Round 1 (`.verdicts-evaluate-r1.jsonl`, 31 rows) and round 2 (`.verdicts-evaluate-r2.jsonl`, 31 rows)
both recorded every spec-conformance + test-surface-conformance criterion PASS/high-confidence.
Round 3 independently re-probes the same 31 criteria against the CURRENT (post-fix) code — all still
PASS, all high confidence, no flips. The 4 QA fixes changed `bin/todo` and `todo/store.py` but did not
regress any previously-passing criterion; the one area with real regression risk (INV-05's unset
fallback, sitting right next to the QA-004 empty-string fix in the same function) was explicitly
re-verified live and holds.

## Bugs
None blocking. See "Non-blocking observation" above for the one spec-staleness note (not filed as a
bug — no `file:line` defect, no failing criterion).

## Next action
→ FEATURE todo-cli remains PASS at round 3 against [spec-conformance, test-surface-conformance],
  31/31 criteria, re-verified against the current post-fix code (not round 2's stale conclusions).
  No regressions from the QA-001/004/005/010 fixes. Safe to proceed to SHIP / GATE H.
