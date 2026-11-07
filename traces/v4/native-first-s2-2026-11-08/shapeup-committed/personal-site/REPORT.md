---
type: ship-report
feature: personal-site
date: 2026-11-07
verdict: PASS
rounds_used: 1
rounds_judged: 1
qa: run
intake_sha256: 2c9c8afbf9cd49d2c7f3cb009e307f0988c79ed2703d65a8ae514fd1c0c50baf
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
| Board | 2/2 tasks done |
| T0 artifacts | 1 |
| QA | run |

## Verification (T0)

The surviving trial per scope — the one describing code that is actually on the branch.

| scope | fixtures | regressions | trials | last status | delta |
|---|---|---|---|---|---|
| build-site | 1/1 | — | 1 | kept | baseline |

## Requirements

One row per registered clause. A requirement has evidence when an acceptance criterion
covers it AND a criterion grading it passed — `covers:` is the join, the judge's anchor is the
path back. This is a projection, never a verdict: it never blocked this ship.

**21/21 PASS** · run `personal-site-20261107T181400Z-47ca59a5`

| REQ | source | evidence | covering AC | criterion | T0 |
|---|---|---|---|---|---|
| REQ-1 | pitch.gate.md §Solution ¶1 (split 1/3) | PASS | UC-BuildSite: `build.mjs` exists at the repo root and imports only `node:` builtins; `package.json` declares no `dependencies` (covers: REQ-1, REQ-11) (+1) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) → PASS | e916e323673f |
| REQ-2 | pitch.gate.md §Solution ¶1 (split 2/3) | PASS | UC-BuildSite: `node build.mjs` with a valid `content.json` exits 0 and writes `dist/index.html` (covers: REQ-1, REQ-2) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) (+2) → PASS,PASS,PASS | e916e323673f |
| REQ-3 | pitch.gate.md §Solution ¶1 (split 3/3) | PASS | UC-BuildSite: The output has one inline `<style>` element and no `<link rel="stylesheet">` (covers: REQ-3) (+1) | completeness: INV-01..INV-08 each hold (+1) → PASS,PASS | e916e323673f |
| REQ-4 | pitch.gate.md §Solution ¶2 | PASS | UC-BuildSite: Each project renders one card whose title is `<a href="<url>">` when `url` is set, with its summary (covers: REQ-4, REQ-7) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) → PASS | e916e323673f |
| REQ-5 | pitch.gate.md §Solution ¶3 (split 1/6) | PASS | UC-BuildSite: `<title>` is the `name`, and the document has exactly one `<h1>`, whose text is the `name`, with the tagline directly after it (covers: REQ-5, REQ-10) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) (+1) → PASS,PASS | e916e323673f |
| REQ-6 | pitch.gate.md §Solution ¶3 (split 2/6) | PASS | UC-BuildSite: The rendered order is header, About section, Projects section, Contact section (covers: REQ-6, REQ-9) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) → PASS | e916e323673f |
| REQ-7 | pitch.gate.md §Solution ¶3 (split 3/6) | PASS | UC-BuildSite: Each project renders one card whose title is `<a href="<url>">` when `url` is set, with its summary (covers: REQ-4, REQ-7) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) → PASS | e916e323673f |
| REQ-8 | pitch.gate.md §Solution ¶3 (split 4/6) | PASS | UC-BuildSite: The Contact section contains `<a href="mailto:<email>">` (covers: REQ-8) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) → PASS | e916e323673f |
| REQ-9 | pitch.gate.md §Solution ¶3 (split 5/6) | PASS | UC-BuildSite: The rendered order is header, About section, Projects section, Contact section (covers: REQ-6, REQ-9) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) → PASS | e916e323673f |
| REQ-10 | pitch.gate.md §Solution ¶3 (split 6/6) | PASS | UC-BuildSite: `<title>` is the `name`, and the document has exactly one `<h1>`, whose text is the `name`, with the tagline directly after it (covers: REQ-5, REQ-10) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) (+1) → PASS,PASS | e916e323673f |
| REQ-11 | pitch.gate.md §Solution ¶4 (split 1/3) | PASS | UC-BuildSite: `build.mjs` exists at the repo root and imports only `node:` builtins; `package.json` declares no `dependencies` (covers: REQ-1, REQ-11) | completeness: INV-01..INV-08 each hold (+1) → PASS,PASS | e916e323673f |
| REQ-12 | pitch.gate.md §Solution ¶4 (split 2/3) | PASS | UC-BuildSite: The output contains no `<script` element, no `on*=` attribute and no `javascript:` URL (covers: REQ-3, REQ-12) | completeness: INV-01..INV-08 each hold (+1) → PASS,PASS | e916e323673f |
| REQ-13 | pitch.gate.md §Solution ¶4 (split 3/3) | PASS | UC-BuildSite: The content file's bytes and mtime are unchanged after a build (covers: REQ-13) | completeness: INV-01..INV-08 each hold (+1) → PASS,PASS | e916e323673f |
| REQ-14 | pitch.gate.md §Solution ¶5 | PASS | UC-BuildSite: With `CONTENT_FILE=<tmp>/c.json OUT_DIR=<tmp>/out node build.mjs`, the page is written to `<tmp>/out/index.html` and the repo's `dist/` is untouched (covers: REQ-14) (+1) | UC-BuildSite steps 1-6 (resolve paths, load, validate, render in fixed order, write, exit 0) → PASS | e916e323673f |
| REQ-15 | pitch.gate.md §Edge behavior bullet 1 | PASS | UC-BuildSite: A project with no `url` (or an empty one) renders its title as plain text: the output has no `href="#"` and no `href=""` (covers: REQ-15) (+1) | completeness: INV-01..INV-08 each hold (+1) → PASS,PASS | e916e323673f |
| REQ-16 | pitch.gate.md §Edge behavior bullet 2 | PASS | UC-BuildSite: With `projects: []` or `projects` absent, the Projects section shows "Projects are coming soon." and contains no `<ul>`/`<ol>`/`<li>` (covers: REQ-16) (+1) | completeness: INV-01..INV-08 each hold (+1) → PASS,PASS | e916e323673f |
| REQ-17 | pitch.gate.md §Edge behavior bullet 3 | PASS | UC-BuildSite: A title `<b>Rock & Roll</b>` appears as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; every content string is escaped, attribute values included (covers: REQ-17) (+1) | completeness: INV-01..INV-08 each hold (+1) → PASS,PASS | e916e323673f |
| REQ-18 | pitch.gate.md §Edge behavior bullet 4 | PASS | UC-BuildSite: A missing content file → exit 1, exactly one stderr line naming the file, no `index.html` written (covers: REQ-18) (+2) | Error Cases CONTENT_MISSING / CONTENT_INVALID_JSON / NAME_MISSING: one stderr line, exit 1, nothing written (+2) → PASS,PASS,PASS | e916e323673f |
| REQ-19 | pitch.gate.md §Edge behavior bullet 5 | PASS | UC-BuildSite: Content with no `name` → exit 1, exactly one stderr line naming `name`, no `index.html` written (covers: REQ-19) (+1) | Error Cases CONTENT_MISSING / CONTENT_INVALID_JSON / NAME_MISSING: one stderr line, exit 1, nothing written (+1) → PASS,PASS | e916e323673f |
| REQ-20 | pitch.gate.md §Edge behavior bullet 6 | PASS | UC-BuildSite: Two builds of the same content produce byte-identical `index.html` (`cmp` exits 0) (covers: REQ-20) (+1) | completeness: INV-01..INV-08 each hold (+1) → PASS,PASS | e916e323673f |
| REQ-21 | pitch.gate.md §Verification | PASS | UC-BuildSite: `build.test.mjs` exists at the repo root, uses only `node:` builtins, and `npm test` (`node --test`) exits 0 (covers: REQ-21) (+2) | Scope Done-when: named command `npm test` (node --test) exits 0 over build.test.mjs (+1) → PASS,PASS | e916e323673f |

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

