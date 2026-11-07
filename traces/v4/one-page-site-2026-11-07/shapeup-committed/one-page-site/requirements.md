# Requirements registry — one-page-site

Atomic clauses extracted from the pitch (section named in the source cell). Ids are frozen; never renumber.

| REQ-id | clause | source | status | note |
|---|---|---|---|---|
| REQ-1 | A zero-dependency Node script, `node build.mjs`, reads `content.json` and writes a single static `dist/index.html` | pitch, Solution shape | covered | |
| REQ-2 | The generated page uses inline CSS | pitch, Solution shape | covered | |
| REQ-3 | The generated page requires no JavaScript to read it | pitch, Solution shape | covered | |
| REQ-4 | `content.json` holds `name`, `tagline`, `about` (one paragraph), `projects` (a list of `{title, summary, url}`), and `contact` (`{email}`) | pitch, Solution shape | covered | |
| REQ-5 | The page shows, in order: name/tagline, About section, Projects section, Contact section | pitch, Solution shape | covered | |
| REQ-6 | The name is the page's one `<h1>`, with the tagline under it | pitch, Solution shape | covered | |
| REQ-7 | The Projects section has one card per project | pitch, Solution shape | covered | |
| REQ-8 | Each project title is a link to its `url` | pitch, Solution shape | covered | |
| REQ-9 | The Contact section has a `mailto:` link | pitch, Solution shape | covered | |
| REQ-10 | The page `<title>` is the name | pitch, Solution shape | covered | |
| REQ-11 | A project with no `url` renders its title as plain text, never as a link to `#` or an empty href | pitch, Edge behaviour | covered | |
| REQ-12 | Zero projects renders the Projects section with the sentence "Projects are coming soon." | pitch, Edge behaviour | covered | |
| REQ-13 | Zero projects renders no empty list | pitch, Edge behaviour | covered | |
| REQ-14 | Text from `content.json` is HTML-escaped: a title like `<b>Rock & Roll</b>` must appear as text | pitch, Edge behaviour | covered | |
| REQ-15 | A missing or unparsable `content.json` makes `node build.mjs` exit 1 | pitch, Edge behaviour | covered | |
| REQ-16 | A missing or unparsable `content.json` prints one line on stderr naming the problem | pitch, Edge behaviour | covered | |
| REQ-17 | A missing or unparsable `content.json` writes no `dist/index.html` | pitch, Edge behaviour | covered | |
| REQ-18 | A missing required field (`name`) makes `node build.mjs` exit 1 with one line on stderr naming the problem and writes nothing | pitch, Edge behaviour | covered | |
| REQ-19 | `node build.mjs` run twice produces byte-identical output | pitch, Edge behaviour | covered | |
| REQ-20 | No dependencies | pitch, No-gos | CUT (PO-approved) | a no-go the shape deliberately does not build; approved by the PO at GATE L1b |
| REQ-21 | No network calls | pitch, No-gos | CUT (PO-approved) | a no-go the shape deliberately does not build; approved by the PO at GATE L1b |
| REQ-22 | No JavaScript in the generated page | pitch, No-gos | CUT (PO-approved) | a no-go the shape deliberately does not build; approved by the PO at GATE L1b |
| REQ-23 | `content.json` is never overwritten | pitch, No-gos | CUT (PO-approved) | a no-go the shape deliberately does not build; approved by the PO at GATE L1b |
| REQ-24 | The output path is `dist/index.html` | pitch, Solution shape | covered | |
| REQ-25 | `build.mjs` may read `$CONTENT_FILE` and `$OUT_DIR` to override the input and output locations | pitch, Solution shape | covered | |
| REQ-26 | Verification is by `node --test`: a test file drives `node build.mjs` against throwaway content files and asserts on the generated HTML text, no browser needed | pitch, Verification | covered | |
