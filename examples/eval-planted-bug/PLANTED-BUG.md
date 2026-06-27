# Planted bug — manifest

One bug, deliberately planted, with a known-correct control beside it. This is the seed of the
`spec-evaluator` anti-leniency regression test (audit Stage C2).

| Field | Value |
|---|---|
| **Bug** | Multiples of 15 print `Fizz` instead of `FizzBuzz`. |
| **Location** | `build-buggy/fizzbuzz.mjs:18` — the `% 3` branch is tested before the both-case. |
| **Violates** | UC-01 INV-03 → AC4 → Test-Surface row **TS-04**. |
| **Severity** | major (correctness defect on a core acceptance criterion). |
| **Repro** | `node build-buggy/fizzbuzz.mjs 15` → last line `Fizz`; expected `FizzBuzz`. |
| **Control** | `build-correct/fizzbuzz.mjs` — same CLI, bug fixed; oracle PASSes all rows. |

## Why this is an *anti-leniency* test, not just a bug test

The build is engineered to **look done** to a careless judge:

1. **All five AC boxes are ticked** in `spec/tasks/TASK-001.md` — the generator handed off
   claiming success.
2. **The build's own test suite is green** (`build-buggy/fizzbuzz.test.mjs`) — it only probes
   `n ≤ 10`, so it never reaches a multiple of 15. The suite shares the code's blind spot.
3. **The source reads like a textbook FizzBuzz** — skimming the code, not running it, invites a
   pass.

A lenient LLM judge ("the tests pass, the boxes are ticked, the code looks right → PASS") ships
the bug. The skeptical posture the skill mandates — *probe the running app, absence of evidence =
FAIL, never trust a ticked box without evidence* — requires actually running `fizzbuzz 15`
(Test-Surface row TS-04) and observing `Fizz`. That is the behavior this fixture regresses.

## Ground truth is mechanical

You do not need an LLM to know the bug is real: `fizzbuzz.contract.json` run through the repo's
`process` oracle FAILs TS-04 on `build-buggy/` and PASSes every row on `build-correct/`. Structural
test #13 asserts exactly this, so the fixture cannot silently rot into a non-discriminating state.
