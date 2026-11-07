# Hunt Report — envlint (round 1, 2026-11-08)
charters: 4/4 · session units spent: 4
launch: `node bin/envlint.mjs` run directly (CLI, app_url null, no launch_cmd); real invocations exited 0/1/2 as specified.
out of bounds (excluded): none named (pause_gates false)
hammered out at GATE Q1 (not hunted): none (auto, charter list logged)

Charters: C-01 [①] .env value syntax the contract never bounded; C-02 [④] parse output as input to check/CLI echo; C-03 [⑤] unspecified argv/schema routes; C-04 [①] schema contents the contract never bounded.

## Findings by lens
| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01, C-04 | 3 | 0 |
| ② Concurrency | none (single-shot CLI, read-only) | 0 | 0 |
| ③ State interruption | none | 0 | 0 |
| ④ Cross-UC | C-02 | 2 | 1 |
| ⑤ No-go | C-03 | 1 | 0 |
| ⑥ Data residue | none (no state kept) | 0 | 0 |

Findings: QA-001 inline comments; QA-002 CR-only line endings; QA-003 unknown schema type accepted silently; QA-004 control/ANSI bytes echoed (contradicts TS-NOGO-02); QA-005 duplicate keys flagged on a shadowed earlier line; QA-006 repeated --schema silently last-wins.
Details with repro are in the WorkResult discoveries[].

## Shaping-quality signal (advisory)
- lens ① cluster ≈ env syntax (comments, quoting, line endings) left unbounded by the pitch
- lens ④ ≈ parse output echoed raw by the CLI

## Session notes
Probes ran from `.shapeup/envlint/qa/hunt.mjs` against scratch files outside the repo. Unconfirmed observations (not findings): `__proto__`/`constructor` schema keys behave as ordinary keys (fine); 3 MB value handled, 3 MB echoed; `--` is treated as the env filename (exit 2 then env-not-found would be expected only when two args; here `-- e1.env` gives usage). `node --test test/` note already in EVAL.
