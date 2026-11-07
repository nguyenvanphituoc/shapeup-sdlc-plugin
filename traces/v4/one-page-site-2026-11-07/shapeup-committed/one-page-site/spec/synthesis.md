---
type: synthesis
feature: one-page-site
generated_at: 2026-11-07
skill_version: "2.8"
coverage_status: 🟢
risk_status: 🟡
dependency_status: 🟢
depends_on:
  - "[[domain-model]]"
  - "[[ux-behavior]]"
  - "[[usecases/_index]]"
  - "[[scope-summary]]"
---

# Synthesis: One-page site

## Health Dashboard

| Indicator | Status | Signal |
|-----------|--------|--------|
| Coverage | 🟢 | 2 of 2 use cases covered by tasks |
| Risk | 🟡 | url-scheme policy and empty-name handling are open decisions with a stricter default encoded |
| Dependency | 🟢 | linear chain, one side task, no single point of failure beyond the first |

### Execution Gate (Synthesis)
⚠️ REVIEW — risk is yellow only for two decisions the PO may confirm at the board review.

---

## S-01 — Traceability Matrix

### UC × Task Coverage

| Use Case | Actor | Covering Tasks | Status |
|----------|-------|----------------|--------|
| [[usecases/UC-BuildSite]] | Freelancer | 5 | ✅ covered |
| [[usecases/UC-RejectInvalidContent]] | Freelancer | 2 | ✅ covered |

### UC × Entity Participation

| Use Case | Entity | Role |
|----------|--------|------|
| [[usecases/UC-BuildSite]] | `SiteContent` | target |
| [[usecases/UC-RejectInvalidContent]] | `SiteContent` | target |

**Entity orphans:** none.

### Screen → UC Backing

| Screen | Backed By | Status |
|--------|-----------|--------|
| GeneratedPage | [[usecases/UC-BuildSite]] | ✅ |
| BuildOutcome | [[usecases/UC-RejectInvalidContent]] | ✅ |

### Domain Event Flow
No domain events.

---

## S-02 — Risk Register

### Rabbit Hole Register

| Risk | From | Likelihood | Mitigation | Status |
|------|------|-----------|------------|--------|
| Partial or stale output on failure | [[_index#Rabbit Holes (Risks)]] | med | validate and render before write | ✅ mitigated |
| `javascript:` url | [[_index#Rabbit Holes (Risks)]] | med | http(s) allowlist (stricter reading) | ✅ mitigated |
| Wrong-shape JSON | [[_index#Rabbit Holes (Risks)]] | med | shape validation | ✅ mitigated |
| Stale `dist/index.html` survives a later failing build | [[integration]] | low | tests use a fresh output dir; PO may ask for cleanup | ⚠️ open decision |

### External Dependency Risks
None.

### Hammered Out (Cut)

| Cut | At | Reason | Traded for (if any) |
|-----|-----|-------|---------------------|
| — | — | nothing cut | — |

---

## S-03 — Dependency Shape

| Metric | Value |
|---|---|
| Critical path | 5 tasks · 7 hours · 88% of total estimated hours |
| Widest parallel wave | 2 tasks |
| Tasks with no dependency | 1 |
| Single points of failure (block > 2 downstream) | 1 |

The per-scope build order lives in the scope board, not here.
