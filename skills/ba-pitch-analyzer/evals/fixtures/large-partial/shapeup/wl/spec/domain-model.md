# Domain model — `wl` work log

## Entities

| Entity | Fields | Notes |
|---|---|---|
| `Entry` | `text` (string), `done` (boolean), `tags` (string[]), `due` (string\|null) | One line of the log. Its position in the store array is its 1-based number. |
| `Store` | a JSON array of `Entry` | Path from `$WL_STORE`, else a JSON file in the working directory. Missing or corrupt reads as empty. |
| `Selector` | `<n>` or `<a>-<b>` | Resolves to positions **as they were when the command started**. |
| `Tag` | a string | Free-form; an entry carries zero or more. |

## Rules

- Entry numbers are 1-based positions in the store array.
- Every selector is resolved before anything is mutated; one bad selector refuses the whole batch.
- Nothing crashes on bad input: a refusal is stderr plus a non-zero exit.
- `import` validates before it replaces; a malformed file leaves the store untouched.
