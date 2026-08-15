# Code-surface — todo-cli

Repo state: **greenfield**. No `src/`, no `package.json`, no existing CLI or store code exists
anywhere in this repository. `git log` shows a single commit (`c4f6b64 baseline: the todo-cli
pitch, before any harness run`) containing only `idea.md` and `.shapeup/`. Confirmed via:

```
$ ls -la /Volumes/LibertyMobi/workspace/phase2-todo-cli-headless
.git  .gitignore  .shapeup  idea.md
```

Every pitch element below is therefore **NEW — no existing home**. There is no seam to extend;
the Scout's job here is to name where each element *should* land so `ba` can map scopes onto a
plan instead of onto code.

| Pitch element | Where it should land | Status | Notes |
|---|---|---|---|
| CLI entry point (`todo <cmd> [args]`) | `bin/todo.js` or `src/cli.js` invoked via `package.json#bin` | NEW | Node has no CLI scaffolding yet; needs `package.json` with a `bin` field (or a shebang script) to be a "zero-config" installable command per the pitch |
| `add <text>` command | `src/commands/add.js` (suggested) | NEW | Appends `{id, text, done}` to the store |
| `list` command | `src/commands/list.js` (suggested) | NEW | Must render sanely on an **empty list** (explicit pitch requirement) |
| `done <n>` command | `src/commands/done.js` (suggested) | NEW | `<n>` is a 1-based display index; must reject out-of-range / non-numeric `<n>` without crashing (explicit pitch requirement) |
| `rm <n>` command | `src/commands/rm.js` (suggested) | NEW | Same index-safety requirement as `done`; removing an item raises the question of whether ids/indices are stable or re-numbered — flagged as an open unknown (see hill-signal.md) |
| Local JSON store | `src/store.js` (suggested), backed by a file such as `~/.todo.json` or `./.todo.json` | NEW | No persistence code exists. Must survive **corrupted store file** (explicit pitch requirement) — this is the riskiest area, see `spike-persistence.md` |
| Argument parsing / dispatch | `src/cli.js` (suggested) | NEW | Node's built-in `process.argv` is sufficient (no framework found or required — "zero-config" and no-gos rule out heavier deps like `commander`/`inquirer` for an interactive UX) |
| Output formatting | inline in command modules | NEW | No-gos explicitly forbid colors/TUI — plain, assertable stdout only |

## Uncertain / needs `ba` decision

- **Store location**: pitch says "a local JSON file" but doesn't specify cwd-relative
  (`./.todo.json`) vs. home-relative (`~/.todo.json`). Cwd-relative is simpler to test
  deterministically (no env/HOME mocking) and matches "zero-config" without implying global
  state across projects; home-relative matches typical CLI tool conventions. Left for `ba`/task
  spec to pin down explicitly — flagged in hill-signal.md.
- **Index/id semantics for `done`/`rm`**: are `<n>` positional list indices (renumber after
  `rm`) or stable ids assigned at `add` time (never reused)? Not resolved by the pitch text.
  Flagged as an open unknown, not spiked (it's a design decision, not a technical risk).
- **Packaging**: no `package.json` exists. `ba` will need a task to scaffold it (`name`,
  `bin`, `type`) before any command code can run as `todo`.
