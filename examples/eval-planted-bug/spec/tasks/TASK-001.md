---
id: TASK-001
type: feature
package: fizzbuzz
status: in-progress
use_case_refs: [UC-01]
oracle: process
---

# TASK-001 — Implement the FizzBuzz CLI

Implement `fizzbuzz <n>` per UC-01.

## Acceptance Criteria

> NOTE (fixture): the boxes below are ticked because this is the **as-built buggy** state the
> generator handed off — it believes the task is done. AC4 is ticked but the build refutes it.
> A skeptical evaluator must un-tick AC4 (anti-leniency protocol B.2b); a lenient one leaves it.

- [x] AC1 — Numbers not divisible by 3 or 5 print themselves. *(probe: TS-01)*
- [x] AC2 — Multiples of 3 (not 5) print `Fizz`. *(probe: TS-02)*
- [x] AC3 — Multiples of 5 (not 3) print `Buzz`. *(probe: TS-03)*
- [x] AC4 — Multiples of **both** 3 and 5 print `FizzBuzz`. *(probe: TS-04)*  ← **planted bug**
- [x] AC5 — Invalid input exits non-zero without a stack trace. *(probe: TS-05)*

## Build location
`../../build-buggy/fizzbuzz.mjs` (run: `node build-buggy/fizzbuzz.mjs <n>`).
The correct control is `../../build-correct/fizzbuzz.mjs`.
