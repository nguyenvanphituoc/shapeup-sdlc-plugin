# Notes CLI — Breadboard

## Places

| # | Place | Description |
|---|-------|-------------|
| P1 | Terminal | where the person types `notes …` and reads the output |

## UI Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| U1 | P1 | command line | `notes add "<text>"` | type | N1 | U4 |
| U2 | P1 | command line | `notes list` | type | N2 | U4 |
| U3 | P1 | command line | `notes archive <id>` | type | N3 | U4 |
| U4 | P1 | output | stdout line(s) or a one-line stderr message | render | — | — |

## Code Affordances

| # | Place | Component | Affordance | Control | Wires Out | Returns To |
|---|-------|-----------|------------|---------|-----------|------------|
| N1 | P1 | `src/cli.js` | add handler → `store.add`, `store.save` | call | S1 | U4 |
| N2 | P1 | `src/cli.js` | list handler → `store.list` | call | S1 | U4 |
| N3 | P1 | `src/cli.js` | archive handler → `store.archive`, `store.save` | call | S1 | U4 |

## Data Stores

| # | Place | Store | Description |
|---|-------|-------|-------------|
| S1 | P1 | `NOTES_FILE` JSON | the notes, each `{id, text, createdAt, archived}` |
