# Spike — store persistence (load/save, corruption, env override)

## Why this is the riskiest area

The pitch's hard constraint is "must behave sanely at the edges — empty list, bad index, a
corrupted store file" and "the store path must come from `$TODO_STORE` when set, falling back
to a sensible default otherwise." Everything else in the CLI (`add`/`list`/`done`/`rm`) is
straightforward argparse dispatch over an in-memory list; the one place a stdlib-only, zero-dependency
implementation could plausibly fail or need a design decision is the store file itself:
JSON parse failures, wrong-shape JSON, and atomic writes so a crash mid-save can't corrupt the
file worse than it already was. This is also the property the intake calls out explicitly as
"a real constraint, not a detail" (sandboxability via `$TODO_STORE`), so getting the resolution
order and failure modes right up front avoids rework once use cases are written against it.

## What was run

Real Python 3.10.16 (the pinned interpreter), stdlib only. Script:
`/tmp/todo-spike/spike_store.py` (throwaway, not committed — orient's substrate is
`.shapeup/todo-cli/orient/**` only, no production code written).

```python
def default_store_path():
    return os.environ.get("TODO_STORE") or os.path.join(os.path.expanduser("~"), ".todo.json")

def load(path):
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r") as f:
            data = json.load(f)
        if not isinstance(data, list):
            raise ValueError("store root is not a list")
        return data
    except (json.JSONDecodeError, ValueError) as e:
        raise RuntimeError(f"corrupted store at {path}: {e}")

def save(path, items):
    d = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=d)
    with os.fdopen(fd, "w") as f:
        json.dump(items, f)
    os.replace(tmp, path)
```

## Observed results

1. **Fresh/nonexistent store** — `load()` on a path that doesn't exist returns `[]` cleanly, no
   exception. Confirms "empty list" edge case needs no special-casing beyond a file-exists check.
2. **Save then reload** — round-trips correctly: `[{'text': 'a', 'done': False}]`.
3. **Corrupted store (invalid JSON)** — `json.load` raises `JSONDecodeError`; caught and
   re-raised as a domain-level `RuntimeError` with a clear message:
   `corrupted store at /tmp/todo-spike/store2.json: Expecting property name enclosed in double
   quotes: line 1 column 2 (char 1)`. This is catchable at the CLI boundary to print a clean
   error and exit non-zero instead of an unhandled traceback.
4. **Valid JSON, wrong shape (object instead of list)** — the intake doesn't call this out
   explicitly, but it's a corruption variant a real user could hit (hand-editing the file).
   Confirmed `isinstance(data, list)` guard catches it and raises the same domain error path
   as #3, so one exception type covers both corruption flavors.
5. **`$TODO_STORE` override** — setting the env var makes `default_store_path()` return it
   exactly; unsetting it falls back to `~/.todo.json` via `os.path.expanduser`. Confirms the
   resolution order (env var wins, else default) works with zero dependencies and is
   test-sandboxable exactly as the intake requires (point `$TODO_STORE` at a throwaway path).
6. **Atomic write** — `save()` writes to a `tempfile.mkstemp` sibling in the same directory,
   then `os.replace(tmp, path)`. `os.replace` is atomic on POSIX, so a crash mid-write leaves
   the original file untouched rather than half-written — closes off a second corruption
   vector (crash during save) beyond the "pre-existing bad file" case the pitch names.

## Risk resolved / rank

**Rank 0 after spike** — no unknowns remain that would change the shape of the use cases or
the technical approach. Stdlib `json` + `tempfile.mkstemp` + `os.replace` gives clean,
distinguishable failure modes for both corruption variants, and the env-var/default resolution
is a two-line function. Confirms `archetype: library` / stdlib-only in `project-profile.md` is
sufficient — no dependency, no database, no locking library needed for this appetite (single
CLI, single-user, no concurrent-writer requirement in scope).

## Carries forward to BA / use cases

- Domain error type for "corrupted store" should cover both invalid-JSON and wrong-shape JSON
  under one message format — worth a single Test Surface row rather than two.
- Store path resolution (`$TODO_STORE` env var, else default) is a cross-cutting concern all
  four use cases (`add`, `list`, `done`, `rm`) share — one shared engine/module, not per-command
  logic.
- Atomicity (`tempfile` + `os.replace`) is a save-path implementation detail worth naming in
  the wiring map so a future edit doesn't regress it to a naive `open(path, "w")`.
