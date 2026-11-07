---
scope_id: build-site
topology_type: ICEBERG
use_cases: [UC-BuildSite]
covers: [REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-10, REQ-11, REQ-12, REQ-13, REQ-14, REQ-15, REQ-16, REQ-17, REQ-18, REQ-19, REQ-20, REQ-21]
depends_on: []
allowed_file_substrate: [build.mjs, build.test.mjs]
shared_substrate: []
affordance_manifest: []
e2e_verification_fixtures: ["node --test build.test.mjs"]
hill_phase: "UPHILL_UNKNOWN"
---

# Scope: build-site

## Why this slice
The whole feature is one call chain: `node build.mjs` loads the content file, validates it, renders the
PortfolioPage and writes `index.html`. The script and its `node --test` suite form a single vertical flow
from the CLI to the file system, so they ship as one scope. The entry point `build.mjs` has exactly one
owner, and no other scope exists to race it.

The generated page is static HTML with no JavaScript and no interactive states, so this scope declares no
affordances. The fixture is the test file. It exits 0 only when every Test Surface row of UC-BuildSite
holds, including the exit-1 error paths, which the test asserts inside itself.
