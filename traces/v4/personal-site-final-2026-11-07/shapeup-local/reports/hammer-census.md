# GATE H — Census, personal-site (round 1)

```
⏸ GATE H0 — Census
Must-have (unresolved)  : 0
Nice-to-have (~)        : 4 — requirement evidence gap (10 REQs), QA not hunted, javascript: url, unspecified input shapes
Carry candidates        : none (build-site green, DOWNHILL_EXECUTION; no hammer proposals; breaker null)
```

Probes cited:
- `probe owner`: build.mjs owned by build-site, 0 unowned paths, 0 not on disk.
- `probe requirements`: 8/18 PASS (REQ-4, 12–18, all T0 249f7b9d14f3); 10 no evidence (REQ-1–3, 5–11).
  Those 10 have ticked board ACs and the round build gate ran `node build.mjs` green (exit 0); the
  committed output `dist/index.html` shows `<title>` = name, one `<h1>` + tagline, About, Projects with
  linked cards, Contact `mailto:`, inline `<style>`, no `<script>`, in pitch order. That is
  orchestrator inspection, not a judge's verdict, so they stay "no evidence" in the matrix.
- `probe attempts`: no proposal scopes.
- QA: `qa/hunt-report.md` — NOT HUNTED, 0 findings (execution refused in the non-interactive session).
- Discovery ledger: none on disk.

## Baseline comparison
Baseline not first-class — comparison is approximate (no `shaping/baseline.md`; the pitch's problem
statement is the implicit baseline: a slide deck sent as a PDF). A zero-dependency script that writes a
hostable page from one content file, with the pitch's edge behaviour graded PASS, is strictly better than
that baseline. No MUST-HAVE fails the comparison.

```
⏸ GATE H2 — Cut List & Verdict
Baseline      : approximate — pitch problem statement
Ship-blocking : none
Proposed cuts : 4 nice-to-have (see hammer-census.json cut_list), all carry-forward
Carry-forward : judge re-grade of REQ-1–3, 5–11 with execution; QA hunt with execution; url scheme filter;
                input-shape validation (orient D1–D3, D5)
Verdict       : SHIP now
```
