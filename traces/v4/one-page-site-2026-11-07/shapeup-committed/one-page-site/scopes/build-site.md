---
scope_id: build-site
topology_type: CHOWDER
use_cases: [UC-RejectInvalidContent, UC-BuildSite]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24, REQ-25, REQ-26]
depends_on: []
allowed_file_substrate: [build.mjs, src/content.mjs, src/render.mjs, content.json, build.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures:
  - node --test
hill_phase: UPHILL_UNKNOWN
---

# Scope: build-site

## Why this slice
One call chain: `build.mjs` loads and validates content (`src/content.mjs`; failure path is one stderr line, exit 1, nothing written), renders (`src/render.mjs`) and writes `dist/index.html` once. Both use cases converge on the single entry point `build.mjs` and the single test file `build.test.mjs`, and the test-suite task anchors both, so splitting would give two scopes the same task and the same writable files (serialized anyway). One scope with an internal order (validate first, then render, then write, then tests) is the honest cut at this size. The generated page has no interactive elements, so the manifest is empty.
