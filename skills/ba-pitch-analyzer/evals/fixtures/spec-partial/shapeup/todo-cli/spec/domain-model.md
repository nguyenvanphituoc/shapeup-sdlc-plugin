# Domain model — `todo` CLI

## Entities

| Entity | Fields | Notes |
|---|---|---|
| `Todo` | `text` (string), `done` (boolean) | One line of the list. Position in the store array is its 1-based item number. |
| `Store` | a JSON array of `Todo` | Path from `$TODO_STORE`, else `todos.json` in the working directory. A missing file means an empty list. |
| `Selector` | `<n>` or `<a>-<b>` | Resolves to item positions **as they were when the command started**. |

## Rules

- Item numbers are 1-based positions in the store array.
- A command that touches items resolves every selector before mutating anything; one bad selector
  refuses the whole batch and changes nothing.
- Nothing crashes on bad input: a refusal is a message on stderr and a non-zero exit.
