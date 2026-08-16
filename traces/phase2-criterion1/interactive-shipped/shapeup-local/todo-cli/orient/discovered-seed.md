# Discovered-task seed — todo-cli orient

Feeds `.shapeup/todo-cli/discovery/ledger.md` (Orient's contribution; task-executor and QA add
their own sections later). None of these are use cases yet — they're candidate Test Surface
rows / design notes for BA to fold into `add`/`list`/`done`/`rm` use cases, or discard.

1. **Corrupted-store error message must be user-facing, not a raw traceback.** The spike raises
   a domain `RuntimeError` on both invalid JSON and wrong-shape JSON; the CLI's top-level
   dispatch needs to catch this and print a clean one-line error + non-zero exit rather than
   letting it propagate as an unhandled Python traceback. Worth its own Test Surface row —
   the intake explicitly says "a CLI that crashes on a typo is worse than no CLI."

2. **Wrong-shape JSON (valid JSON, non-list root) is a corruption variant the intake doesn't
   name explicitly but a hand-edited store file can produce.** Confirmed in the spike that it's
   cheap to fold into the same error path as invalid JSON. Recommend BA cover it under the same
   "corrupted store" use case/AC rather than treating it as a separate scenario, to avoid
   scope creep beyond the pitch's appetite.

3. **`done <n>` / `rm <n>` index semantics need a decision BA should make explicit:** 1-based
   vs 0-based indexing for the user-facing `<n>`, and what happens on out-of-range /
   non-integer `<n>` (the pitch says "bad index" must behave sanely — worth an explicit AC on
   the exact error text and exit code, not just "doesn't crash").

4. **Default store path chosen in the spike is `~/.todo.json`** (via `os.path.expanduser`).
   This wasn't specified in the intake beyond "a sensible default" — flagging so BA/PO can
   confirm or override before it's load-bearing in the wiring map.

5. **Atomic-write approach (`tempfile.mkstemp` + `os.replace`) is a save-path implementation
   detail, not directly observable via CLI output — no user-facing AC can assert on it
   directly.** Worth a code-level note in the wiring map so a future edit doesn't silently
   regress to a non-atomic `open(path, "w")`, but not a Test Surface row (nothing to black-box
   assert).
