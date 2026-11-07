# Requirements registry — one-page-site

Source: `pitch.md` (committed at the project root). The pitch carries no `R<n>` ids, so ids start at
REQ-1. Ids are frozen: never renumber; a dropped clause is marked `CUT (PO-approved)`.

REQ-18, REQ-19 and REQ-20 are retired and never reused: they registered the pitch's No-gos (no
dependencies / no network calls; no JavaScript in the generated page; no overwriting `content.json`),
which are constraints, not requirements. They are graded by the Test Surface rows TS-NOGO-01,
TS-NOGO-02 and TS-NOGO-03 of UC-BuildSite instead. Retired by the tech lead in an unattended run — no
PO approval was given.

| REQ-id | clause (verbatim) | source | status | note |
|---|---|---|---|---|
| REQ-1 | A zero-dependency Node script, `node build.mjs`, reads `content.json` and writes a single static `dist/index.html` | pitch.md § Solution shape ¶1 | covered | |
| REQ-2 | (inline CSS, no JavaScript required to read it) | pitch.md § Solution shape ¶1 | covered | |
| REQ-3 | `content.json` holds: `name`, `tagline`, `about` (one paragraph), `projects` (a list of `{title, summary, url}`), and `contact` (`{email}`) | pitch.md § Solution shape ¶2 | covered | |
| REQ-4 | the name as the page's one `<h1>` with the tagline under it | pitch.md § Solution shape ¶3 (split 1/5) | covered | |
| REQ-5 | an About section | pitch.md § Solution shape ¶3 (split 2/5) | covered | |
| REQ-6 | a Projects section with one card per project, each title a link to its `url` | pitch.md § Solution shape ¶3 (split 3/5) | covered | |
| REQ-7 | a Contact section with a `mailto:` link | pitch.md § Solution shape ¶3 (split 4/5) | covered | |
| REQ-8 | The page shows, in order: [h1+tagline; About; Projects; Contact] | pitch.md § Solution shape ¶3 (split 5/5) | covered | section order |
| REQ-9 | The page `<title>` is the name. | pitch.md § Solution shape ¶3 | covered | |
| REQ-10 | The output path is `dist/index.html` | pitch.md § Solution shape ¶4 (split 1/2) | covered | |
| REQ-11 | `build.mjs` may read `$CONTENT_FILE` and `$OUT_DIR` to override the input and output locations | pitch.md § Solution shape ¶4 (split 2/2) | covered | |
| REQ-12 | A project with no `url` renders its title as plain text, never as a link to `#` or an empty href. | pitch.md § Edge behaviour 1 | covered | |
| REQ-13 | Zero projects renders the Projects section with the sentence "Projects are coming soon." and no empty list. | pitch.md § Edge behaviour 2 | covered | |
| REQ-14 | Text from `content.json` is HTML-escaped: a title like `<b>Rock & Roll</b>` must appear as text. | pitch.md § Edge behaviour 3 | covered | |
| REQ-15 | A missing or unparsable `content.json` makes `node build.mjs` exit 1 with one line on stderr naming the problem, and writes no `dist/index.html`. | pitch.md § Edge behaviour 4 | covered | |
| REQ-16 | A missing required field (`name`) is the same: exit 1, one line, nothing written. | pitch.md § Edge behaviour 5 | covered | |
| REQ-17 | `node build.mjs` run twice produces byte-identical output. | pitch.md § Edge behaviour 6 | covered | |
| REQ-21 | Run by `node --test`: a test file that drives `node build.mjs` against throwaway content files and asserts on the generated HTML text (no browser needed). | pitch.md § Verification | covered | |
