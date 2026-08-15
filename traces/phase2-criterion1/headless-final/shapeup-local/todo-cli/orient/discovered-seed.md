# Discovered-task seed — todo-cli

Repo is greenfield (see code-surface.md), so most tasks are **Imagined** (derived from the
pitch text alone). The persistence spike surfaced concrete **Discovered** implementation
constraints that weren't obvious from the pitch text — those are labelled below with their
citation per the hard rule (file:line or seam, never assumed).

## Suspected scope: project scaffolding

**Imagined**
- Create `package.json` with a `bin` entry so `todo` resolves as an installable CLI command
  (zero-config requirement, idea.md "Give them a zero-config CLI, `todo`").
- Create the CLI entry point that dispatches on `process.argv[2]` to `add`/`list`/`done`/`rm`.

## Suspected scope: store / persistence

**Imagined**
- Implement JSON file read/write for the todo list.

**Discovered** (from `spike-persistence.md`)
- Store module must `try/catch` around `JSON.parse` and treat `SyntaxError` as a corrupted-file
  case (distinct UX from missing file) — cites `.shapeup/todo-cli/orient/spike-persistence.md`
  probe 1 (`SyntaxError` is catchable, confirmed against real Node `fs`/`JSON.parse`).
- Store module must check `err.code === 'ENOENT'` to treat "no store file yet" as an empty list
  rather than an error — cites `spike-persistence.md` probe 2.
- Writes must go to a temp file (`store.json.tmp`) then `fs.renameSync` into place, not a direct
  `fs.writeFileSync(storePath, ...)`, to avoid a half-written store if the process is killed
  mid-write — cites `spike-persistence.md` probe 3.

## Suspected scope: commands (add / list / done / rm)

**Imagined**
- `add <text>`: append a new item to the store.
- `list`: print all items with their display index and done/not-done state; must print a sane
  message (not a crash, not an empty blob) when the store is empty (idea.md, explicit edge
  case: "empty list").
- `done <n>`: mark item `<n>` as done; must reject non-numeric or out-of-range `<n>` with a
  clean error message, not a stack trace (idea.md, explicit edge case: "bad index").
- `rm <n>`: remove item `<n>`; same index-safety requirement as `done`.

**Discovered**
- None yet — command behavior wasn't spiked (only persistence was, per GATE O-B: one riskiest
  area). `ba` should resolve the id/index semantics question below before writing task ACs for
  `done`/`rm`, since it changes what "bad index" validation looks like.

## Suspected scope: cross-cutting / needs `ba` decision before task-writing

- **Open decision, not yet a task**: whether `<n>` in `done`/`rm` is a positional list index
  (shifts after `rm`) or a stable id assigned at `add` time. Not resolved by the pitch; flagged
  in `code-surface.md` and `hill-signal.md`. Recommend `ba` pin this in the spec so `done`/`rm`
  task ACs are unambiguous and testable.
- **Open decision, not yet a task**: store file location (cwd-relative vs. home-relative).
  Recommend cwd-relative for deterministic testing (see code-surface.md rationale) unless `ba`
  has reason to prefer the home-relative convention.
