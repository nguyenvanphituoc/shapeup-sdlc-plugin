# Changelog for scope-hammer

| Version | Date | Changes |
|---------|------|---------|
| 0.2 | 2026-07-14 | **Domain-layer alignment.** Documented the envelope contract: orchestrated dispatch is WorkOrder in (`--order`) / WorkResult out like every worker; standalone flags map 1:1 onto the payload fields registered in the central domain registry (`domain.schema.json` `x-payload-by-worker`), and output fields follow `x-result-by-worker`. No behavior change. |
| 0.1 | 2026-07-12 | Initial release (design spec v1.1 step 11 / DD-9 / Blueprint A `hammer_proposals`). GATE H0 census (scopes + QA + discovered + advisor-overflow) → GATE H1 baseline comparison (never vs. a perfect ideal) → GATE H2 cut list + verdict, PO-confirmed. Handles all three triggers: normal stop, outer breaker, inner (per-scope) breaker. |
