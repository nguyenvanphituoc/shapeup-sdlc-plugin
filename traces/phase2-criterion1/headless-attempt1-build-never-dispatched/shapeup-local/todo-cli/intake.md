# Raw idea — `todo` CLI

A tiny command-line todo list, so we can exercise the harness end-to-end on a **non-UI**
deliverable (no browser, no Playwright). This is deliberately small enough to shape, build, and
evaluate in one short round.

## The pitch (one paragraph)

Developers keep todos in their head and lose them. Give them a zero-config CLI, `todo`, that
stores items in a local JSON file and supports `add`, `list`, `done <n>`, and `rm <n>`. It must
behave sanely at the edges — empty list, bad index, a corrupted store file — because a CLI that
crashes on a typo is worse than no CLI.

## Appetite

Small batch — a single build round.

## No-gos

- No sync, no server, no accounts.
- No TUI / colors / interactive prompts (keep output assertable).
