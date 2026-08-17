---
schema_version: 1
doc_type: hammer-report
feature: envlint
round: 1
gate: H
---

# GATE H — Scope Hammer — envlint (round 1)

Trigger: normal stop — all scopes FINISHED on the hill, EVAL round 1 verdict PASS, no circuit
breaker tripped (`hammer_proposals: []`, no `--breaker` flag).

## GATE H0 — Census

Must-have (unresolved)  : 0
Nice-to-have (~)         : 6
  - QA-001 [UC-01, data-integrity] CRLF (`\r\n`) line endings make every valid `KEY=VALUE` line
    fail to parse — source: QA (qa-edge-hunter hunt-report.md, ledger)
  - QA-002 [UC-03, boundary-breach] E4 truncation slices by UTF-16 code unit, corrupting a
    surrogate pair straddling the 30-char cutoff — source: QA
  - QA-003 [UC-03, ux-degradation] An unrecognized flag before the positional envfile is
    silently captured as the envfile path — source: QA
  - QA-004 [UC-03, ux-degradation] Two positional file args silently drops the second — source: QA
  - E4 truncation semantics (byte vs char, ellipsis) unspecified by EXPECTED.md — source:
    discovered ledger (envlint/analyze), pre-existing open spec item, not graded as a defect at
    EVAL
  - `node --test test/` directory-positional-arg quirk in this sandbox (Node 24.15.0) — source:
    discovered ledger (envlint/cli-pipeline-r1-a1), environment quirk outside this scope's
    substrate, not a product defect
Carry candidates          : none — all 3 scopes (env-parsing, schema-rules, cli-pipeline)
  FINISHED, T0-green, kept, zero regressions (trial_history r1/a1); no scope exhausted its
  attempt_budget; no scope left uphill/downhill.

## GATE H1 — Baseline Comparison

Baseline: no `shapeup/envlint/shaping/baseline.md` on disk — degraded honestly to the pitch's
problem statement (`spec/_index.md` "Pitch digest") as the implicit baseline: today, without
envlint, `.env` files are validated manually or not at all, with no automated CI-exitable check
against a schema. Comparison below is approximate and flagged as such.

For each of the 6 nice-to-have items: with it left open, is the shipped CLI still strictly
better than "no automated .env validation" for the pitch's core problem (schema-validate a
`.env` file, exit non-zero for CI)?

- QA-001 (CRLF): YES — the tool still catches every LF-terminated file correctly (the large
  majority of the target audience per the pitch's own affected-line count); a CRLF file
  degrades to false-positive missing-key reports rather than a crash or a false "ok", so a CI
  user still gets a non-zero exit and visible output pointing at the file, not silent failure.
- QA-002 (surrogate truncation): YES — cosmetic corruption of one rendered slot in human-mode
  output only; `--json` mode and the finding's `line`/exit-code semantics are unaffected.
- QA-003 (flag-as-envfile): YES — fails loud (`Error: cannot read env file: --verbose`, exit 2),
  not silent; still strictly better than no tool.
- QA-004 (second positional arg dropped): YES — the first file is still fully and correctly
  checked; silent partial coverage is worse than a warning but still better than never checking
  either file.
- E4 truncation semantics (open spec item): YES — not a defect, a spec-completeness gap already
  disclosed at EVAL and not blocking any Test Surface row.
- `node --test test/` sandbox quirk: YES — a test-runner invocation quirk in this environment,
  not shipped product behavior; the scope's own e2e fixtures (file-level invocation) pass.

No item fails H1.2. Nothing is ship-blocking.

## GATE H2 — Cut List & Verdict

Baseline      : approximate — pitch problem statement (`shapeup/envlint/spec/_index.md`); no
                first-class `baseline.md` was written at shaping time.
Ship-blocking : none.
Proposed cuts : 6 nice-to-have, all cuttable —
  - QA-001 — CRLF line-ending support — safe: LF files unaffected, CI still gets a loud non-zero
    exit rather than a silent pass
  - QA-002 — codepoint-safe truncation — safe: cosmetic, human-mode only, JSON mode unaffected
  - QA-003 — unknown-flag detection before positional arg — safe: fails loud today, just with a
    misleading message
  - QA-004 — multi-file argv rejection/warning — safe: first file still fully checked
  - E4 truncation semantics — safe: pre-existing disclosed spec gap, not a regression
  - `node --test test/` directory-arg quirk — safe: sandbox/environment quirk, not product code,
    outside this scope's substrate
Carry-forward : all 6 items above, as debt-free raw ideas for the next cycle's discovery ledger
                (already present in `.shapeup/envlint/discovery/ledger.md` under their originating
                entries — no new write needed, none silently dropped).
Verdict       : SHIP now.

Ask (per workflow, max 1): "Confirm this cut list? (approve all / list ids to keep / none)" —
unattended orchestrated run (`interaction.pause_gates: false`); no PO response available in this
invocation. Per Hard Rules, this is not a ship-blocking situation (H1 found nothing that fails
the baseline test), so scope-hammer proposes SHIP now without needing an override; the PO's
actual confirm/keep decision is still owed at tech-lead's L4 Ship Sign-off gate before the run is
recorded as closed.
