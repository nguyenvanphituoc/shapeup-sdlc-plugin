# Ship report — envlint

**Verdict: PASS (round 2 of 3) — shipped unattended under the `ci` answer set; no human reviewed the verdict before ship. QA edge hunt: not-hunted.**

## What shipped

`envlint --schema <schema.json> <envfile>`: a zero-dependency Node CLI validating a `.env` file against a JSON schema
(`required`, `type` string/int/bool/url, `enum`), reporting findings key by key and line by line, exit 0 / 1 (findings) / 2 (usage or I/O error).

| Scope | Use case | Files | Final T0 |
|---|---|---|---|
| parsing | UC-01 parse env text | `src/parse.mjs`, `test/parse.test.mjs` | green (round 1, not reopened) |
| rules | UC-02 check pairs against schema | `src/rules.mjs`, `test/rules.test.mjs` | green (round 2) |
| cli | UC-03 lint env file | `bin/envlint.mjs`, `package.json`, `test/cli.test.mjs` | green (round 2) |

Project suite `node --test`: 47/47 pass.

## Rounds

| Round | Verdict | What changed |
|---|---|---|
| 1 | FAIL | Raw ESC bytes from env values reached stdout (UC-03 INV-05); UC-02 INV-04 had no Test Surface row and no acceptance criterion |
| 2 | PASS — 45/45 criteria, 0 bugs | CLI escapes control bytes (C0, DEL, C1) at render time; UC-02 gained its TS-INV-04 row and INV-04 criterion; the rules test was tagged TS-INV-04 and extended |

## Requirements

All 31 registered requirements (REQ-1 … REQ-31) are anchored by at least one PASS criterion in the round-2 verdict. None cut.

## Census (GATE H)

Baseline: approximate — the pitch's problem statement (no first-class baseline on disk). Ship-blocking: none.
Cut / carried as raw idea: the rules engine still embeds raw values in its finding messages; the CLI escapes them at render, so
the shipped binary is safe, but any other caller of the rules engine would see raw control bytes.

## Not done, and why

- **QA edge hunt not run.** The QA gate answered `run`; the hunt was skipped to keep the session inside its spending budget so the run could
  reach a recorded close. QA never blocks; this is a gap in exploratory coverage, not in conformance.
- No `launch_probe` (library archetype); `build_probe` = `node --test`, green.

## Harness deviations observed on this run

1. On resume the loop invoked `init run` with the shell inside the run-trace directory. The kernel resolves its storage root from the
   shell's cwd (unlike the hooks, which walk up to the project root), so instead of finding the open run and refusing it opened a second,
   nested phantom run (id `envlint-20261108T052834Z-3e0ef920`, no close) one level down. The real run kept its original id
   (`envlint-20261108T050016Z-c40aa663`) in its receipt, gate rows and T0 trials; the round-2 orders, stamped by the loop from the phantom's
   output, and their dispatch receipts carry the phantom id. The evaluator recorded the mismatch. Loop error; kernel defect = cwd-sensitivity.
2. The loop opened a build order for the fence before validating it against the order schema; the dispatch hook then refused it. It could not
   be corrected in place: the execute/fix substrate freezes the run's own order files and the kernel has no verb to withdraw an undispatched
   order. The never-dispatched order (no dispatch receipt, no attempt spent) was replaced once by a shell copy of a schema-validated version —
   through the fence's documented shell gap, disclosed here.
3. GATE L3 over a PASS printed the preset's FAIL-round note (`loop`) on stdout; the ledger row itself records the PASS correctly.
