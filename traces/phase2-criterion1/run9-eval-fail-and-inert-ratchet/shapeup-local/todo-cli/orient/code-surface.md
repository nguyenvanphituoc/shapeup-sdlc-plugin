# Code surface — todo-cli

## Repo state (verified by direct inspection, not assumed)

```
$ git ls-files
.gitignore
idea.md
```

- No `package.json`, no `bin/`, no `src/`, no `test/`, no `node_modules/` (gitignored anyway).
- `shapeup/todo-cli/project-profile.md` is the only pre-existing planning artifact and declares:
  - `entry_point: bin/todo.js` — does not exist yet.
  - `archetype: web-service` (forced by schema enum; profile note explains it's a structural
    stand-in for a CLI composition root, not an actual HTTP service).
- `.shapeup/todo-cli/` contains only harness bookkeeping (intake, orders, receipts, decisions
  log) — nothing that touches production code.
- Node version available in this environment: `v24.15.0` (global `fs`, `process.argv`,
  `JSON.parse` all behave as spiked below; no polyfills needed).

## What this means for orient

There is **zero existing source to map**. The "code surface" for this feature is the surface
that will be *created*: a single-file (or small handful of files) CLI rooted at `bin/todo.js`
per the project profile's `entry_point`. There are no existing modules, exports, or call graphs
to trace — the reachability question the harness usually asks (entry_point → import graph →
engines) is moot until the board's first task creates `bin/todo.js`.

## Inferred shape from the pitch (`idea.md` / intake)

- Single entry point: `bin/todo.js`, dispatches on `process.argv[2]` (the subcommand).
- Four commands: `add <text>`, `list`, `done <n>`, `rm <n>`.
- Storage: a local JSON file (path unspecified by the pitch — a task will need to decide/own
  this, e.g. `./todo.json` in cwd vs `~/.todo.json` in home dir; both are plausible zero-config
  choices and this is a real open decision, not a spike risk).
- No network, no TUI, no color, no interactive prompts — output must be plain, assertable text
  (stdout for success paths, presumably stderr + non-zero exit for errors, though the pitch does
  not pin exit-code conventions explicitly).

## No dead code, no orphaned modules, no legacy patterns to report

There is nothing to audit for reuse or staleness — this is a from-scratch build. The spike below
instead de-risks the *implementation* choices the first tasks will have to make.
