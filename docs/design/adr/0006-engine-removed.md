# ADR-0006 — The decision engine removed

| | |
|---|---|
| **Status** | Accepted by the PO; implemented on a side branch, not merged |
| **Date** | 2026-11-08 |
| **Decision** | The plugin's runtime keeps five mechanisms — the run receipt, the gate resolver, the T0 witness, the write fence and the dispatch receipts — and the loop's own discipline carries everything else. |
| **Supersedes** | decision 3 of [ADR-0005](0005-native-first.md), which kept `compile`, `reduce ingest`, `reduce board` and `probe next`; and the V4-REQ-13 outcome "measured and not met, engine kept" |
| **Affects** | `kernel/`, `hooks/`, `skills/building/`, `commands/`, `tests/`, `AGENTS.md`, `README.md`, `SECURITY.md` |

## Context

ADR-0005 left a decision engine in place because the one measurement made of it came out in its favour. On the three-scope `envlint`
pitch, with the same model and the same day, the run driven by `probe next` shipped both repetitions at about $5.3 each; the same loop
reading a phase table and calling the same compiler and ingest step shipped none of its single repetition, escalated after a failed
round, and spent 59 % more. That result held the engine; this record is about what happened next.

## The decision, and where it came from

The PO's instruction was the single line below. It arrived appended to a Stop-hook feedback message that had, six times in a row,
asked for exactly this choice, so the form is unusual and the content is not ambiguous:

> Xoá engine

The assistant had put two options to the PO — accept the result with the engine kept, or delete the engine as the plan's stage S4
describes — and had said it would not delete without an answer, because the measurement went the other way. This is that answer. It is
the PO's decision made against a measured result, not a conclusion the measurement supports, and the record says so on purpose.

## What was removed

| Removed | Its job | Now |
|---|---|---|
| `compile` | derived every order's substrate and payload from the contracts, the board, the trials and the last verdict | the loop writes the order from `skills/building/resources/orders.md`, copying the substrate from the scope contract |
| `reduce ingest` | the single writer: applied a result to the board and ledger, refused a result with no receipt, sent a malformed one back once | the loop checks the result with `verify envelope` and applies it |
| `reduce board`, `probe resume`, `probe next` and the other `probe` verbs, `verify build`, `verify budget`, `verify dispatch` | derived the next step, counted attested attempts, ran the round build gate, closed a run | the phase table in the `building` skill; attempts are counted from the dispatch receipts; the loop builds and launches before it evaluates; `order close` records the ending and retires the fence's pointer |
| `verify spec` | the board-review lint (substrate disjointness, anchors, `covers:` closure, breadboard Places) | the planning step reads its own output back against the checklist in its resource file |
| `reduce ship`, `reduce hill`, the hill chart | the ship report, the per-scope hill phase, the dashboard | the loop writes the report; the hill chart is removed |
| `init fit`, the breadboard staging, the run ledger | lane advice, copying the breadboard, the Markdown run ledger | the loop copies the breadboard; the ending is `close.json` |

Kept, and tested by executing the shipped code: `verify t0`, `verify envelope`, `verify skills`, `gate`, `init run`, the new `order`
verb, `sandbox-guard` (the fence and the tier rule), `dispatch-receipt`, `safety-spine`, the four oracles and the installer.

## Consequences

- **The kernel, hooks and installer went from 16.5 k lines to 6.2 k, and the structural suite from 110 files and 19.9 k lines to ten files
  and 755 lines (970 with the runner and helpers).** The plan's own target for S4 was about ten files and at most 2.5 k lines; it is met.
- **A set of guarantees AGENTS.md used to state as mechanical are now the loop's discipline**, and `AGENTS.md` says so in its first
  section. In particular nothing now stops a run from skipping the board-review lint, applying a result twice, miscounting attempts,
  evaluating a feature that does not build, or reporting a ship from memory. The write fence, the dispatch receipts, the T0 witness and
  the gate resolver still refuse what they refused.
- **The measured weakness is now the product.** The loop that failed once in the comparison is the only loop. A real run on this
  branch, on the same pitch, reached the evaluator with all three scopes green on the first attempt, then drew a FAIL (a code bug and
  two gaps in its own planning that the removed spec lint would have caught), stopped at the start of round 2 on its own judgment of
  the remaining budget, and had spent $9.1 against $5.4 for the engine's runs. It did not ship. One repetition is not a rate; the
  record is `execution-native-first-2026-11-08.md`.
- **A fence armed by hand is a fence that can be forgotten, and a stamp typed by hand can stall it.** With no active-order pointer the fence allows every write. The loop arms
  and retires it through `harness order`, which reads the pointer back and stamps the order's time itself (a real run typed a stamp ahead of the clock and stalled the run); the tests arm it the same way.
- **The ratchet's limit is unchanged and now more visible:** the snapshot holds tracked files only, so a revert does not remove a file an
  attempt created.
- `harness-run.md` is no longer written, a terminal close no longer leaves the `last-run` breadcrumb that keyed later hook rows, and a
  plugin copy that cannot name its worker roster is refused at `init run` instead of throwing.
