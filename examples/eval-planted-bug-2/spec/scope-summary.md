# Scope summary — `todo` CLI

**Pitch:** a zero-config command-line todo list over a JSON-array store.

## Done when
- `add`, `list`, `done`, `rm` and `archive` behave per UC-01, including the batch selector rules.
- Bad input is refused non-zero, with no stack trace.

## Non-go
- No sync, no server, no colours.
