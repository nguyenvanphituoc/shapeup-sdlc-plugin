# Raw idea — `todo` CLI with batch edits

The same tiny command-line todo list, with the one feature its users ask for first: **acting on
several items at once**. Deliberately non-UI (no browser, no Playwright) and still small enough to
build in one round.

## The pitch (one paragraph)

Developers keep todos in their head and lose them. Give them a zero-config CLI, `todo`, that stores
items in a local JSON file and supports `add`, `list`, `done`, and `rm`. Crossing things off one at
a time is the part people actually complain about, so **`done` and `rm` both take any number of
item selectors, and a selector may be a single number or an inclusive range** — `todo rm 1 3 5`,
`todo done 2-4`, `todo rm 2-3 5`. It must behave sanely at the edges — empty list, bad index, a
corrupted store file — because a CLI that crashes on a typo is worse than no CLI.

## Selectors, precisely

This is the part worth getting right, so it is spelled out rather than left to taste:

- Item numbers are **1-based positions in the stored list**, as `list` prints them.
- A selector is either `<n>` or `<lo>-<hi>`, inclusive. `2-4` means items 2, 3 and 4.
- Several selectors may be given at once and they may arrive in **any order**: `rm 5 1` must remove
  the same two items as `rm 1 5`.
- Every selector is resolved against the list **as it was when the command started**. `rm 1 3 5`
  removes the 1st, 3rd and 5th items of the list the user saw — not the 1st, then the 3rd of
  what is left, then the 5th of what is left after that.
- If **any** selector is out of range or malformed, the command fails and changes nothing. A
  partial batch edit is worse than a refused one, because the user cannot tell what happened.
- The command reports **exactly** the items it affected, by text, and no others — so the user can
  see what it did without re-reading the whole list.

## Appetite

Small batch — a single build round.

## No-gos

- No sync, no server, no accounts.
- No TUI / colors / interactive prompts (keep output assertable).
