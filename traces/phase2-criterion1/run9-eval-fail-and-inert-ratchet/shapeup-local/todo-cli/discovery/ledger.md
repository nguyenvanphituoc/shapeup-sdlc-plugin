---
feature: todo-cli
---
# Discovery Ledger — todo-cli

## Discovered — todo-cli/remove-todo-r1-a1 (2026-08-15)
+ npm test (node --test test/) currently fails with MODULE_NOT_FOUND on this Node version/repo layout — pre-existing, unrelated to this scope, not touched

## Discovered — todo-cli/cli-integration-test-r1-a1 (2026-08-15)
+ Pre-existing: `node --test test/` (directory form, used by npm test) fails with MODULE_NOT_FOUND on this Node version (v24.15.0) — unrelated to TASK-007, existing test/commands/*.test.js have the same issue when run via the directory form; individual file invocation (`node --test test/cli.test.js`) works correctly.

## Discovered — todo-cli/add-todo-r1-a1 (2026-08-16)
+ npm test / `node --test test/` fails with MODULE_NOT_FOUND on this Node version (v24.15.0) because `node --test test/` resolves 'test' as a module path rather than a directory glob; pre-existing, unrelated to this scope's substrate (bin/todo.js, test/commands/add.test.js) — the scoped fixture `node --test test/commands/add.test.js` passes cleanly.

## Discovered — todo-cli/remove-todo-r1-a1 (2026-08-16)
+ test/bin-scaffold.test.js's 'list reaches its stub branch' assertion now fails because list.test.js (a different, already-landed scope) implemented cmdList for real — pre-existing conflict between the scaffold test and a sibling scope's landed work, outside this scope's substrate (bin-scaffold.test.js is not in remove-todo's allowed_file_substrate) and unrelated to the rm command.
