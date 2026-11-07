---
scope_id: build-page
topology_type: CHOWDER
use_cases: [UC-BuildPage]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21, REQ-22, REQ-23, REQ-24]
depends_on: []
allowed_file_substrate: [build.mjs, content.json, build.test.mjs, dist/**]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: build-page

## Why this slice

The whole feature is one call chain — `node build.mjs` reads the content file, validates, renders and
writes one page — carried by one zero-dependency script at the repo root, plus its sample content and its
`node --test` suite. There is no UI layer and no backend to split across, so the single flow is the single
scope (CHOWDER: one deliberate stray-free slice, not a directory cut). The fixture is `node --test`, which
exits 0 only when every Test Surface case of UC-BuildPage passes; the expected exit-1 error paths are
asserted inside the test file.

No interactive affordances: the deliverable is a CLI and a static page with no controls beyond links.
