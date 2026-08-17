---
type: eval-report
feature: envlint
round: 2
dimension: spec-conformance
verdict: PASS
generated_at: 2026-08-17
---

# EVAL — feature: envlint — round 2

## Verdict: PASS (spec-conformance)

## Scope of this pass
Feature-level pass against `shapeup/envlint/spec/usecases/UC-01.md` (Steps, Error Cases,
Invariants, Test Surface), `shapeup/envlint/spec/domain-model.md`, and
`shapeup/envlint/spec/scope-summary.md` Done-when statements (`payload.dimensions =
["spec-conformance"]`, round 2). Probed the built binary `bin/envlint.mjs` and its unit modules
`src/parsing.mjs` / `src/rules.mjs` directly (browser: none — process/CLI feature), and ran the
full committed test suite (`node --test`).

## T0 citations (recomputed sha256 from disk)
| scope_id | artifact | sha256 (recomputed) | overall |
|---|---|---|---|
| parsing-engine | `.shapeup/envlint/t0/verdicts/r2-a1-t1.json` | `c18b714f07bc0c58b2b260544fa6f4da86a41833e93f2c42e2a1aa0f83a47c8e` | green |
| rules-engine | `.shapeup/envlint/t0/verdicts/r2-a1-t2.json` | `385fee385bfc73f213fb4a922f3dc88e257465256d6480b52a70f1bf1965c351` | green |
| cli-composition-root | `.shapeup/envlint/t0/verdicts/r2-a1-t3.json` | `4e8a00f298311a1ffa0ea3fc4547576df33ca43a1bb653f7c8ca4cc4ef06e908` | green |
| test-surface-suite | `.shapeup/envlint/t0/verdicts/r2-a1-t4.json` | `6a3b7d238b5734f582d1594e124be7aa54e2bbd9f7602d63c9b6807be5d7fcb0` | green |

All four round-2 scopes hold a T0 artifact, all `overall: "green"`, matching
`payload.trial_history` in the order (trial 1/round1 → trial 2/round2 for parsing-engine and
rules-engine, plus new trial 1/round2 for cli-composition-root and test-surface-suite). No
scope is missing a citation this round — the round-1 defect (TASK-004 deliverable absent) is
resolved: `test/test-surface.test.mjs` now exists and drives the built binary once per `TS-*`
row via `child_process.spawnSync` against real fixtures (`test/test-surface.test.mjs:1-16`).

## Independent re-probe (beyond the T0 fixture run)
Ran `node --test` directly against the full `test/` directory (not just the per-scope fixture
each T0 trial ran individually): **64/64 pass, 0 fail** — `cli.test.mjs` (10),
`parsing.test.mjs` (12), `rules.test.mjs` (12), `test-surface.test.mjs` (26 — one per committed
`TS-*` row in UC-01's Test Surface table, TS-INV-01 through TS-NOGO-04, no row missing).
Cross-checked `bin/envlint.mjs:68-88` against UC-01 Steps 6-8 (LintReport composition, `--json`
branch, human branch, `ok`/`N problem(s)` wording) and `src/rules.mjs`'s `case "url"` block
against the spike-pinned protocol-gate behavior (TS-TYPE-url-scheme-gate /
TS-TYPE-url-leniency) — source matches spec on inspection, corroborating the process-level
test evidence rather than substituting for it.

## Criteria — spec-conformance

| Criterion | Probe | Verdict | Confidence | Evidence |
|---|---|---|---|---|
| UC-01 Steps 1-8 (argv parse → schema read → env read → parseEnv → evaluate → compose → render → exit) | [cmd] | PASS | high | `node --test` — `cli.test.mjs` all 10 pass; `bin/envlint.mjs:1-90` matches Steps order |
| INV-01 (extra key never a finding) | [cmd] | PASS | high | TS-INV-01 pass, `test/test-surface.test.mjs:34-40` |
| INV-02 (dedup: last wins, earlier produces nothing) | [cmd] | PASS | high | TS-INV-02 / TS-INV-02b pass, `test/test-surface.test.mjs:42-58` |
| INV-03 (exit code always 0/1/2, no stack trace) | [cmd] | PASS | high | TS-INV-03 pass |
| INV-04 (`--json` changes only rendering, not branch/exit) | [cmd] | PASS | high | TS-INV-04 pass |
| INV-05 (exit-2 stderr `Error: ` prefix, single line, no stack) | [cmd] | PASS | high | TS-INV-05 pass |
| INV-06 (E3 zero-required exemption) | [cmd] | PASS | high | TS-INV-06 pass |
| Error Cases E_NOFLAG/E_SCHEMA_UNREADABLE/E2/E1/E3/E4/E5 | [cmd] | PASS | high | TS-ERR-* (7 rows) all pass |
| Type rules: int/bool/url/enum/empty-value | [cmd] | PASS | high | TS-TYPE-* (7 rows) all pass |
| Non-Go: no interpolation / no `.env` writes / no colors-TUI-prompts / no network | [cmd] | PASS | high | TS-NOGO-01..04 all pass |
| domain-model.md value objects (`EnvPair`/`ParseProblem`/`SchemaRule`/`Finding`/`LintReport`) | [cmd] | PASS | high | `parsing.test.mjs` + `rules.test.mjs` unit-level assertions on each shape, all pass |
| scope-summary.md Wave 3 Done-when (`test/test-surface.test.mjs` drives binary per TS-* row) | [cmd] | PASS | high | file exists, 26 tests, `child_process.spawnSync` against real fixtures — round-1 defect resolved |

## Stability / flip check
Round-1 verdict was FAIL (missing `test-surface.test.mjs`, T0 gaps on two scopes). Round-2:
the missing file now exists, all four scopes carry green T0 artifacts, and re-probing found no
disagreement — this is a genuine fix, not a flaky flip. No re-probe disagreements this round
(no FAIL criteria to re-probe).

## Bugs
None found this round.

## Refuted
None — no task claims contradicted by evidence.

## NEXT ACTION
Ship. All spec-conformance criteria PASS with high confidence; all four round-2 scopes hold
matching green T0 citations.
