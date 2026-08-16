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
