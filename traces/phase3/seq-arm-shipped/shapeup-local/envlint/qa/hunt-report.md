# Hunt Report — envlint (round 1, 2026-08-17)

charters: 11/11 · session units spent: 11
out of bounds (excluded): none (no out-of-bounds question raised — CLI has no network/payments/
production-data surface to exclude; standing question answered "none applicable")
hammered out at GATE Q1 (not hunted): none (`interaction.pause_gates: false` on this order — Q1
logged, not paused; no cuts requested)

## Charter map

| ID | Lens | Ground | Result |
|---|---|---|---|
| C-01 | ①boundary | CRLF line endings (`\r\n`) in env file | **finding QA-001** |
| C-02 | ①boundary | UTF-8 BOM at file start | clean — JS `\s` includes U+FEFF, stripped by leading-whitespace match |
| C-03 | ①boundary | `__proto__` as a literal schema JSON key | clean — `JSON.parse` creates a normal own property, iterates fine |
| C-04 | ①boundary | signed/leading-zero/huge-digit-string int values (`-5`,`+5`,`007`,17-digit) | clean — matches regex contract exactly, `+5` correctly rejected (spec allows only `-`) |
| C-05 | ①boundary | non-ASCII key (`ÜNIC=café🎉`) | clean — correctly falls to E4 per ASCII-only key regex (spec-consistent) |
| C-06 | ①boundary | E4 truncation splitting a surrogate pair (emoji) at the 30-char cut | **finding QA-002** |
| C-07 | ①boundary | argv shape: unrecognized flag (`--verbose`) before the positional envfile | **finding QA-003** |
| C-08 | ①boundary | argv shape: two positional file args given | **finding QA-004** |
| C-09 | ④cross-uc | `$VAR` / `${VAR}` values through the full UC-01→UC-02→UC-03 chain | clean — no interpolation performed, no-go holds |
| C-10 | ⑤no-go | `url` type check against an unresolvable host | clean — instant return (~30ms), no DNS/network attempt, no hang |
| C-11 | ①boundary | 200,000-line env file (throughput/hang check) | clean — 0.14s wall, no crash |

## Findings by lens

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01,02,03,04,05,06,07,08,11 | 4 | 0 |
| ④ Cross-UC journey | C-09 | 0 | 0 |
| ⑤ No-go probing | C-10 | 0 | 0 |

→ full finding text lives in `.shapeup/envlint/discovery/ledger.md` under the `## Discovered`
section ingest appends for this hunt's order.

### Findings (summary)

- **QA-001** [UC-01, data-integrity] A `\r\n`-terminated env file fails to parse *any* line: the
  assignment regex's `.` never matches `\r`, so every syntactically valid `KEY=value\r` line is
  captured whole (including the trailing `\r`) by nothing and instead falls through to the
  "no match" branch, becoming an E4 problem. Repro: write `FOO=bar\r\nBAZ=qux\r\n`, run
  `envlint --schema <schema requiring FOO,BAZ> <file>` → both lines reported as
  "not a KEY=VALUE assignment", both required keys reported missing, exit 1. CRLF is a common
  line ending (Windows editors, `git checkout` with `core.autocrlf`) and UC-01's contract makes no
  mention of only supporting `\n`.
- **QA-002** [UC-03 E4 render, boundary-breach] The 30-char truncation in `bin/envlint.mjs`'s
  `truncate()` slices the raw line by UTF-16 code unit (`text.slice(0, max)`), not by codepoint.
  When a multi-byte character (e.g. an emoji surrogate pair) straddles index 30, the slice cuts
  the surrogate pair in half, producing an unpaired surrogate that Node encodes to stdout as the
  UTF-8 replacement character `U+FFFD` (visible as `�`) — corrupted, not just truncated, output.
  Repro: env line = 29 `x` chars + 🎉 + more text (invalid assignment) → human-mode output shows
  `...xxxxxxxxxxxxxxxxxxxxxxxxxxxxx�: not a KEY=VALUE assignment`. Related to but goes beyond the
  EVAL's already-flagged open spec item (byte-vs-char truncation semantics); this is a concrete
  observable corruption, not just an unresolved semantics question.
- **QA-003** [UC-03 argv parsing, ux-degradation] An unrecognized flag (e.g. `--verbose`) is
  silently captured by `parseArgv`'s `else if (!envfile)` branch as the positional envfile
  argument, since it doesn't match `--schema`/`--json` and `envfile` is still unset. The real
  envfile argument that follows is dropped. Repro:
  `envlint --schema s.json --verbose real.env` → `Error: cannot read env file: --verbose`, exit 2
  — a misleading error naming a flag as a missing file, not "unknown option --verbose".
- **QA-004** [UC-03 argv parsing, ux-degradation] Passing two positional file arguments silently
  ignores the second one instead of erroring. Repro: `envlint --schema s.json a.env b.env` runs
  only against `a.env`; `b.env` is silently dropped, no warning, exit reflects only `a.env`.

## Shaping-quality signal (advisory, for the PO — next cycle's input)

- Lens ① dominates all findings (4/4) — the argv contract (`parseArgv`) and the line-splitting
  contract (`text.split('\n')`) were both written assuming a narrower input shape (LF-only lines,
  well-formed flag lists) than the pitch's stated audience (developer/CI environments, which are
  frequently Windows or mixed-line-ending checkouts). Not a UC decomposition problem (lens ④ found
  nothing) and not a no-go gap (lens ⑤ clean) — this is squarely a spec-completeness gap in UC-01
  (line-ending assumption) and UC-03 (argv-shape assumption), worth a Test Surface row each next
  round rather than a re-shape.

## Session notes

All 11 charters completed within their time box; no unconfirmed observations, no charter
exhausted with open scent. Fixtures used for this hunt live under
`.shapeup/envlint/qa/fixtures/` (this scope's substrate) and are left in place as reproduction
artifacts.

✅ hunt complete — 4 findings (all ~) → ledger · triage at SHIP S.0 / GATE L4.
