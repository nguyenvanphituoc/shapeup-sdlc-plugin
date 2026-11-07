# GATE H - one-page-site

Baseline: approximate (no shaping/baseline.md; pitch problem = portfolio kept in a slide deck sent as PDF). The product is a working static page built from content.json, strictly better.

Census:
- Requirements (probe requirements): 21/26 PASS, 4 CUT (PO), 1 no evidence (REQ-4, schema description, covered indirectly by other PASS rows).
- Ownership (probe owner): 0 unowned paths; src/render.mjs and src/content.mjs are cited by the wiring map but MISSING on disk (build.mjs exists, owned by build-site).
- QA: NOT HUNTED (node invocation refused in session); 0 findings.
- Ledger: 2 open entries, both notes. No breaker, no hammer proposals.

Ship-blocking: none.
Proposed cuts/carry: REQ-4, QA hunt, stale-dist decision, wiring-map path tidy.
Verdict: SHIP now (PO confirms cuts).
