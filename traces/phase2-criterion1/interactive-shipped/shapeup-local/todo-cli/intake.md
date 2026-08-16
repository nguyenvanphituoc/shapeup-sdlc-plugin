# Raw idea — `todo` CLI

A tiny command-line todo list, so we can exercise the harness end-to-end on a **non-UI**
deliverable (no browser, no Playwright). This is deliberately small enough to shape, build, and
evaluate in one short round.

## The pitch (one paragraph)

Developers keep todos in their head and lose them. Give them a zero-config CLI, `todo`, that
stores items in a local JSON file and supports `add`, `list`, `done <n>`, and `rm <n>`. It must
behave sanely at the edges — empty list, bad index, a corrupted store file — because a CLI that
crashes on a typo is worse than no CLI.

**The store path must come from `$TODO_STORE` when it is set**, falling back to a sensible default
otherwise. This is a real constraint, not a detail: it is the only way a test can point the CLI at a
throwaway file, and without it every edge case above — seeding a corrupted store, seeding a store
with items — can only be exercised by writing to the developer's own todo list. A harness run is
graded by driving this binary, so a CLI that cannot be sandboxed cannot be verified.

## Appetite

Small batch — a single build round.

## No-gos

- No sync, no server, no accounts.
- No TUI / colors / interactive prompts (keep output assertable).

---

## PO decisions — recorded at GATE L1a (2026-08-16)

Appended by `tech-lead` after the Orient Review. Orient's discovery ledger flagged both of these
as needing an explicit product decision rather than a builder's default, and the PO answered them
live at the gate. They are requirement clauses, not suggestions — treat them as part of the pitch.

**1. `done <n>` / `rm <n>` are 1-BASED.**
`list` numbers items from 1, and `done 1` completes the first item. Out-of-range or non-integer
`<n>` must exit non-zero with a clean single-line error — never a traceback. Illustrative:

```
$ todo list
1. [ ] ship it
2. [x] write the spec

$ todo done 1
done #1: ship it

$ todo done 9
error: no item 9 (list has 2 items)     # exit 1
```

**2. Default store path is `~/.todo.json`** (via `os.path.expanduser`), used only when
`$TODO_STORE` is unset. Resolution order is exactly: `$TODO_STORE` when set, verbatim; otherwise
`~/.todo.json`. XDG base directories were considered and explicitly declined — the appetite is a
small batch and "zero-config" argues for one dotfile over a third path branch to spec and test.

**3. Corruption is one error path, not two.** The spike found a variant the pitch never named:
valid JSON whose root is not a list (a hand-edited file). It shares the corrupted-store error
path and message format with invalid JSON, and earns ONE Test Surface row rather than two.
