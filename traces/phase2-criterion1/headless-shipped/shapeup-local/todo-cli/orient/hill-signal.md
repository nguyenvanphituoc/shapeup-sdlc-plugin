# Hill signal — todo-cli orient

## Where this run sits on the hill

**Uphill — problem-shaping, not yet solved.** Nothing has been built. Orient's job here was to
confirm that the *hard part* is understood, not to climb it. The hard part identified: edge-case
behavior around store corruption, missing store, and index-argument validation (see
`spike-store-parsing.md`). That's now understood and de-risked with concrete, verified Node
behavior (exact exceptions, exact coercion pitfalls) — the remaining work (four subcommands
dispatched from `bin/todo.js`, plain-text output) is straightforward "downhill" implementation
once the storage/parsing contract from the spike is adopted.

## Confidence

- **High** that the scope is genuinely small (matches the pitch's "small batch, single build
  round" appetite) — zero existing code, four commands, one storage file, no UI.
- **Medium** on the open decisions in `discovered-seed.md` (store path, exit-code convention,
  numbering convention, corrupted-file recovery policy) — these are cheap to decide but must be
  decided explicitly before/while the board is written, or different tasks (and the evaluator)
  will disagree on what "correct" behavior is.
- **No unknowns remain about runtime mechanics** — the spike exercised the actual Node APIs
  (`JSON.parse`, `fs.readFileSync`, `Number()` coercion) that the implementation will use, on
  this environment's Node v24.15.0, so there's no "will this even work" risk left.

## Recommendation

Proceed to scopes/board. Fold the five discovered-seed items into the spec as explicit decisions
(most can be answered in a sentence each) before task-writing, so the board's acceptance criteria
are unambiguous rather than left to builder interpretation.
