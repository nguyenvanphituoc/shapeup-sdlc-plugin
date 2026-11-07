---
scope_id: build-site
topology_type: ICEBERG
use_cases: [UC-BuildSite, UC-RejectInvalidContent]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-21]
depends_on: []
allowed_file_substrate: [build.mjs, test/**, content.json]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: [node --test]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: build-site

## Why this slice
The whole feature is one call chain: `node build.mjs` → load and validate content → render in memory →
write one page. The success and rejection use cases share the same entry point and engine file, so
splitting them would put two scopes on one read-modify-write file and force them to build one at a time
anyway. One vertical scope owns the CLI, its validation, its rendering and the `node --test` suite that
proves the Test Surface rows of both use cases. `content.json` is in the substrate only so the scope may
add a sample content file for a first build; the build itself must never write it.

The fixture `node --test` exits 0 when the scope is correct: every expected non-zero exit of the
rejection path is asserted inside the test file, never invoked as a bare fixture.
