# Hunt Report — envlint (round 1, 2026-11-08)
charters: 5/5 · session units spent: 5
deliverable reached: CLI `node bin/envlint.mjs --schema <schema.json> <envfile>`, driven directly (app_url null, no launch_cmd; build gate r1-t1 green). Driver: `.shapeup/envlint/qa/hunt.mjs`.
out of bounds (excluded): none named (pause_gates false; no question asked)
hammered out at GATE Q1 (not hunted): none (non-interactive order)
Test Surface present: yes (26 rows graded by EVAL) — not degraded.

## Findings by lens
| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01 line endings/quotes/comments, C-02 control chars/odd bytes, C-03 enum/args | 5 | 0 |
| ② Concurrency | not hunted (stateless read-only CLI, no shared state) | 0 | 0 |
| ③ State interruption | not hunted (single-shot process); closed-stdout not run | 0 | 0 |
| ④ Cross-UC journey | C-04 parse output as rules input (`__proto__`, `constructor` keys, dup keys) | 0 | 0 |
| ⑤ No-go probing | C-05 `${VAR}`, implicit `.env`, `--` positional, `--schema=` | 0 | 0 |
| ⑥ Data residue | n/a (tool writes nothing) | 0 | 0 |

Findings: QA-001 CR-only line endings, QA-002 url `http:///x` and bare-scheme hosts, QA-003 `--help`, QA-004 inline comment, QA-005 empty enum message, QA-006 control chars echoed.
Details live in the ledger under `## Discovered`.

## Shaping-quality signal (advisory)
- lens ① findings: line-ending and comment handling are left open by the pitch.
- url shape: "explicit scheme://host" is looser in code than the wording suggests.

## Session notes
- Held up with no finding: BOM (trim strips it), `__proto__`/`constructor`/`toString` as env or schema keys (Map + own-property checks; bad `type` values rejected), arabic-digit int rejected, huge int accepted, 300k-line file in ~150 ms, directory/missing/newline-path env files exit 2, duplicate keys last-wins, `--schema=path` works, `--` positional works, invalid UTF-8 and NUL do not crash.
- Unconfirmed: a 5 MB value is echoed whole into the finding line (harness buffer overflow, not a tool fault).
