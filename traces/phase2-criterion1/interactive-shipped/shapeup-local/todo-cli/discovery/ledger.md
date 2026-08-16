---
feature: todo-cli
---
# Discovery Ledger — todo-cli

## Discovered — todo-cli/orient (2026-08-16)
+ [ORIENT] Corrupted-store error must surface as a clean CLI error, not a raw traceback — the dispatcher needs to catch the domain RuntimeError and print + exit non-zero.
+ [ORIENT] Wrong-shape JSON (valid JSON, non-list root) is a corruption variant not named in the intake; spike confirms it should share the same 'corrupted store' error path/AC as invalid JSON rather than a separate use case.
+ [ORIENT] done <n> / rm <n> index semantics (1-based vs 0-based, behavior on out-of-range or non-integer <n>) need an explicit BA decision and AC, not just 'doesn't crash'.
+ [ORIENT] Default store path chosen in the spike is ~/.todo.json (os.path.expanduser) — the intake only says 'a sensible default'; BA/PO should confirm before it's load-bearing in the wiring map.
~ [ORIENT] Atomic-write approach (tempfile.mkstemp + os.replace) is a save-path implementation detail worth naming in the wiring map so a future edit doesn't regress to a non-atomic open(path, "w"); not directly black-box assertable so not a Test Surface row.

## Discovered — todo-cli/gate-L1a.5 (2026-08-16)

<!-- Filed by tech-lead at GATE L1a.5, on the PO's decision — not by a dispatched worker, so it
     arrived through no WorkResult and `reduce ingest` did not write it. Recorded in its own
     section so the per-flow sectioning invariant holds and the provenance is not disguised. -->