| Dimension | Criterion | Verdict | Confidence |
|---|---|---|---|
| spec-conformance | UC steps 1-6; Error Cases; Done-when `npm test`; Non-Go | PASS | high |
| tdd-surface | process-driven suite over temp files | PASS | high |
| completeness | INV-01..08 | PASS | high |
| test-surface-conformance | TS-INV-01..08, TS-ERR-CONTENT_MISSING, TS-ERR-CONTENT_INVALID_JSON, TS-REQ-name-missing, TS-NOGO-01..03 | PASS (TS-INV-08 medium) | high |

### Refuted criteria and bugs

None.

## QA findings

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01 name types, C-02 url/optional-field types, C-03 control chars/size | QA-001..005 | 0 |
| ③ State interruption | C-04 failed build over prior output, BOM input | QA-006 | 0 |
| ⑤ No-go | C-04 unspecified path failures (OUT_DIR) | QA-007 | 0 |
| ② / ④ / ⑥ | not hunted | 0 | 0 |

Details are returned in the WorkResult `discoveries[]` (all `~`); ingest appends them to the ledger.

Checked and held (not findings): HTML/attribute escaping of quotes and `&` in url and mailto; missing, empty, non-object and array JSON content give a coded one-line stderr and exit 1; CONTENT_FILE pointing at a directory gives CONTENT_MISSING; `__proto__` and lone-surrogate names do not break the build.

