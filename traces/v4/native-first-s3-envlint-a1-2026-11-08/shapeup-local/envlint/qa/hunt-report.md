# Hunt Report — envlint (round 1, 2026-11-08)
charters: 4/4 · session units spent: 4
deliverable reached: `node bin/envlint.mjs --schema s.json <env>` run live (no app_url, no launch_cmd; CLI entry point). Output and exit lines observed directly.
out of bounds (excluded): none stated (pause_gates false)
hammered out at GATE Q1 (not hunted): none (auto; lenses 2, 3, 6 have no meaningful ground in a stateless one-shot CLI)

## Findings by lens
| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| 1 Boundary | C-01 (values/syntax), C-02 (schema keys) | 2 | 0 |
| 4 Cross-UC journey | C-03 (parse -> rules -> CLI chain) | 1 | 0 |
| 5 No-go probing | C-04 (argument surface) | 1 | 0 |

## Findings
- QA-001 inline comment `A=5 # c` is read as value `5 # c`, so an int rule reports `expected int, got "5 # c"`. Contract is silent on inline comments.
- QA-002 `A="x"y` (closing quote followed by text) is reported `unterminated quote`, which is misleading. EVAL noted this as an observation; it is reproduced here.
- QA-003 `--` and `-` are rejected with the usage line (exit 2). No end-of-options marker, no stdin env input, so an env file named `-foo` cannot be linted.
- QA-004 Dotted-name and prototype-named keys (`__proto__`, `constructor`) were exercised and behaved correctly (no finding). Unconfirmed concerns: none.

## Not findings (checked, behaved)
BOM-prefixed file (trim strips it), directory as env or schema (exit 2, one `envlint:` line), `__proto__`/`constructor` keys in schema and env, duplicate key last-wins, same-line double finding.

## Shaping-quality signal (advisory)
- lens 1 findings: value syntax (comments, quote tails) left unbounded in the pitch.
- lens 5 finding: argument grammar left open.

## Session notes
Shell writes for fixtures were refused by the sandbox, so fixtures were written under .shapeup/envlint/qa/fx/. Exit codes for the CLI were taken from the contract and the usage output; the harness did not allow `$?` capture in the shell, so exit 2 is asserted from stderr-only output and the code path (fail() exits 2), not from a captured value.
