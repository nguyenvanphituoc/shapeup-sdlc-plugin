---
type: ship-report
feature: personal-site
date: 2026-11-07
verdict: PASS
rounds_used: 1
rounds_judged: 1
qa: not-hunted
intake_sha256: e69c916099de399af5f5f8a6de481c9b886b623e3c7c0fcc2895e2302a2d2235
---

# personal-site — ship report

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
| build-site | 2/2 | — | 1 | kept | baseline |

## Requirements

One row per registered clause. A requirement has evidence when an acceptance criterion
covers it AND a criterion grading it passed — `covers:` is the join, the judge's anchor is the
path back. This is a projection, never a verdict: it never blocked this ship.

**8/18 PASS · 10 no evidence (REQ-1 ← pitch.md § Solution shape ¶1 (split 1/2), REQ-2 ← pitch.md § Solution shape ¶1 (split 2/2), REQ-3 ← pitch.md § Solution shape ¶2, …)** · run `personal-site-20261107T134125Z-8132311c`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.md § Solution shape ¶1 (split 1/2) | no evidence | UC-BuildSite: `build.mjs` exists at the project root, imports only `node:` builtins, and `package.json` gains no dependencies (covers: REQ-1) (+2) | — | — |
| REQ-2 | pitch.md § Solution shape ¶1 (split 2/2) | no evidence | UC-BuildSite: The output has an inline `<style>` element, no `<link rel="stylesheet">` and no `<script>` (covers: REQ-2) | — | — |
| REQ-3 | pitch.md § Solution shape ¶2 | no evidence | UC-BuildSite: A valid sample `content.json` exists at the project root with `name`, `tagline`, `about`, `projects` (`{title, summary, url}`), `contact.email` (covers: REQ-3) | — | — |
| REQ-4 | pitch.md § Solution shape ¶3 (split 1/6) | PASS | UC-BuildSite: The output has exactly one `<h1>`, containing `name`, with the tagline directly after it (covers: REQ-4) | TS-INV-04 → PASS | 249f7b9d14f3 |
| REQ-5 | pitch.md § Solution shape ¶3 (split 2/6) | no evidence | UC-BuildSite: The output has an About section containing the `about` text (covers: REQ-5) | — | — |
| REQ-6 | pitch.md § Solution shape ¶3 (split 3/6) | no evidence | UC-BuildSite: The output has a Projects section with one card per project, each title an `<a href>` to its `url` (covers: REQ-6) | — | — |
| REQ-7 | pitch.md § Solution shape ¶3 (split 4/6) | no evidence | UC-BuildSite: The output has a Contact section with an `<a href="mailto:EMAIL">` link (covers: REQ-7) | — | — |
| REQ-8 | pitch.md § Solution shape ¶3 (split 5/6) | no evidence | UC-BuildSite: The sections appear in the order h1+tagline, About, Projects, Contact (covers: REQ-8) | — | — |
| REQ-9 | pitch.md § Solution shape ¶3 (split 6/6) | no evidence | UC-BuildSite: The output's `<title>` text equals `name` (covers: REQ-9) | — | — |
| REQ-10 | pitch.md § Solution shape ¶4 (split 1/2) | no evidence | UC-BuildSite: `node build.mjs` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-10) | — | — |
| REQ-11 | pitch.md § Solution shape ¶4 (split 2/2) | no evidence | UC-BuildSite: `CONTENT_FILE=/tmp/x.json OUT_DIR=/tmp/out node build.mjs` reads the named file and writes `/tmp/out/index.html` (creating the dir), leaving `dist/` untouched (covers: REQ-11) (+1) | — | — |
| REQ-12 | pitch.md § Edge behaviour bullet 1 | PASS | UC-BuildSite: A project with no `url` renders its title as plain text: no `<a>`, no `href="#"`, no `href=""` (covers: REQ-12) (+1) | TS-INV-05 → PASS | 249f7b9d14f3 |
| REQ-13 | pitch.md § Edge behaviour bullet 2 | PASS | UC-BuildSite: `projects: []` renders the Projects section with "Projects are coming soon." and no `<ul>`/`<ol>`/`<li>` (covers: REQ-13) (+1) | TS-INV-06 → PASS | 249f7b9d14f3 |
| REQ-14 | pitch.md § Edge behaviour bullet 3 | PASS | UC-BuildSite: A title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; every interpolated string (attributes included) is escaped (covers: REQ-14) (+1) | TS-INV-03 → PASS | 249f7b9d14f3 |
| REQ-15 | pitch.md § Edge behaviour bullet 4 (split 1/2) | PASS | UC-BuildSite: `CONTENT_FILE=<nonexistent> node build.mjs` exits 1, stderr is exactly one line naming the problem (covers: REQ-15) (+2) | TS-ERR-CONTENT_MISSING (+1) → PASS,PASS | 249f7b9d14f3 |
| REQ-16 | pitch.md § Edge behaviour bullet 4 (split 2/2) | PASS | UC-BuildSite: In both cases above, no `index.html` is written to `OUT_DIR` (covers: REQ-16) (+1) | TS-INV-02 → PASS | 249f7b9d14f3 |
| REQ-17 | pitch.md § Edge behaviour bullet 5 | PASS | UC-BuildSite: Valid JSON without `name` exits 1 with exactly one stderr line, and writes no `index.html` (covers: REQ-17) (+1) | TS-INV-02 (+1) → PASS,PASS | 249f7b9d14f3 |
| REQ-18 | pitch.md § Edge behaviour bullet 6 | PASS | UC-BuildSite: Running the build twice produces byte-identical `index.html` (covers: REQ-18) (+1) | TS-INV-01 → PASS | 249f7b9d14f3 |

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