## Discovered, not built

~ [lens:①boundary] [QA-001] [UC-BuildSite] Non-string `name` (0, false, array, object) passes validation and renders as `<h1>0</h1>`, `<h1>false</h1>`, `<h1>a</h1>`, `<h1>[object Object]</h1>`
    repro: 1. Write content.json {"name":{"a":1}} (also 0, false, ["a"]). 2. CONTENT_FILE=content.json OUT_DIR=out node build.mjs. 3. Exit 0; out/index.html has <h1>[object Object]</h1> and <title>[object Object]</title>.
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-BuildSite] Whitespace-only `name` is accepted as present, giving an empty-looking h1 and title
    repro: 1. content.json {"name":"   "}. 2. CONTENT_FILE=content.json OUT_DIR=out node build.mjs. 3. Exit 0; <h1>   </h1> and <title>   </title>, no NAME_MISSING.
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-BuildSite] `url` is escaped but not scheme-checked: `javascript:` url becomes a live link, and a whitespace-only url renders `<a href="   ">` instead of plain text
    repro: 1. content.json {"name":"A","projects":[{"title":"t","url":"javascript:alert(1)"}]}. 2. Run build with CONTENT_FILE/OUT_DIR. 3. Output has <a href="javascript:alert(1)">. Repeat with url "   ": <a href="   ">t</a>.
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-004] [UC-BuildSite] Wrong-typed or empty optional fields render garbage silently: `contact.email` object gives `mailto:[object Object]`, `about` array gives `a,b`, and a project entry that is null, a number, a string or `{}` gives an empty `<article><h3></h3></article>`; a project with url and no title gives an empty link `<a href="http://x"></a>`
    repro: 1. content.json {"name":"E","about":["a","b"],"contact":{"email":{"x":1}},"projects":[null,5,{},"str"]}. 2. Run build with CONTENT_FILE/OUT_DIR. 3. Exit 0; mailto:[object Object], <p>a,b</p>, four empty <article> cards.
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-005] [UC-BuildSite] Control characters pass through unescaped: a NUL byte or newline in `name` reaches the output HTML (newline lands inside <title>); a 1 MB `about` is emitted without limit
    repro: 1. content.json built with JSON.stringify({name:"N\u0000x\u202e", about:"a".repeat(1e6)}). 2. Run build. 3. Exit 0, output is 1000591 bytes and contains a raw U+0000. With name "l1\nl2", <title> spans two lines.
    severity-hint: cosmetic
    test-gap: unit
~ [lens:③state-interruption] [QA-006] [UC-BuildSite] UTF-8 BOM content file is rejected as CONTENT_INVALID_JSON (common for files saved by Windows editors); a build that fails leaves the previous dist/index.html in place, so a stale page can be deployed after a failed build
    repro: 1. printf '\xef\xbb\xbf{"name":"F"}' > c.json; CONTENT_FILE=c.json OUT_DIR=out node build.mjs -> exit 1, CONTENT_INVALID_JSON, 'Unexpected token'. 2. Build a valid file into out/, then build {} into the same OUT_DIR: exit 1 and out/index.html still holds the old page.
    severity-hint: ux-degradation
    test-gap: integration
~ [lens:⑤no-go] [QA-007] [UC-BuildSite] Unspecified path failures are not covered by the one-line error contract: OUT_DIR pointing at an existing file crashes with a raw Node stack trace (EEXIST) instead of a coded one-line stderr; OUT_DIR set to empty string silently falls back to dist/
    repro: 1. touch afile; echo '{"name":"P"}' > c.json. 2. CONTENT_FILE=c.json OUT_DIR=afile node build.mjs -> exit 1 with a multi-line 'node:fs ... Error: EEXIST: file already exists, mkdir' trace. 3. CONTENT_FILE=c.json OUT_DIR= node build.mjs writes ./dist/index.html.
    severity-hint: ux-degradation
    test-gap: integration

---

*Run state (board, orders, results, T0 artifacts, evaluation and QA reports) stays in the
gitignored local tier (ADR-0001). This report
is the frozen conclusion of it.*
