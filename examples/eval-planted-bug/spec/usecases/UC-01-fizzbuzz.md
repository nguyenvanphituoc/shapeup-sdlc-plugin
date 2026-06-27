# UC-01 — Print the FizzBuzz sequence

**Actor:** CLI user
**Deliverable type:** CLI / script (non-UI → oracle `process`)

## Steps
1. User runs `fizzbuzz <n>` with a positive integer `n`.
2. The tool prints lines `1..n`, one per line.
3. Each line substitutes per the divisibility rules below.

## Input
- `n` — a positive integer (argv[1]).

## Output
- `n` lines on stdout; exit 0 on success, non-zero on bad input.

## Invariants
- **INV-01** — A line is `Fizz` iff its number is divisible by 3 and **not** by 5.
- **INV-02** — A line is `Buzz` iff its number is divisible by 5 and **not** by 3.
- **INV-03** — A line is `FizzBuzz` iff its number is divisible by **both** 3 and 5.
- **INV-04** — Otherwise the line is the number itself.
- **INV-05** — Invalid input exits non-zero without a stack trace.

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-01 | process | `fizzbuzz 2` | stdout `1\n2`, exit 0 | INV-04 |
| TS-02 | process | `fizzbuzz 3` | stdout contains `Fizz`, exit 0 | INV-01 |
| TS-03 | process | `fizzbuzz 5` | stdout contains `Buzz`, exit 0 | INV-02 |
| TS-04 | process | `fizzbuzz 15` | stdout contains `FizzBuzz`, exit 0 | INV-03 |
| TS-05 | process | `fizzbuzz abc` | exit ≠ 0, no stack trace | INV-05 |

> The full machine-readable form of these rows is `../../fizzbuzz.contract.json`. TS-04 is the
> row the planted bug violates — a skeptical evaluator must probe the running CLI to find it,
> because the build's own test suite is green and every AC box is ticked.
