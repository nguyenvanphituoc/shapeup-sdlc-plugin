---
type: ship-report
feature: one-page-site
date: 2026-11-07
verdict: PASS
rounds_used: 1
rounds_judged: 1
qa: not-hunted
intake_sha256: 2c9c8afbf9cd49d2c7f3cb009e307f0988c79ed2703d65a8ae514fd1c0c50baf
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
| Board | 2/2 tasks done |
| T0 artifacts | 1 |
| QA | not-hunted |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| build-page | 1/1 | — | 1 | kept | baseline |

## Requirements

One row per registered clause. A requirement has evidence when an acceptance criterion
covers it AND a criterion grading it passed — `covers:` is the join, the judge's anchor is the
path back. This is a projection, never a verdict: it never blocked this ship.

**16/24 PASS · 8 no evidence (REQ-2 ← pitch.gate.md § Solution ¶1, REQ-4 ← pitch.gate.md § Solution ¶1, ¶4, REQ-5 ← pitch.gate.md § Solution ¶2, …)** · run `one-page-site-20261107T180024Z-ab4341fb`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.gate.md § Solution ¶1 | PASS | "[[usecases/UC-BuildPage]]": `node build.mjs` exits 0 and writes `dist/index.html` from `content.json` (covers: REQ-1) (+1) | UC-BuildPage steps 1-7 and error cases → PASS | 74c1df1b187b |
| REQ-2 | pitch.gate.md § Solution ¶1 | no evidence | "[[usecases/UC-BuildPage]]": The output has an inline `<style>` element and no `<link rel="stylesheet">` (covers: REQ-2) | — | — |
| REQ-3 | pitch.gate.md § Solution ¶1, ¶4 | PASS | "[[usecases/UC-BuildPage]]": The output contains no `<script` (covers: REQ-3) (+1) | TS-INV-05 → PASS | 74c1df1b187b |
| REQ-4 | pitch.gate.md § Solution ¶1, ¶4 | no evidence | "[[usecases/UC-BuildPage]]": `build.mjs` exists at the repo root and imports only `node:` builtins (no `import` of a package name, no `package.json` dependencies) (covers: REQ-4) | — | — |
| REQ-5 | pitch.gate.md § Solution ¶2 | no evidence | "[[usecases/UC-BuildPage]]": `content.json` exists at the repo root with `name`, `tagline`, `about`, `projects` (`{title, summary, url}`) and `contact` (`{email}`) (covers: REQ-5) | — | — |
| REQ-6 | pitch.gate.md § Solution ¶3 | PASS | "[[usecases/UC-BuildPage]]": The output's only `<h1>` holds the name, with the tagline in the next element after it (covers: REQ-6, REQ-7) (+1) | TS-INV-06 → PASS | 74c1df1b187b |
| REQ-7 | pitch.gate.md § Solution ¶3 | no evidence | "[[usecases/UC-BuildPage]]": The output's only `<h1>` holds the name, with the tagline in the next element after it (covers: REQ-6, REQ-7) | — | — |
| REQ-8 | pitch.gate.md § Solution ¶3 (split 1/4) | no evidence | "[[usecases/UC-BuildPage]]": The output's sections appear in order: header, About, Projects, Contact (covers: REQ-8) | — | — |
| REQ-9 | pitch.gate.md § Solution ¶3 (split 2/4) | no evidence | "[[usecases/UC-BuildPage]]": Each project renders as one card whose title is `<a href="<url>">` (covers: REQ-9) | — | — |
| REQ-10 | pitch.gate.md § Solution ¶3 (split 3/4) | no evidence | "[[usecases/UC-BuildPage]]": The Contact section has `<a href="mailto:<email>">` (covers: REQ-10) | — | — |
| REQ-11 | pitch.gate.md § Solution ¶3 (split 4/4) | PASS | "[[usecases/UC-BuildPage]]": `<title>` is the name (covers: REQ-11) (+1) | TS-INV-06 → PASS | 74c1df1b187b |
| REQ-12 | pitch.gate.md § Solution ¶4 | no evidence | "[[usecases/UC-BuildPage]]": `build.mjs` contains no `fetch`, `http`, `https`, `net` or `dns` use (covers: REQ-12) | — | — |
| REQ-13 | pitch.gate.md § Solution ¶4 | PASS | "[[usecases/UC-BuildPage]]": `build.mjs` never opens the content file for writing; its hash is unchanged after a build (covers: REQ-13) (+1) | TS-INV-01 → PASS | 74c1df1b187b |
| REQ-14 | pitch.gate.md § Solution ¶5 (split 1/2) | PASS | "[[usecases/UC-BuildPage]]": `CONTENT_FILE=<tmp>/c.json node build.mjs` reads that file instead of `content.json` (covers: REQ-14) (+1) | UC-BuildPage steps 1-7 and error cases → PASS | 74c1df1b187b |
| REQ-15 | pitch.gate.md § Solution ¶5 (split 2/2) | PASS | "[[usecases/UC-BuildPage]]": `OUT_DIR=<tmp>/out node build.mjs` writes `<tmp>/out/index.html` and not `dist/index.html` (covers: REQ-15) (+1) | UC-BuildPage steps 1-7 and error cases → PASS | 74c1df1b187b |
| REQ-16 | pitch.gate.md § Edge behavior ¶1 | PASS | "[[usecases/UC-BuildPage]]": A project with no `url` renders its title as plain text — no `<a>`, no `href="#"`, no `href=""` (covers: REQ-16) (+1) | TS-INV-07 → PASS | 74c1df1b187b |
| REQ-17 | pitch.gate.md § Edge behavior ¶2 | PASS | "[[usecases/UC-BuildPage]]": With `projects: []` the Projects section shows "Projects are coming soon." and no `<ul>`/`<li>` (covers: REQ-17) (+1) | TS-INV-08 → PASS | 74c1df1b187b |
| REQ-18 | pitch.gate.md § Edge behavior ¶3 | PASS | "[[usecases/UC-BuildPage]]": Every content value (text and attribute values) is HTML-escaped; `<b>Rock & Roll</b>` appears as text (covers: REQ-18) (+1) | TS-INV-04 → PASS | 74c1df1b187b |
| REQ-19 | pitch.gate.md § Edge behavior ¶4 (split 1/3) | PASS | "[[usecases/UC-BuildPage]]": Missing content file → exit 1, exactly one stderr line naming the file, no `index.html` written (covers: REQ-19, REQ-20, REQ-21) (+2) | TS-ERR-CONTENT_MISSING (+1) → PASS,PASS | 74c1df1b187b |
| REQ-20 | pitch.gate.md § Edge behavior ¶4 (split 2/3) | PASS | "[[usecases/UC-BuildPage]]": Missing content file → exit 1, exactly one stderr line naming the file, no `index.html` written (covers: REQ-19, REQ-20, REQ-21) (+2) | TS-ERR-CONTENT_MISSING (+1) → PASS,PASS | 74c1df1b187b |
| REQ-21 | pitch.gate.md § Edge behavior ¶4 (split 3/3) | PASS | "[[usecases/UC-BuildPage]]": Missing content file → exit 1, exactly one stderr line naming the file, no `index.html` written (covers: REQ-19, REQ-20, REQ-21) (+2) | TS-INV-03 (+2) → PASS,PASS,PASS | 74c1df1b187b |
| REQ-22 | pitch.gate.md § Edge behavior ¶5 | PASS | "[[usecases/UC-BuildPage]]": Content without `name` → exit 1, exactly one stderr line naming `name`, no `index.html` written (covers: REQ-22) (+1) | TS-REQ-name-missing → PASS | 74c1df1b187b |
| REQ-23 | pitch.gate.md § Edge behavior ¶6 | PASS | "[[usecases/UC-BuildPage]]": Two runs over the same content produce byte-identical `index.html` (covers: REQ-23) (+1) | TS-INV-02 → PASS | 74c1df1b187b |
| REQ-24 | pitch.gate.md § Verification | PASS | "[[usecases/UC-BuildPage]]": `build.test.mjs` exists at the repo root, uses only `node:test`, `node:assert`, `node:child_process`, `node:fs`, `node:os`, `node:path` (covers: REQ-24) (+1) | node --test fixture green → PASS | 74c1df1b187b |

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

- Steps 1-7 and error codes CONTENT_MISSING, CONTENT_UNPARSEABLE, NAME_MISSING: implemented at build.mjs:4-5, 20-36, 84-85. PASS.
- INV-01 to INV-08: PASS (above). Page section order matches ux-behavior GeneratedPage. PASS.
- tdd-surface: `node --test` is the named verification fixture and it is green. PASS.

### Refuted criteria and bugs

None filed.

## QA findings

None confirmed. Rule 7 forbids findings from code reading; none were recorded.

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
