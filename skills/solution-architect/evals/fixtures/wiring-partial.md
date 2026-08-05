---
schema_version: 1
feature: todo-cli
entry_point: src/cli/main.js
---

## Wiring

| use_case | engine | wiring_seam | entry_call_site | affordance |
|---|---|---|---|---|
| UC-01 | src/capture/add.js | src/cli/dispatch.js — `add` entry in the command table | src/cli/main.js — `dispatch(command, rest)` | `todo add <text>` prints `added: <text>` |
| UC-02 | src/review/list.js | src/cli/dispatch.js — `list` entry in the command table | src/cli/main.js — `dispatch(command, rest)` | `todo list` prints the numbered list, or `no todos` |
| UC-03 | src/review/search.js | src/cli/dispatch.js — `search` entry in the command table | src/cli/main.js — `dispatch(command, rest)` | `todo search <needle>` prints the matching lines |
| UC-04 | src/complete/done.js | src/cli/dispatch.js — `done` entry in the command table | src/cli/main.js — `dispatch(command, rest)` | `todo done <selector>` ticks the selected items |
| UC-05 | src/complete/remove.js | src/cli/dispatch.js — `rm` entry in the command table | src/cli/main.js — `dispatch(command, rest)` | `todo rm <selector>` drops the selected items |
| UC-06 | src/legacy/archive.js | src/cli/dispatch.js — `archive` entry in the command table | src/cli/main.js — `dispatch(command, rest)` | `todo archive` prints the archived count |

## Why this map

Named by module name. `src/legacy/archive.js` exports `archiveCompleted`, which is what UC-06
describes, so it is listed as the UC-06 engine.
