# Requirements — personal-site

Source: `pitch.md` (the committed pitch at the project root). The pitch carries no R-ids, so ids start
at REQ-1. Ids are assigned once and frozen.

| REQ-id | clause (verbatim) | source | status | note |
|---|---|---|---|---|
| REQ-1 | A zero-dependency Node script, `node build.mjs`, reads `content.json` and writes a single static `dist/index.html` | pitch.md § Solution shape ¶1 (split 1/2) | covered | |
| REQ-2 | (inline CSS, no JavaScript required to read it) | pitch.md § Solution shape ¶1 (split 2/2) | covered | |
| REQ-3 | `content.json` holds: `name`, `tagline`, `about` (one paragraph), `projects` (a list of `{title, summary, url}`), and `contact` (`{email}`) | pitch.md § Solution shape ¶2 | covered | |
| REQ-4 | the name as the page's one `<h1>` with the tagline under it | pitch.md § Solution shape ¶3 (split 1/6) | covered | |
| REQ-5 | an About section | pitch.md § Solution shape ¶3 (split 2/6) | covered | |
| REQ-6 | a Projects section with one card per project, each title a link to its `url` | pitch.md § Solution shape ¶3 (split 3/6) | covered | |
| REQ-7 | a Contact section with a `mailto:` link | pitch.md § Solution shape ¶3 (split 4/6) | covered | |
| REQ-8 | The page shows, in order: [h1+tagline, About, Projects, Contact] | pitch.md § Solution shape ¶3 (split 5/6) | covered | order of sections |
| REQ-9 | The page `<title>` is the name | pitch.md § Solution shape ¶3 (split 6/6) | covered | |
| REQ-10 | The output path is `dist/index.html` | pitch.md § Solution shape ¶4 (split 1/2) | covered | |
| REQ-11 | `build.mjs` may read `$CONTENT_FILE` and `$OUT_DIR` to override the input and output locations | pitch.md § Solution shape ¶4 (split 2/2) | covered | |
| REQ-12 | A project with no `url` renders its title as plain text, never as a link to `#` or an empty href | pitch.md § Edge behaviour bullet 1 | covered | |
| REQ-13 | Zero projects renders the Projects section with the sentence "Projects are coming soon." and no empty list | pitch.md § Edge behaviour bullet 2 | covered | |
| REQ-14 | Text from `content.json` is HTML-escaped: a title like `<b>Rock & Roll</b>` must appear as text | pitch.md § Edge behaviour bullet 3 | covered | |
| REQ-15 | A missing or unparsable `content.json` makes `node build.mjs` exit 1 with one line on stderr naming the problem | pitch.md § Edge behaviour bullet 4 (split 1/2) | covered | |
| REQ-16 | [a missing or unparsable `content.json`] writes no `dist/index.html` | pitch.md § Edge behaviour bullet 4 (split 2/2) | covered | |
| REQ-17 | A missing required field (`name`) is the same: exit 1, one line, nothing written | pitch.md § Edge behaviour bullet 5 | covered | |
| REQ-18 | `node build.mjs` run twice produces byte-identical output | pitch.md § Edge behaviour bullet 6 | covered | |
