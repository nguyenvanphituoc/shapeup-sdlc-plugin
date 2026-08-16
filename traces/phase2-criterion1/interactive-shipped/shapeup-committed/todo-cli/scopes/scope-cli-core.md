---
scope_id: scope-cli-core
topology_type: LAYER_CAKE
feature: todo-cli
tasks: [TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006]
use_case_refs: [UC-AddTodo, UC-ListTodos, UC-CompleteTodo, UC-RemoveTodo]
allowed_file_substrate:
  - bin/todo
  - todo/store.py
  - todo/commands.py
shared_substrate: []
build_order: 1
hill_phase: UPHILL_UNKNOWN
e2e_verification_fixtures:
  - "bash -c 'FAIL=3; T=$(mktemp -d); export TODO_STORE="$T/s.json"; if python3 bin/todo bogus-command 1>/tmp/f_out 2>/tmp/f_err; then echo BAD_EXIT_ZERO; exit $FAIL; fi; [ -f "$T/s.json" ] && { echo STORE_SHOULD_NOT_EXIST; exit $FAIL; }; if python3 bin/todo 1>>/tmp/f_out 2>>/tmp/f_err; then echo BAD_NOSUBCMD_EXIT_ZERO; exit $FAIL; fi; grep -qi "Traceback" /tmp/f_err && { echo TRACEBACK_LEAKED; exit $FAIL; }; rm -rf "$T"; echo DISPATCH_OK'"
  - "bash -c 'FAIL=3; T=$(mktemp -d); export TODO_STORE="$T/s.json"; OUT1=$(python3 bin/todo add "ship it"); [ "$OUT1" = "added #1: ship it" ] || { echo "BAD1: $OUT1"; exit $FAIL; }; OUT2=$(python3 bin/todo add "write the spec"); [ "$OUT2" = "added #2: write the spec" ] || { echo "BAD2: $OUT2"; exit $FAIL; }; python3 -c "import json; d=json.load(open(\"$T/s.json\")); assert d==[{\"text\": \"ship it\", \"done\": False}, {\"text\": \"write the spec\", \"done\": False}], d"; rm -rf "$T"; echo ADD_OK'"
  - "bash -c 'FAIL=3; T=$(mktemp -d); export TODO_STORE="$T/s.json"; python3 bin/todo add "ship it" >/dev/null; python3 bin/todo done 1 >/dev/null; python3 bin/todo add "write the spec" >/dev/null; OUT=$(python3 bin/todo list); EXPECTED=$(printf "1. [x] ship it\n2. [ ] write the spec"); [ "$OUT" = "$EXPECTED" ] || { echo "BAD_LIST: [$OUT]"; exit $FAIL; }; EMPTY_T=$(mktemp -d); OUT2=$(TODO_STORE="$EMPTY_T/s.json" python3 bin/todo list); [ "$OUT2" = "(no items)" ] || { echo "BAD_EMPTY: $OUT2"; exit $FAIL; }; ESC=$(printf "\033"); echo "$OUT" | grep -qF "$ESC[" && { echo ANSI_LEAKED; exit $FAIL; }; rm -rf "$T" "$EMPTY_T"; echo LIST_OK'"
  - "bash -c 'FAIL=3; T=$(mktemp -d); export TODO_STORE="$T/s.json"; python3 bin/todo add "a" >/dev/null; python3 bin/todo add "b" >/dev/null; OUT=$(python3 bin/todo done 1); [ "$OUT" = "done #1: a" ] || { echo "BAD_DONE: $OUT"; exit $FAIL; }; ERR=$(python3 bin/todo done 9 2>&1 1>/dev/null); CODE=$?; [ "$CODE" -eq 1 ] && [ "$ERR" = "error: no item 9 (list has 2 items)" ] || { echo "BAD_DONE_ERR: code=$CODE err=$ERR"; exit $FAIL; }; for n in 0 3 abc; do python3 bin/todo done "$n" >/dev/null 2>&1 && { echo "n=$n SHOULD_HAVE_FAILED"; exit $FAIL; }; done; python3 -c "import json; d=json.load(open(\"$T/s.json\")); assert d[0][\"done\"] is True and d[1][\"text\"]==\"b\" and d[1][\"done\"] is False, d"; rm -rf "$T"; echo DONE_OK'"
  - "bash -c 'FAIL=3; T=$(mktemp -d); export TODO_STORE="$T/s.json"; python3 bin/todo add "a" >/dev/null; python3 bin/todo add "b" >/dev/null; OUT=$(python3 bin/todo rm 1); [ "$OUT" = "removed #1: a" ] || { echo "BAD_RM: $OUT"; exit $FAIL; }; python3 -c "import json; d=json.load(open(\"$T/s.json\")); assert len(d)==1 and d[0][\"text\"]==\"b\", d"; ERR=$(python3 bin/todo rm 5 2>&1 1>/dev/null); CODE=$?; [ "$CODE" -eq 1 ] && [ "$ERR" = "error: no item 5 (list has 1 items)" ] || { echo "BAD_RM_ERR: code=$CODE err=$ERR"; exit $FAIL; }; rm -rf "$T"; echo RM_OK'"
  - "bash -c 'FAIL=3; T=$(mktemp -d); echo "not valid json" > "$T/s.json"; export TODO_STORE="$T/s.json"; for cmd in "list" "add x" "done 1" "rm 1"; do OUT=$(python3 bin/todo $cmd 2>&1 1>/dev/null); CODE=$?; [ "$CODE" -eq 1 ] || { echo "cmd=$cmd WRONG_EXIT_$CODE"; exit $FAIL; }; echo "$OUT" | grep -Eq "^error: corrupted store at " || { echo "cmd=$cmd BAD_STDERR: $OUT"; exit $FAIL; }; done; echo "{\"not\": \"a list\"}" > "$T/s2.json"; OUT=$(TODO_STORE="$T/s2.json" python3 bin/todo list 2>&1 1>/dev/null); echo "$OUT" | grep -Eq "^error: corrupted store at " || { echo "WRONG_SHAPE_ERR: $OUT"; exit $FAIL; }; rm -rf "$T"; echo CORRUPTED_UNIFORM_OK'"
  - "bash -c 'FAIL=3; H=$(mktemp -d); OUT=$(env -u TODO_STORE HOME="$H" python3 bin/todo add "x"); CODE=$?; [ "$CODE" -eq 0 ] || { echo "WRONG_EXIT_$CODE"; exit $FAIL; }; [ -f "$H/.todo.json" ] || { echo "STORE_NOT_AT_HOME: $(ls $H)"; exit $FAIL; }; rm -rf "$H"; echo INV05_DEFAULT_PATH_OK'"
  - "bash -c 'FAIL=3; T=$(mktemp -d); export TODO_STORE="$T/s.json"; python3 -c "import json,sys; json.dump([{\"text\":\"item %d padding padding padding padding\" % i,\"done\":False} for i in range(5000)], open(sys.argv[1],\"w\"))" "$T/s.json"; python3 bin/todo list 2>"$T/err" | head -2 >/dev/null; grep -qi "traceback" "$T/err" && { echo QA001_TRACEBACK_ON_PIPE; exit $FAIL; }; rm -rf "$T"; echo QA001_PIPE_OK'"
  - "bash -c 'FAIL=3; H=$(mktemp -d); OUT=$(TODO_STORE="" HOME="$H" python3 bin/todo add "x" 2>&1); CODE=$?; [ "$CODE" -eq 0 ] && { echo QA004_EMPTY_ACCEPTED_SILENTLY; exit $FAIL; }; [ -f "$H/.todo.json" ] && { echo QA004_LEAKED_TO_HOME; exit $FAIL; }; echo "$OUT" | grep -qi "traceback" && { echo QA004_TRACEBACK; exit $FAIL; }; echo "$OUT" | grep -Eq "^error: " || { echo "QA004_BAD_MSG: $OUT"; exit $FAIL; }; rm -rf "$H"; echo QA004_EMPTY_STORE_OK'"
  - "bash -c 'FAIL=3; T=$(mktemp -d); for P in "$T/nodir/s.json" "$T"; do OUT=$(TODO_STORE="$P" python3 bin/todo add "x" 2>&1 1>/dev/null); CODE=$?; [ "$CODE" -eq 1 ] || { echo "QA005_EXIT_$CODE for $P"; exit $FAIL; }; echo "$OUT" | grep -qi "traceback" && { echo "QA005_TRACEBACK for $P"; exit $FAIL; }; echo "$OUT" | grep -Eq "^error: " || { echo "QA005_BAD_MSG: $OUT"; exit $FAIL; }; done; rm -rf "$T"; echo QA005_IO_ERRORS_OK'"
  - "bash -c 'FAIL=3; T=$(mktemp -d); echo "[{\"text\": \"ok\"}]" > "$T/s.json"; for cmd in "list" "rm 1" "done 1"; do OUT=$(TODO_STORE="$T/s.json" python3 bin/todo $cmd 2>&1 1>/dev/null); CODE=$?; [ "$CODE" -eq 1 ] || { echo "QA010_EXIT_${CODE}_for_$cmd"; exit $FAIL; }; echo "$OUT" | grep -qi "traceback" && { echo "QA010_TRACEBACK_for_$cmd"; exit $FAIL; }; echo "$OUT" | grep -Eq "^error: corrupted store at " || { echo "QA010_BAD_MSG: $OUT"; exit $FAIL; }; done; rm -rf "$T"; echo QA010_MALFORMED_ELEMENT_OK'"
status: ready
---

# Scope: scope-cli-core

## Affordances

| test_id | role | required_states |
|---|---|---|
| cli:todo-add | cli-command | [success, error] |
| cli:todo-list | cli-command | [success, empty, error] |
| cli:todo-done | cli-command | [success, error] |
| cli:todo-rm | cli-command | [success, error] |
| cli:dispatch-unknown-subcommand | cli-command | [error] |
| cli:dispatch-no-subcommand | cli-command | [error] |
| cli:error-boundary-corrupted-store | cli-command | [error] |

## Why this slice

This is the whole `todo` CLI's implementation as one scope, not four. The four commands
(`add`/`list`/`done`/`rm`) are distinct affordances in `ux-behavior.md` and distinct use cases,
but the frozen task substrate (`.shapeup/todo-cli/tasks/TASK-002..006`) puts every command's
body — and the argparse dispatcher, and the top-level error boundary — into two files shared by
all six tasks: `bin/todo` and `todo/commands.py` (`commands.add`, `commands.list_`,
`commands.done`, `commands.rm`, all in one module), sitting on top of `todo/store.py`
(`TASK-001`). Slicing each command into its own scope would give every one of those scopes an
`allowed_file_substrate` of exactly `["todo/commands.py"]` — a single shared file with nothing
distinguishing one scope's substrate from another's, which is directory/file alignment
(`PA1`), not a flow slice, no matter how the prose describes it. One scope that genuinely
crosses the real layers here — CLI dispatch (`bin/todo`) → command logic
(`todo/commands.py`) → persistence (`todo/store.py`) — is the honest slice for a feature this
small (7 tasks, ~4 source files, 1-day appetite): `LAYER_CAKE`, thin and balanced across the
CLI/backend boundary, no directory alignment, and no shared_substrate needed because nothing
else in the feature touches these three files.

`TASK-007` (integration test) stays a separate scope (`scope-integration-test`) because it
writes to a genuinely disjoint substrate (`tests/**`) and depends on this scope being fully
built rather than sharing its flow.

## Deviation note

`wiring-map.md` names per-UC engine modules under `todo/usecases/` (`add_todo.py`,
`list_todos.py`, `complete_todo.py`, `remove_todo.py`, each exporting `execute(...)`), but the
frozen tasks name a single `todo/commands.py` module with functions `add`, `list_`, `done`,
`rm` instead. This scope's substrate follows the frozen tasks (the actual build surface) over
the wiring map's module names; filed as a deviation in this order's `WorkResult`, not silently
resolved.
