---
type: qa-hunt-report
feature: todo-cli
round: 2
date: 2026-08-16
worker: qa-edge-hunter
order_id: todo-cli/hunt
---

# Hunt Report — todo-cli (round 2, 2026-08-16)

App under test: `bin/todo` — a Python 3 stdlib-only CLI, driven as a subprocess with
`TODO_STORE=<throwaway path> python3 bin/todo <add|list|done|rm> [args]`. Not a web app; no
`app_url`, no browser. GATE Q0 preflight: app reachable (one real `add` + `list` invocation
succeeded), EVAL-FEATURE-todo-cli.md verdict is PASS (31/31 criteria, round 2), ledger exists
and its `feature: todo-cli` matches. All four `usecases/UC-*.md` files carry a populated
`## Test Surface` — **not degraded mode**.

charters: 13/13 run · session units spent: 13 (2 compound charters — C-06, C-10 — each bundled
several closely related sub-probes under one mission)
out of bounds (excluded): none identified — a local, stdlib-only, single-user CLI writing to a
throwaway `$TODO_STORE` file has no payments/email/production-data surface to exclude. (Order was
dispatched non-interactively — `interaction.pause_gates: false` — so this is the Hunter's own
call, stated here for visibility rather than confirmed by a human at GATE Q0.)
hammered out at GATE Q1 (not hunted): none — order was non-interactive (`pause_gates: false`),
so GATE Q1 charter review did not pause; all 13 drafted charters ran as-is.

## Findings by lens
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

## Shaping-quality signal (advisory, for the PO — next cycle's input)
- Lens ① dominates the findings (8/10) — the `StorePath` and `TodoStoreRepository` contracts
  are precise about the two corruption cases the app explicitly handles (invalid JSON,
  non-list root) but silent on everything else that can go wrong at or below the filesystem
  boundary (unwritable/missing dirs, symlinks, permissions, empty-string env var, malformed
  list *elements*, unbounded output size). That silence is exactly where QA-001, 004, 005,
  006, 007, and 010 live — a shaping-time decision ("what does StorePath/TodoStoreRepository
  do when X") would have converted most of these into Test Surface rows instead of exploratory
  finds.
- QA-008 (lens ②) is the sharpest one: the domain model states a `TodoList` aggregate
  invariant ("a save always persists the FULL current item set") but the aggregate has no
  concurrency contract at all — appetite-wise this may be an accepted risk for a single-
  developer local tool, but it should be an explicit Non-Go, not silent.
- Lens ④ and ⑤ turned up nothing — UC decomposition and the No-Go boundaries (argparse's
  own dispatch) are both holding up well; no shaping-quality signal there.

## Session notes
- **C-01** [①] unicode/emoji + very-long single item (100k chars) for `add`: no issue on
  write. `list` on a store containing that item, when piped to a fast-closing reader, produced
  the QA-001 traceback — reproduced twice, clean.
- **C-02** [①] `add ""` and `add "   "`: both silently accepted, exit 0 → QA-002.
- **C-03** [①] numeric index edge forms for `done`/`rm`: tried `+1`, `01`, `1.0`,
  `999999999999999999999999999999`, `-1`, `" 1"`, `"1 "`, `"0x1"`. All behaved exactly as
  Python's `int()` would predict (leading `+`, leading zeros, and surrounding whitespace
  accepted as valid; floats/hex/out-of-range rejected cleanly, no crash even on a 30-digit
  integer). **No finding** — permissive but internally consistent, no contract violated.
- **C-04** [①] `add -x`, `add --help`, `add -- --foo`, `add "-1 buy milk"`,
  `add "-high priority: fix bug"`: mixed results — negative-number-shaped dash text was
  accepted (argparse's own negative-number heuristic), but non-numeric dash-prefixed text
  either got rejected outright or collided with `-h/--help`'s abbreviation matching → QA-003.
- **C-05** [①] the flagged lead: `TODO_STORE=""` with a fresh `$HOME` → confirmed, writes to
  `$HOME/.todo.json`, not to any file at the empty path → QA-004.
- **C-06** [①] compound charter, five sub-probes against `StorePath`/`TodoStoreRepository`:
  nonexistent parent dir (FileNotFoundError traceback), store path is an existing directory
  (IsADirectoryError traceback on both `add` and `list`), unwritable parent dir
  (PermissionError traceback) — all three folded into QA-005 as one root cause (no handling
  beyond `StoreCorruptedError`/`ValueError`). Read-only (444) store file → QA-007. Symlinked
  store path → QA-006 (verified with a pre-existing, non-empty symlink target to show the
  orphaning clearly, not just an empty-target case).
- **C-07** [②] 20 concurrent `add` processes backgrounded and `wait`ed against one fresh
  store → 17/20 items survived, no process reported an error → QA-008. Re-run once more to
  confirm the race is real and not a one-off (item count varied trial to trial but was
  consistently less than 20).
- **C-08** [④] duplicate item text (add "buy milk" twice, `done 1`, verify #2 untouched);
  add→done→rm→re-add same text; interleaved add/rm/add reindexing (a,b,c → rm 2 → add d →
  a,c,d). **No finding** — all isolation and reindexing correct across every chain tried.
- **C-09** [⑤] extra positional arg (`add "text" "extra"` → clean argparse rejection, exit 2),
  unknown subcommand (`bogus` → clean rejection), no subcommand at all (clean rejection), and
  a `< /dev/null` check that `list` never blocks waiting on stdin. **No finding** — argparse's
  own dispatch boundary holds.
- **C-10** [⑥] compound charter: extra unexpected keys in list elements round-trip untouched
  (no finding, graceful). Wrong-typed `done` (string `"false"`) → QA-009, the sharpest single
  finding of the hunt (a `\[x\]` marker printed for an item whose stored value literally reads
  "false"). Missing required keys (`"done"` or `"text"` absent from an element) → QA-010,
  crashes `list` and `rm` respectively with raw `KeyError` tracebacks.
- **C-11** [⑥] byte-stability: hashed + `stat`'d the store file before and after three
  rejected `done`/`rm` calls (`done 99`, `rm 0`, `done abc`). SHA-256 and mtime both matched
  exactly. **No finding** — confirms the store is genuinely byte-stable on rejection, as the
  spec implies.
- **C-12** [①] 50,000-item store (≈1.9 MB), one more `add`: completed in ~0.2s, correct
  `added #50001`, no crash. **No finding** — no practical size ceiling within this hunt's
  time box.
- **C-14** [③] attempted to `SIGKILL` an `add` process mid-write (80MB text item, 30ms delay
  before `kill -9`, five attempts) to check whether atomicity holds under a real interruption
  rather than only via the code's own `try`/`except`. Every attempt left the store unchanged
  and still valid JSON, with no orphaned tmp files visible — but the timing window may simply
  have been missed each time (kill landing either before `mkstemp()` or after `os.replace()`
  rather than mid-write). **No repro obtained → logged as an unconfirmed observation, not a
  finding**, per the "charter exhausted time with open scent" rule. A future hunt with tighter
  timing control (e.g. instrumenting a deliberate delay in a patched copy of `save()`) could
  settle this properly; it is not filed to the ledger.

✅ hunt complete — 10 findings (all `~`) → ledger · triage at SHIP S.0 / GATE L4.
