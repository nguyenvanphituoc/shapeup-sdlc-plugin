---
type: ship-report
feature: one-page-site
date: 2026-11-07
verdict: PASS
rounds_used: 1
rounds_judged: 1
qa: not-hunted
intake_sha256: e9a8bede6769986e6a6b4a6973f3cab73cb853a53346ad7b3570870634f63f23
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
| Board | 6/6 tasks done |
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

**21/26 PASS · 4 CUT (PO) · 1 no evidence (REQ-4 ← pitch, Solution shape)** · run `one-page-site-20261107T095344Z-6c01fa6f`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch, Solution shape | PASS | UC-BuildSite: `node build.mjs` with defaults reads `content.json` and writes a single `dist/index.html` (covers: REQ-1, REQ-24) | UC-BuildSite Steps 1-8 (+1) → PASS,PASS | ad3c27f64812 |
| REQ-2 | pitch, Solution shape | PASS | UC-BuildSite: Rendered HTML has CSS inside a `<style>` element and no `<script>` element or external resource (covers: REQ-2, REQ-3, REQ-22) | UC-BuildSite TS-INV-02 (+1) → PASS,PASS | ad3c27f64812 |
| REQ-3 | pitch, Solution shape | PASS | UC-BuildSite: Rendered HTML has CSS inside a `<style>` element and no `<script>` element or external resource (covers: REQ-2, REQ-3, REQ-22) | UC-BuildSite TS-INV-02 (+1) → PASS,PASS | ad3c27f64812 |
| REQ-4 | pitch, Solution shape | no evidence | UC-RejectInvalidContent: A valid content file with `name`, `tagline`, `about`, `projects[{title,summary,url}]`, `contact{email}` is accepted; absent `projects` is treated as empty (covers: REQ-4) | — | — |
| REQ-5 | pitch, Solution shape | PASS | UC-BuildSite: Rendered HTML has exactly one `<h1>` containing the name, the tagline directly after it, then About, Projects, Contact sections in that order (covers: REQ-5, REQ-6) | UC-BuildSite TS-REQ-layout (+1) → PASS,PASS | ad3c27f64812 |
| REQ-6 | pitch, Solution shape | PASS | UC-BuildSite: Rendered HTML has exactly one `<h1>` containing the name, the tagline directly after it, then About, Projects, Contact sections in that order (covers: REQ-5, REQ-6) | UC-BuildSite TS-REQ-layout (+1) → PASS,PASS | ad3c27f64812 |
| REQ-7 | pitch, Solution shape | PASS | UC-BuildSite: Each project renders as one card, in array order, and its title is an `<a href>` to its url when the url is an allowed http(s) url (covers: REQ-7, REQ-8) | UC-BuildSite TS-REQ-projects-order (+1) → PASS,PASS | ad3c27f64812 |
| REQ-8 | pitch, Solution shape | PASS | UC-BuildSite: Each project renders as one card, in array order, and its title is an `<a href>` to its url when the url is an allowed http(s) url (covers: REQ-7, REQ-8) | UC-BuildSite TS-REQ-projects-order (+1) → PASS,PASS | ad3c27f64812 |
| REQ-9 | pitch, Solution shape | PASS | UC-BuildSite: Contact section renders a `mailto:` link with the escaped email (covers: REQ-9) | UC-BuildSite TS-REQ-layout (+1) → PASS,PASS | ad3c27f64812 |
| REQ-10 | pitch, Solution shape | PASS | UC-BuildSite: `<title>` equals the escaped name (covers: REQ-10) | UC-BuildSite TS-REQ-layout (+1) → PASS,PASS | ad3c27f64812 |
| REQ-11 | pitch, Edge behaviour | PASS | UC-BuildSite: A project with no `url` renders its title as plain text; the output contains no `href="#"` and no `href=""` (covers: REQ-11) | UC-BuildSite TS-INV-05 (+1) → PASS,PASS | ad3c27f64812 |
| REQ-12 | pitch, Edge behaviour | PASS | UC-BuildSite: Zero or absent projects renders the sentence "Projects are coming soon." in the Projects section (covers: REQ-12) | UC-BuildSite TS-REQ-projects-empty (+1) → PASS,PASS | ad3c27f64812 |
| REQ-13 | pitch, Edge behaviour | PASS | UC-BuildSite: Zero projects renders no `<ul>`, `<ol>` or `<li>` in the Projects section (covers: REQ-13) | UC-BuildSite TS-REQ-projects-empty (+1) → PASS,PASS | ad3c27f64812 |
| REQ-14 | pitch, Edge behaviour | PASS | UC-BuildSite: All content text and attribute values are escaped for `& < > " '` with `&` first; a title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;` (covers: REQ-14) | UC-BuildSite TS-INV-04 (+1) → PASS,PASS | ad3c27f64812 |
| REQ-15 | pitch, Edge behaviour | PASS | UC-RejectInvalidContent: `node build.mjs` with `CONTENT_FILE` pointing at a nonexistent file exits 1, prints exactly one line on stderr naming the problem, and creates no `index.html` in a fresh `OUT_DIR` (covers: REQ-15, REQ-16, REQ-17) (+1) | UC-RejectInvalidContent TS-ERR-CONTENT_MISSING (+5) → PASS,PASS,PASS,PASS,PASS,PASS | ad3c27f64812 |
| REQ-16 | pitch, Edge behaviour | PASS | UC-RejectInvalidContent: `node build.mjs` with `CONTENT_FILE` pointing at a nonexistent file exits 1, prints exactly one line on stderr naming the problem, and creates no `index.html` in a fresh `OUT_DIR` (covers: REQ-15, REQ-16, REQ-17) (+1) | UC-RejectInvalidContent TS-INV-02 (+5) → PASS,PASS,PASS,PASS,PASS,PASS | ad3c27f64812 |
| REQ-17 | pitch, Edge behaviour | PASS | UC-RejectInvalidContent: `node build.mjs` with `CONTENT_FILE` pointing at a nonexistent file exits 1, prints exactly one line on stderr naming the problem, and creates no `index.html` in a fresh `OUT_DIR` (covers: REQ-15, REQ-16, REQ-17) (+1) | UC-RejectInvalidContent TS-INV-01 (+1) → PASS,PASS | ad3c27f64812 |
| REQ-18 | pitch, Edge behaviour | PASS | UC-RejectInvalidContent: Valid JSON with `name` missing, empty or non-string exits 1 with one stderr line naming `name` and writes nothing (covers: REQ-18) | UC-RejectInvalidContent TS-ERR-NAME_MISSING (+1) → PASS,PASS | ad3c27f64812 |
| REQ-19 | pitch, Edge behaviour | PASS | UC-BuildSite: Running the build twice against the same content produces byte-identical files; the source uses no `Date` and no `Math.random` (covers: REQ-19) | UC-BuildSite TS-INV-01 (+1) → PASS,PASS | ad3c27f64812 |
| REQ-20 | pitch, No-gos | cut | UC-BuildSite: `build.mjs` imports only `node:` builtins and makes no network call (covers: REQ-20, REQ-21) | Non-Go: no dependencies, no network, no JS in page, content never overwritten (+1) → PASS,PASS | ad3c27f64812 |
| REQ-21 | pitch, No-gos | cut | UC-BuildSite: `build.mjs` imports only `node:` builtins and makes no network call (covers: REQ-20, REQ-21) | Non-Go: no dependencies, no network, no JS in page, content never overwritten (+1) → PASS,PASS | ad3c27f64812 |
| REQ-22 | pitch, No-gos | cut | UC-BuildSite: Rendered HTML has CSS inside a `<style>` element and no `<script>` element or external resource (covers: REQ-2, REQ-3, REQ-22) | UC-BuildSite TS-INV-02 (+5) → PASS,PASS,PASS,PASS,PASS,PASS | ad3c27f64812 |
| REQ-23 | pitch, No-gos | cut | UC-BuildSite: `build.mjs` contains no write to the content file path (covers: REQ-23) | UC-BuildSite TS-INV-03 (+3) → PASS,PASS,PASS,PASS | ad3c27f64812 |
| REQ-24 | pitch, Solution shape | PASS | UC-BuildSite: `node build.mjs` with defaults reads `content.json` and writes a single `dist/index.html` (covers: REQ-1, REQ-24) | UC-BuildSite Steps 1-8 (+1) → PASS,PASS | ad3c27f64812 |
| REQ-25 | pitch, Solution shape | PASS | UC-BuildSite: `CONTENT_FILE` overrides the input path and `OUT_DIR` the output dir, writing `<OUT_DIR>/index.html`; the default `dist/` is untouched in that case (covers: REQ-25) | UC-BuildSite Steps 1-8 (+3) → PASS,PASS,PASS,PASS | ad3c27f64812 |
| REQ-26 | pitch, Verification | PASS | UC-BuildSite/UC-RejectInvalidContent: `node --test` exits 0 with a test file that spawns `node build.mjs` against throwaway content files and asserts on HTML text, no browser (covers: REQ-26) | Done-when: node --test exits 0 over throwaway content, no browser (+1) → PASS,PASS | ad3c27f64812 |

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

## Evaluation

Per-criterion evidence is in the WorkResult (the run trace). Every UC-BuildSite and UC-RejectInvalidContent Test Surface row passes: the named test in build.test.mjs asserts the row's Expect and build.mjs implements it.

### Refuted criteria and bugs

None.

## Discovered, not built

+ Open decision: should a failing build remove a stale dist/index.html from an earlier good run? Spec says no; tests use a fresh OUT_DIR.
+ No appetite overflow: 8h total, critical path 7h, single build round.

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
