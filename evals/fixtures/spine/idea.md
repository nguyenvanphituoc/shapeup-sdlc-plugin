# Raw idea — `todo` CLI

The seed of the fixture spine. One authored artifact grounds everything downstream, so this file
is the only place the domain is invented; every stage after the first runs against a FROZEN
reference copy of the previous stage's output rather than against a live one.

## The pitch (one paragraph)

Developers keep todos in their head and lose them. Give them a zero-config CLI, `todo`, that stores
items in a local JSON file and gets out of the way. A user must be able to **add** an item, **list**
what is on the list, **search** it when the list gets long, mark an item **done**, **remove** items,
and **archive** everything already finished so the list stays short. It must behave sanely at the
edges — an empty list, a bad index, a store file that is missing or corrupt — because a CLI that
crashes on a typo is worse than no CLI.

## What the user can do

- `todo add <text>` — append one item. Empty text is refused; nothing is written.
- `todo list` — print every item as `<n>. [ ] <text>`, with `[x]` for done ones. An empty or absent
  store prints `no todos` and exits 0.
- `todo search <needle>` — the same output, filtered to items whose text contains the needle,
  case-insensitively. Search never changes the store.
- `todo done <selector...>` — mark items. A selector is `<n>` or `<a>-<b>`.
- `todo rm <selector...>` — remove items, same selector rules.
- `todo archive` — drop every item already marked done and print how many went.

## The rules that make it safe

- Item numbers are **1-based positions in the store array**.
- A command that touches items resolves **every** selector against the list as it was when the
  command started, before changing anything. So a batch removal never shifts the items it has not
  removed yet, and one bad selector refuses the whole batch and writes nothing.
- Nothing crashes on bad input: a refusal is a message on stderr and a non-zero exit.
- The store path comes from `$TODO_STORE` when set, otherwise a JSON file in the working directory.
  Its format is a JSON array of `{"text": <string>, "done": <boolean>}`. A missing file means an
  empty list; a corrupt one reads as an empty list rather than crashing.

## Appetite

Small batch — a single build round.

## No-gos

- No sync, no server, no accounts.
- No TUI, no colours, no interactive prompts — keep the output assertable.
