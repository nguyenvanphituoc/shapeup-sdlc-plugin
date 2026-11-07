# EVAL one-page-site (round 1)

**Verdict: PASS** (spec-conformance, tdd-surface, completeness, test-surface-conformance all pass; 21 criteria, 17 Test Surface rows each graded by id, confidence medium)

## T0 citations
- scope build-site: .shapeup/one-page-site/t0/verdicts/r1-a1-t1.json sha256 ad3c27f64812cf3bad1174553d605a1766c3dd620bb73ca9b75ced55f0688c2d (recomputed with harness probe t0; matches)

## Build gate
.shapeup/one-page-site/build/r1-t1.json green: node --test 17/17.

## Criteria
Per-criterion evidence is in the WorkResult (.shapeup/one-page-site/results/evaluate-r1.json). Every UC-BuildSite and UC-RejectInvalidContent Test Surface row passes: the named test in build.test.mjs asserts the row's Expect and build.mjs implements it.

## Stability
No FAILs, no flips.

## Bugs
None.

## Caveats
- Shell probes were denied in this session, so the judge did not re-run node --test or node build.mjs; grading rests on the re-hashed T0 artifact, the build gate, and line-by-line reading of build.mjs and build.test.mjs. Confidence is medium.
- TS-REQ-env-override (default dist/ untouched) and TS-NOGO-01 (network unavailable) have no direct assertion; graded by source reading.
- The scope contract lists src/content.mjs and src/render.mjs; the implementation is a single build.mjs (inside the allowed substrate).

## NEXT ACTION
Proceed to QA / ship.
