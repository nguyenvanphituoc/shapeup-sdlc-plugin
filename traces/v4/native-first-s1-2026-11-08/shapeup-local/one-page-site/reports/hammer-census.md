# GATE H — Census, baseline comparison, cut list (one-page-site)

Probes cited: `probe owner --slug one-page-site --format table` (1 scope, 0 unowned paths, 0 missing);
`probe requirements --slug one-page-site --format table` (16/24 PASS, 8 no evidence). No attempt probes:
no hammer proposals. Breaker: none (normal stop after round-1 PASS).

```
⏸ GATE H0 — Census
Must-have (unresolved)  : 0 failing. 3 must-have clauses with no anchored PASS evidence — REQ-8 (section order),
                          REQ-9 (project title links), REQ-10 (mailto link) ← pitch.gate.md § Solution ¶3
                          [source: requirement]. Implemented per executor-ticked ACs, none refuted by EVAL.
Nice-to-have (~)        : 5 requirement evidence gaps (REQ-2, REQ-4, REQ-5, REQ-7, REQ-12) + 5 unrun QA
                          candidates + 1 planning spec gap
Carry candidates        : none (build-page FINISHED)
```

## Baseline comparison
Baseline not first-class (no `shapeup/one-page-site/shaping/baseline.md`) — comparison is approximate,
against the pitch's problem statement: the freelancer emails a PDF of a slide deck. The shipped `build.mjs`
turns one content file into a static page with every edge behaviour from the pitch exercised by a green
14-case `node --test` suite (T0 74c1df1b…). With the evidence gaps above carried as known gaps, the product
is strictly better than the baseline for the core problem. Nothing fails the comparison.

```
⏸ GATE H2 — Cut List & Verdict
Baseline      : approximate — pitch problem statement
Ship-blocking : none
Proposed cuts : 6 nice-to-have (5 unrun QA candidates, 1 spec gap) — all outside the pitch's stated
                behaviour; carried to the discovery ledger as raw ideas
Carry-forward : javascript: URL filtering; malformed project entries; untitled project / non-string name;
                stale OUT_DIR files; BOM handling; absent optional fields
Verdict       : SHIP now (known gaps: 8 REQs with no anchored PASS criterion; QA not-hunted; EVAL ran
                without executing node)
```