| criterion | dimension | verdict | confidence | evidence |
|---|---|---|---|---|
| TS-INV-01 | test-surface-conformance | PASS | medium | test builds twice, compares buffers (build.test.mjs:34); no timestamps in build.mjs:52-82; T0 names PASS |
| TS-INV-02 | test-surface-conformance | PASS | medium | build.test.mjs:46 asserts exit 1, no index.html; writes only after validation (build.mjs:84-85) |
| TS-INV-03 | test-surface-conformance | PASS | medium | esc() at build.mjs:4-10 applied to all interpolations; test :52 |
| TS-INV-04 | test-surface-conformance | PASS | medium | single h1 at build.mjs:65; test :58 |
| TS-INV-05 | test-surface-conformance | PASS | medium | card() build.mjs:41-46 plain title without url; test :64 |
| TS-INV-06 | test-surface-conformance | PASS | medium | build.mjs:48-50; test :72 (stricter: whole page has no ul/ol/li) |
| TS-ERR-CONTENT_MISSING | test-surface-conformance | PASS | medium | build.mjs:24; test :78 asserts exit 1, one line, no file |
| TS-ERR-CONTENT_INVALID_JSON | test-surface-conformance | PASS | medium | build.mjs:31; test :90 |
| TS-ERR-NAME_MISSING | test-surface-conformance | PASS | medium | build.mjs:34-36; test :97 |
| TS-NOGO-01 | test-surface-conformance | PASS | medium | no markdown processing in build.mjs; test :106 |
| TS-NOGO-03 | test-surface-conformance | PASS | medium | only index.html written (build.mjs:85); test :112 |
| TS-NOGO-05 | test-surface-conformance | PASS | medium | no loop/watch; test :117 |
| UC-BuildSite Steps 1-7 / sections order, title, mailto, inline CSS | spec-conformance | PASS | medium | build.mjs:17-18, 52-82 |
| INV-01..06 | completeness | PASS | medium | each covered by its TS row above |
| T0 fixtures green, cited | tdd-surface | PASS | high | artifact sha256 recomputed |

### Refuted criteria and bugs

None.

## QA findings

none (not hunted)

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