+ [GATE-L1a.5] Store-path resolution has no Test Surface coverage for its fallback branch. All 14 derived rows seed $TODO_STORE, so an implementation reading only os.environ["TODO_STORE"] scores 14/14 on test-surface-conformance and still raises KeyError for any real user who never sets the variable. The resolution order is specified in six places (domain-model#StorePath, all four UC Step 1, integration) and asserted in none. Assert the second half of it as a new invariant.
    repro: HOME=<tmpdir> env -u TODO_STORE python3 bin/todo add "x" → expect exit 0 and the store created at $HOME/.todo.json (never at the developer's real ~/.todo.json)
    test-gap: true
    traces_to: UC-AddTodo, domain-model#StorePath, integration#Environment-Variables-Required

## Discovered — todo-cli/hunt (2026-08-16)
~ [lens:①boundary] [QA-001] [UC-ListTodos] `todo list` piped to a fast-closing reader (e.g. `| head`) crashes with an uncaught BrokenPipeError traceback instead of exiting cleanly
    repro: 1. TODO_STORE=$S python3 bin/todo add "$(python3 -c "print('A'*100000)")"
2. TODO_STORE=$S python3 bin/todo list | head -c 50 >/dev/null
3. stderr shows: Traceback ... File "todo/commands.py", line 21, in list_ ... BrokenPipeError: [Errno 32] Broken pipe
    severity-hint: ux-degradation
    test-gap: exploratory-only
~ [lens:①boundary] [QA-002] [UC-AddTodo] Empty-string and whitespace-only <text> are accepted silently by `add`, contradicting domain-model's claim that non-empty is 'enforced by the CLI's required positional arg'
    repro: 1. TODO_STORE=$S python3 bin/todo add "" -> exit 0, stdout 'added #1: '
2. TODO_STORE=$S python3 bin/todo add "   " -> exit 0, stdout 'added #2:    '
3. TODO_STORE=$S python3 bin/todo list shows two visually-blank rows
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-AddTodo] Todo text starting with '-' collides with argparse's own flag parsing instead of being taken verbatim; error messages leak argparse internals to the user
    repro: 1. TODO_STORE=$S python3 bin/todo add -x -> exit 2, "the following arguments are required: text" (real text silently rejected)
2. TODO_STORE=$S python3 bin/todo add "-high priority: fix bug" -> exit 2, "argument -h/--help: ignored explicit argument 'igh priority: fix bug'"
3. Workaround `todo add -- "-text"` works but is undocumented in --help
    severity-hint: ux-degradation
    test-gap: exploratory-only
~ [lens:①boundary] [QA-004] [domain-model#StorePath] An explicitly-set but EMPTY $TODO_STORE silently falls back to ~/.todo.json instead of being used verbatim or rejected -- confirms the lead flagged in this order's payload
    repro: 1. rm -rf $FAKEHOME; mkdir -p $FAKEHOME
2. TODO_STORE="" HOME=$FAKEHOME python3 bin/todo add "x" -> exit 0
3. $FAKEHOME/.todo.json is created and contains the item -- TODO_STORE="" behaved identically to TODO_STORE unset. Root cause: todo/store.py:18 uses `if env_val:` (truthiness) not `if env_val is not None:`. Any caller whose computed TODO_STORE ever evaluates to "" -- including this harness's own `TODO_STORE=<throwaway path>` convention, if that path is ever empty -- silently writes to the developer's REAL ~/.todo.json instead of erroring.
    severity-hint: data-integrity
    test-gap: unit
~ [lens:①boundary] [QA-005] [domain-model#TodoStoreRepository] Store-path I/O errors below the JSON-parse layer (missing parent directory, path is a directory, unwritable directory) escape as raw uncaught Python tracebacks instead of the app's uniform 'error: ...' / exit-1 pattern
    repro: 1. TODO_STORE=/no/such/dir/store.json python3 bin/todo add x -> FileNotFoundError traceback (todo/store.py:44, tempfile.mkstemp), exit 1
2. mkdir $D; TODO_STORE=$D python3 bin/todo add x (or list) -> IsADirectoryError traceback (todo/store.py:32, open(path)), exit 1
3. mkdir $D2; chmod 555 $D2; TODO_STORE=$D2/store.json python3 bin/todo add x -> PermissionError traceback (todo/store.py:44), exit 1
All three bypass StoreCorruptedError's clean handling.
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-006] [domain-model#TodoStoreRepository] The first write through a symlinked $TODO_STORE silently replaces the symlink itself with a regular file, permanently orphaning whatever it used to point to
    repro: 1. echo '[{"text":"original via real file","done":false}]' > real.json
2. ln -s real.json link.json
3. TODO_STORE=link.json python3 bin/todo add "added via symlink" -> exit 0
4. ls -la link.json now shows a regular file, not a symlink; `file link.json` reports 'JSON data'
5. cat real.json still shows only the original 1-item content -- forever stale, since link.json no longer points to it. Root cause: save() calls os.replace(tmp, path) where path is the symlink -- rename(2) replaces the directory entry itself rather than following the link.
    severity-hint: data-integrity
    test-gap: exploratory-only
~ [lens:①boundary] [QA-007] [domain-model#TodoStoreRepository] A store file chmod'd read-only (444) provides no protection -- `add` still succeeds and silently downgrades the file's permission bits to 600 as a side effect of the atomic tempfile+rename write
    repro: 1. TODO_STORE=$S python3 bin/todo add seed
2. chmod 444 $S (now -r--r--r--)
3. TODO_STORE=$S python3 bin/todo add "second item" -> exit 0, no warning
4. ls -la $S now shows -rw------- (600) -- the user's explicit read-only protection is gone and the write succeeded despite it
    severity-hint: data-integrity
    test-gap: exploratory-only
~ [lens:②concurrency] [QA-008] [domain-model#TodoList] Concurrent `add` invocations on one store race (unlocked read-modify-write) and silently lose items -- every invocation still reports success
    repro: 1. rm -f $S
2. Launch 20 `TODO_STORE=$S python3 bin/todo add "item-$i"` processes in the background simultaneously (for i in 1..20 & ... ; wait)
3. python3 -c "import json; print(len(json.load(open('$S'))))" -> observed 17, not 20 (3 items silently lost); every one of the 20 invocations exited 0 and printed 'added #n: ...'. Root cause: load() then append then save() has no locking, so two concurrent processes' save() calls can each write a full list computed from a stale load(), and the later os.replace() clobbers the earlier one's addition.
    severity-hint: data-integrity
    test-gap: integration
~ [lens:⑥residue] [QA-009] [domain-model#TodoItem / todo/commands.py:19] The `done` field is read with Python truthiness, not JSON-boolean semantics -- a store with "done": "false" (a string) displays as done
    repro: 1. echo '[{"text": "should show as NOT done", "done": "false"}]' > $S
2. TODO_STORE=$S python3 bin/todo list -> prints '1. [x] should show as NOT done' (marker = "x" if item["done"] else " ", and the non-empty string "false" is truthy in Python)
    severity-hint: data-integrity
    test-gap: unit
~ [lens:⑥residue] [QA-010] [domain-model#TodoStoreRepository] StoreCorruptedError's shape check only validates that the JSON root is a list -- a list element missing a required key ('text' or 'done') is not caught as corruption and instead crashes with a raw uncaught KeyError traceback
    repro: 1. echo '[{"text": "no done field"}]' > $S; TODO_STORE=$S python3 bin/todo list -> KeyError: 'done' traceback at todo/commands.py:19, exit 1 (not the uniform 'error: corrupted store at ...' message)
2. echo '[{"done": false}, {"text": "second", "done": false}]' > $S; TODO_STORE=$S python3 bin/todo rm 1 -> KeyError: 'text' traceback at todo/commands.py:52, exit 1
    severity-hint: ux-degradation
    test-gap: unit
