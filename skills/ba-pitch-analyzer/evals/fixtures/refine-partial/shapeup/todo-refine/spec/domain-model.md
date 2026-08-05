# Domain model — `todo` refinements

## Entities

| Entity | Fields | Notes |
|---|---|---|
| `Todo` | `text` (string), `done` (boolean) | Unchanged by these refinements. |
| `Store` | a JSON array of `Todo` | Unchanged on disk; no migration. |

## Rules

- These are refinements to existing behaviour; the store format does not change.
- Every refinement lands in the module that already implements the command it changes.
