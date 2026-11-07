# EVAL — one-page-site (round 1, feature-level)

**Verdict: PASS**

Dimensions: spec-conformance, tdd-surface, completeness, test-surface-conformance (all PASS).

## T0 citations
| scope | path | sha256 (recomputed via `probe t0`) |
|---|---|---|
| build-page | .shapeup/one-page-site/t0/verdicts/r1-a1-t1.json | 74c1df1b187b47230fa49263c01a552cfc7c9e2598c127d1e6657adcd2b94b18 |

The artifact is green: `node --test` exit 0, 14/14 pass, each Test Surface row printed by name.

## Evidence limits
This judge could not execute `node` in its sandbox (every invocation was refused for approval), so the
app was not driven directly. Test Surface rows are graded on the T0 fixture output after reading
`build.test.mjs`: each named check asserts its row's Expect. Spec steps and invariants were also read
against `build.mjs` line by line. Confidence is medium on rows that rest on the fixture alone.

## Test Surface (test-surface-conformance)
| Row | Verdict | Confidence | Evidence |
|---|---|---|---|
| TS-INV-01 | PASS | medium | T0 "✔ TS-INV-01"; check compares file text before/after two builds, build.mjs:22 is the only content access (read) |
| TS-INV-02 | PASS | medium | T0 "✔ TS-INV-02"; byte compare of two builds; no timestamps/randomness in build.mjs |
| TS-INV-03 | PASS | medium | T0 "✔ TS-INV-03"; exit 1 and no index.html; fail() exits before mkdirSync (build.mjs:84) |
| TS-INV-04 | PASS | medium | T0 "✔ TS-INV-04"; esc() at build.mjs:12 applied to every value |
| TS-INV-05 | PASS | medium | T0 "✔ TS-INV-05"; no script in template |
| TS-INV-06 | PASS | medium | T0 "✔ TS-INV-06"; one `<h1`, `<title>` = name |
| TS-INV-07 | PASS | medium | T0 "✔ TS-INV-07"; build.mjs:39 plain text when url falsy |
| TS-INV-08 | PASS | medium | T0 "✔ TS-INV-08"; build.mjs:44-46 |
| TS-ERR-CONTENT_MISSING | PASS | medium | T0 named; check asserts exit 1, one line, file name, no output |
| TS-ERR-CONTENT_UNPARSEABLE | PASS | medium | T0 named; asserts exit 1, one line, "JSON", no output |
| TS-REQ-name-missing | PASS | medium | T0 named; asserts exit 1, one line, "name", no output |
| TS-NOGO-01 | PASS | medium | T0 named; literal markdown, no strong/em |
| TS-NOGO-02 | PASS | medium | T0 named; out dir is exactly ["index.html"] |
| TS-NOGO-03 | PASS | medium | T0 named; exit 0, no signal, process ends on its own |

## spec-conformance / completeness / tdd-surface
- Steps 1-7 and error codes CONTENT_MISSING, CONTENT_UNPARSEABLE, NAME_MISSING: implemented at build.mjs:4-5, 20-36, 84-85. PASS.
- INV-01 to INV-08: PASS (above). Page section order matches ux-behavior GeneratedPage. PASS.
- tdd-surface: `node --test` is the named verification fixture and it is green. PASS.

## Bugs
None filed.

## Notes
- Spec gap (already raised in the UC): no behavior for a non-string `name`. Not graded.
- Default-path run (`node build.mjs` with no env, writing dist/) was not driven by this judge; code reading at build.mjs:4-5 shows the defaults.

## NEXT ACTION
Proceed to QA / ship.
