# Raw idea — `wl`, a work-log CLI

The **scale** fixture of the spine, and the escalation dial is deliberate. Escalations that
raised the *complexity of one artifact* did not move the ceiling. This one raises
the **number of constraints that must stay mutually consistent** — the bookkeeping surface, not the
difficulty of any single decision. Every individual judgement below is easy; there are just a lot of
them and they have to agree with each other.

## The pitch

Developers lose track of what they did. `wl` is a zero-config work log: a local JSON store, a small
set of commands, and no server. It has to cover the whole shape of the job — capture, retrieval,
organisation, reporting and recovery — because a work log you cannot search or export is a diary.

## What a user can do

1. **`wl add <text>`** — append an entry. Refuses empty text.
2. **`wl list`** — print every entry, numbered from 1, `[x]` when done. Empty store prints `no entries`.
3. **`wl search <needle>`** — the same output, filtered case-insensitively. Never writes.
4. **`wl done <selector...>`** — mark entries. A selector is `<n>` or `<a>-<b>`.
5. **`wl rm <selector...>`** — remove entries, same selector rules.
6. **`wl tag <selector> <tag>`** — attach a tag to entries.
7. **`wl untag <selector> <tag>`** — remove a tag.
8. **`wl due <selector> <date>`** — set a due date (ISO `YYYY-MM-DD`).
9. **`wl overdue`** — list entries whose due date has passed and are not done.
10. **`wl stats`** — counts: total, done, open, overdue, and the three most-used tags.
11. **`wl export <file>`** — write the store to a file as JSON.
12. **`wl import <file>`** — replace the store from a file, refusing malformed input.

## The rules that make it safe

- Entry numbers are **1-based positions in the store array**.
- A command that touches entries resolves **every** selector against the list as it was when the
  command started, before changing anything. One bad selector refuses the whole batch and writes
  nothing.
- Nothing crashes on bad input: a refusal is a message on stderr and a non-zero exit.
- The store path comes from `$WL_STORE` when set, otherwise a JSON file in the working directory.
  Its format is a JSON array of `{"text": string, "done": boolean, "tags": string[], "due": string|null}`.
  A missing file means an empty list; a corrupt one reads as an empty list rather than crashing.
- `import` validates before it replaces. A malformed file leaves the existing store untouched.

## The work has a shape, and the board has to show it

Storage comes before anything that reads or writes it. Selector resolution comes before every
command that takes a selector. Rendering comes before every command that prints a list. Tagging
comes before any report that groups by tag; due dates come before the overdue report. Export and
import both depend on the store format being settled, and `import` additionally depends on
validation.

Nothing here is subtle. The point is that it is **a lot of edges to keep straight at once**, and a
board is only useful if its dependency graph agrees with itself in both directions.

## Appetite

Two build rounds.

## No-gos

- No sync, no server, no accounts, no notifications.
- No TUI, no colours, no interactive prompts — keep the output assertable.
