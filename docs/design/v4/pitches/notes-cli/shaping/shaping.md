---
shaping: true
feature: "notes-cli"
status: shaped
appetite: ~1 week
---

# Notes CLI — Shaping

## Problem Frame
People who live in a terminal jot things down in scratch files and lose them. They want a tiny command that
keeps short notes in one place, shows them back, and lets old ones get out of the way.

## Appetite
~1 week — a small, self-contained Node package with no existing code to fit around. Two rounds are plenty.

## Requirements
R1: `notes add "<text>"` stores a note with an id and a timestamp and prints the id.
R2: `notes list` prints the notes that are not archived, newest first, one per line as `<id>  <text>`.
R3: `notes archive <id>` archives a note so it no longer appears in `notes list`.
R4: Notes survive between runs, in a single JSON file whose path can be set with the `NOTES_FILE` environment variable (default `./.notes.json`).
R5: An unknown id, empty text, or a missing argument exits with status 1 and a one-line message on stderr; nothing is written.
R6: Teammates should be able to see each other's notes.

## Rabbit Holes
- RH1: Concurrent writers — two shells adding at once can drop a note. Out of scope; write the file atomically (temp file, then rename) and stop there.
- RH2: "Archive" is ambiguous in the pitch's own wording (hide a note versus move it out to a file). R3 fixes the meaning as *hide*; nothing else is asked for.

## No-goes
- Editing or deleting a note — not asked for.
- Any dependency beyond Node's standard library — the package must stay zero-dependency.
- Sync, accounts or a server — R6 is recorded as a wish and gets no mechanism in this shape.

## Selected Shape — Single store module and a thin CLI
Rationale: one module owns the file (read, write atomically, add, list, archive) and one entry point parses arguments and
prints. Two files of code and two of tests keep the substrates disjoint and the appetite honest.

### Parts
A1: `src/store.js` — `load(path)`, `save(path, notes)` (atomic), `add(notes, text, now)`, `list(notes)`, `archive(notes, id)`.
A2: `src/cli.js` — the `notes` entry point (`bin` in `package.json`): parses `add`, `list`, `archive`, maps errors to exit status 1.
A3: `test/store.test.js` and `test/cli.test.js` with `node:test`, run by `npm test`.

## Fit Check
| R# | Requirement | Covered by | Status |
|----|-------------|------------|--------|
| R1 | add prints the id | A1, A2 | ✓ |
| R2 | list, newest first | A1, A2 | ✓ |
| R3 | archive hides | A1, A2 | ✓ |
| R4 | persistence, `NOTES_FILE` | A1 | ✓ |
| R5 | errors exit 1, write nothing | A2 | ✓ |
| R6 | teammates see notes | — | ✗ no part (a wish, see No-goes) |

## Unknowns → Spike Needed?
- [ ] None. Atomic rename is well understood on the platforms Node supports.
