# Code surface — todo-cli

## Repo state at orient time

Greenfield. `git log` shows a single commit (`baseline: the todo-cli pitch, before any harness
run`). No `bin/`, no `todo/` package, no tests directory exist anywhere in the working tree.
Confirmed via `find . -type f` (excluding `.git`) — the only files present are harness
scaffolding (`.shapeup/`, `.claude/`) and docs (`AGENTS.md`, `CLAUDE.md`, `HOW-TO-RUN.md`,
`idea.md`) plus the committed `shapeup/todo-cli/project-profile.md`. `shapeup/todo-cli/spec/`
does not exist yet (BA has not run — it is the next phase, gated on this order's substrate as
frozen/read-only).

## Runtime environment

- `python3 --version` → `Python 3.10.16`, resolved via `/Users/liberty/.pyenv/shims/python3`
  (pyenv shim). Matches the stack pinned in `project-profile.md`.
- Stdlib-only constraint is satisfiable: `json`, `argparse`, `os`, `tempfile` all present and
  exercised directly in the spike below — no `pip install` needed, no `requirements.txt`,
  no venv required for this deliverable.

## Declared entry point / archetype (from project-profile.md)

- `archetype: library` — explicit least-wrong mapping, no `cli` enum member.
- `entry_point: bin/todo` — the argparse dispatcher; every use-case engine under `todo/` must
  be reached from it (no server, no daemon, no TUI — the pitch's no-gos rule those out).
- Noted limitation: the reachability oracle's import-graph arm only recognizes JS/TS source
  extensions, so it will report false-positive orphans for `todo/*.py` once `bin/todo` exists.
  Advisory-only per AGENTS.md; not a build blocker.

## Surface this feature will need to create (none exists yet)

- `bin/todo` — argparse dispatcher, subcommands `add`, `list`, `done <n>`, `rm <n>`.
- A store module (likely `todo/store.py`) — load/save against a JSON file, path resolved from
  `$TODO_STORE` when set, else a sensible default (spiked below as
  `~/.todo.json` via `os.path.expanduser`).
- No existing code to preserve or avoid breaking — this orient's only job is to de-risk the
  approach before BA writes use cases against it.

## What was NOT explored

No test framework, CI config, or packaging (`setup.py`/`pyproject.toml`) exists or is implied
by the pitch ("no install step" is explicit in the intake). Out of scope for this orient pass.
