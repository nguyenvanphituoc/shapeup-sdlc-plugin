---
type: ship-report
feature: one-page-site
date: 2026-11-07
verdict: PASS
rounds_used: 1
rounds_judged: 1
qa: not-hunted
intake_sha256: e69c916099de399af5f5f8a6de481c9b886b623e3c7c0fcc2895e2302a2d2235
---

# one-page-site — ship report

Frozen at GATE L4. Every figure below is derived from run artifacts on disk — the trial
ledger, the verdict artifacts, the board — never from a summary of the run.

## Outcome

| | |
|---|---|
| Verdict | **PASS** |
| Rounds used | 1 |
| Rounds judged | 1 |
| Board | 3/3 tasks done |
| T0 artifacts | 1 |
| QA | not-hunted |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| build-site | 1/1 | — | 1 | kept | baseline |

## Requirements

One row per registered clause. A requirement has evidence when an acceptance criterion
covers it AND a criterion grading it passed — `covers:` is the join, the judge's anchor is the
path back. This is a projection, never a verdict: it never blocked this ship.

**18/18 PASS** · run `one-page-site-20261107T111650Z-ca69af29`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.md § Solution shape ¶1 | PASS | "[[usecases/UC-BuildSite]]": `build.mjs` exists at the project root and `node build.mjs` with a valid `content.json` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-10) | TS-REQ-env-override (+1) → PASS,PASS | 759a9ae388de |
| REQ-2 | pitch.md § Solution shape ¶1 | PASS | "[[usecases/UC-BuildSite]]": The output has one `<style>` block and no `<script>`, no `on*=` attribute, no `<link>` and no `src=` (covers: REQ-2) | UC-BuildSite TS-INV-02 → PASS | 759a9ae388de |
| REQ-3 | pitch.md § Solution shape ¶2 | PASS | "[[usecases/UC-RejectInvalidContent]]": An unparsable file (`{not json`) or a non-object root (`null`, `[]`) → exit 1, one stderr line, nothing written (covers: REQ-15, REQ-3) (+1) | UC-BuildSite steps 1-8 and Done-when (spec-conformance) → PASS | 759a9ae388de |
| REQ-4 | pitch.md § Solution shape ¶3 (split 1/5) | PASS | "[[usecases/UC-BuildSite]]": `<title>` equals `name`, and the page has exactly one `<h1>` whose text is `name`, with the tagline after it (covers: REQ-4, REQ-9) | UC-BuildSite TS-INV-06 (+1) → PASS,PASS | 759a9ae388de |
| REQ-5 | pitch.md § Solution shape ¶3 (split 2/5) | PASS | "[[usecases/UC-BuildSite]]": Sections appear in order h1+tagline, About (with the `about` text), Projects, Contact (covers: REQ-5, REQ-8) | TS-REQ-layout → PASS | 759a9ae388de |
| REQ-6 | pitch.md § Solution shape ¶3 (split 3/5) | PASS | "[[usecases/UC-BuildSite]]": Each project renders as one card in array order; its title is an `<a href>` to its `url` (covers: REQ-6) | TS-REQ-projects-order → PASS | 759a9ae388de |
| REQ-7 | pitch.md § Solution shape ¶3 (split 4/5) | PASS | "[[usecases/UC-BuildSite]]": Contact renders a `mailto:<email>` link (covers: REQ-7) | TS-REQ-layout → PASS | 759a9ae388de |
| REQ-8 | pitch.md § Solution shape ¶3 (split 5/5) | PASS | "[[usecases/UC-BuildSite]]": Sections appear in order h1+tagline, About (with the `about` text), Projects, Contact (covers: REQ-5, REQ-8) | TS-REQ-layout → PASS | 759a9ae388de |
| REQ-9 | pitch.md § Solution shape ¶3 | PASS | "[[usecases/UC-BuildSite]]": `<title>` equals `name`, and the page has exactly one `<h1>` whose text is `name`, with the tagline after it (covers: REQ-4, REQ-9) | TS-REQ-layout → PASS | 759a9ae388de |
| REQ-10 | pitch.md § Solution shape ¶4 (split 1/2) | PASS | "[[usecases/UC-BuildSite]]": `build.mjs` exists at the project root and `node build.mjs` with a valid `content.json` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-10) | TS-REQ-env-override → PASS | 759a9ae388de |
| REQ-11 | pitch.md § Solution shape ¶4 (split 2/2) | PASS | "[[usecases/UC-BuildSite]]": `CONTENT_FILE=<tmp>/c.json OUT_DIR=<tmp>/out node build.mjs` reads that file and writes `<tmp>/out/index.html` (covers: REQ-11) | TS-REQ-env-override → PASS | 759a9ae388de |
| REQ-12 | pitch.md § Edge behaviour 1 | PASS | "[[usecases/UC-BuildSite]]": A project with no `url` (or a blank or non-`http(s)` url such as `javascript:alert(1)`) renders its title as plain text: no `<a>`, no `href="#"`, no `href=""` (covers: REQ-12) | UC-BuildSite TS-INV-05 → PASS | 759a9ae388de |
| REQ-13 | pitch.md § Edge behaviour 2 | PASS | "[[usecases/UC-BuildSite]]": `projects: []` or absent → the Projects section contains "Projects are coming soon." and no `<ul>`/`<li>` (covers: REQ-13) | TS-REQ-projects-empty → PASS | 759a9ae388de |
| REQ-14 | pitch.md § Edge behaviour 3 | PASS | "[[usecases/UC-BuildSite]]": A project titled `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;` with no raw `<b>` from content (covers: REQ-14) | UC-BuildSite TS-INV-04 → PASS | 759a9ae388de |
| REQ-15 | pitch.md § Edge behaviour 4 | PASS | "[[usecases/UC-RejectInvalidContent]]": A missing content file → exit 1, exactly one stderr line naming the path, no `index.html` and no output dir created (covers: REQ-15) (+2) | UC-RejectInvalidContent TS-INV-01 (+3) → PASS,PASS,PASS,PASS | 759a9ae388de |
| REQ-16 | pitch.md § Edge behaviour 5 | PASS | "[[usecases/UC-RejectInvalidContent]]": Missing, non-string or blank `name` → exit 1, one stderr line mentioning `name`, nothing written (covers: REQ-16, REQ-3) | TS-ERR-E_NAME_MISSING (+1) → PASS,PASS | 759a9ae388de |
| REQ-17 | pitch.md § Edge behaviour 6 | PASS | "[[usecases/UC-BuildSite]]": Two consecutive builds of the same content produce byte-identical files (covers: REQ-17) | UC-BuildSite TS-INV-01 → PASS | 759a9ae388de |
| REQ-21 | pitch.md § Verification | PASS | "[[usecases/UC-BuildSite]]"/"[[usecases/UC-RejectInvalidContent]]": `test/build.test.mjs` exists, uses only `node:test`, `node:assert`, `node:child_process`, `node:fs`, `node:os`, `node:path` (covers: REQ-21) (+3) | node --test suite covers every Test Surface row (tdd-surface) → PASS | 759a9ae388de |

## Ratchet

Measured over this run's trial ledger. A monotone series is a ratchet working; a flat or
sawtooth series says the loop is still a budgeted retry loop wearing a ratchet's shape.

| | |
|---|---|
| Trials | 1 across 1 scope(s), 0 with more than one attempt |
| Improvement rate | 0 — kept ÷ trials after the first |
| Monotone rate | 0 — multi-trial scopes whose score never decreased |
| Sawtooth count | 0 — a revert immediately after a keep |
| Mean trials to green | 1 |
| Statuses | kept 1 |

> No scope needed a second attempt, so the rates above are vacuous rather than bad:
> the ratchet was never asked to climb. The Day-1 question — does the loop measurably
> improve across attempts — needs a run where at least one scope retries.

### Refuted criteria and bugs

None.

## QA findings

none (not hunted)

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
