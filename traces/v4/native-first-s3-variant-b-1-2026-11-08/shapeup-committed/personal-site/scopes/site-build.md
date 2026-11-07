---
scope_id: site-build
topology_type: ICEBERG
use_cases: [UC-BuildPage]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21]
depends_on: []
allowed_file_substrate: [build.mjs, test/build.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test test/build.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: site-build

## Why this slice
The whole feature is one call chain — `node build.mjs` → load + validate content → render →
write `index.html` — carried by one script and verified by one test file. Splitting the render from
the pipeline would put two scopes on the same file (`build.mjs`), which forces them to build one at a
time anyway; one scope is the honest cut for a one-round appetite. The deliverable is a CLI with no
interactive elements, so the affordance manifest is empty; the evaluator grades the Test Surface
with the `process` oracle.

The fixture `node --test test/build.test.mjs` exits 0 only when every Test Surface row's test passes;
the expected non-zero exits of the error paths are asserted inside that file.
