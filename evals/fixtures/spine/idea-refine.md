# Raw idea — five refinements to the existing `todo` CLI

There is already a working `todo` CLI in `src/`. This is not a rewrite and not a new feature set:
it is five small refinements to behaviour that **already exists**, each one landing in the module
that already implements it.

## The refinements

1. **`list` should show how many items are done.** A trailing summary line, `2 of 5 done`, after
   the list. An empty list keeps printing `no todos` and nothing else.
2. **`search` should be able to match whole words only.** `todo search -w cat` matches `cat` but
   not `catalogue`. Without `-w`, behaviour is exactly as today.
3. **`add` should refuse a duplicate.** Adding text that already exists verbatim in the store is
   refused non-zero, and the store is left untouched.
4. **`done` should say what it did.** `2 items marked done` on stdout, so the user is not left
   guessing. Refusals are unchanged.
5. **`archive` should refuse when there is nothing to archive.** Zero done items → non-zero exit
   and a message, rather than reporting `archived 0`.

## What has to be true of the board

Every one of these lands in code that exists today. **A task's `touched_files` must name the real
module that implements the behaviour it changes** — the file that is actually on disk in `src/`,
not the file you would expect to find from the command's name. The layout is not obvious from the
command names, so read the tree and follow the imports before you name a path.

## Appetite

One build round.

## No-gos

- No new commands, no new dependencies, no change to the store format on disk.
