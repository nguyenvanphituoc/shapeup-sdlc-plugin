---
scope_id: build-site
topology_type: ICEBERG
use_cases: [UC-BuildSite]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18]
depends_on: []
allowed_file_substrate: [build.mjs, content.json, build.test.mjs, dist/**]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node build.mjs", "node --test build.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: build-site

## Why this slice
The whole feature is one call chain — read `content.json`, validate, render, write `dist/index.html` —
in one zero-dependency script, so it is one scope. ICEBERG: all the weight is in the render and the
edge behaviour, with no UI layer to balance it. The page has no interactive elements, so the affordance
manifest is empty. The fixtures exit 0 when the scope is correct: the real build over the sample
`content.json`, and the test suite, which asserts the expected non-zero exits of the error paths inside
itself.
