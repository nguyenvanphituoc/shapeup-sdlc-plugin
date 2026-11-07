# Requirements — personal-site

Source: `pitch.gate.md` (the kicked-off pitch at the project root). One atomic clause per row; ids are
frozen — a dropped clause is marked `CUT (PO-approved)`, never renumbered or deleted.

| REQ-id | clause (verbatim) | source | status | note |
|---|---|---|---|---|
| REQ-1 | A Node script with no library dependencies, `node build.mjs`, reads `content.json` | pitch.gate.md §Solution ¶1 (split 1/3) | covered | |
| REQ-2 | writes a single static file `dist/index.html` | pitch.gate.md §Solution ¶1 (split 2/3) | covered | |
| REQ-3 | CSS embedded inline, no JavaScript needed to read it | pitch.gate.md §Solution ¶1 (split 3/3) | covered | |
| REQ-4 | `content.json` contains: `name`, `tagline`, `about` (one paragraph), `projects` (a list of `{title, summary, url}`) and `contact` (`{email}`) | pitch.gate.md §Solution ¶2 | covered | |
| REQ-5 | the name is the page's only `<h1>` tag, with the tagline below it | pitch.gate.md §Solution ¶3 (split 1/5) | covered | |
| REQ-6 | an About section | pitch.gate.md §Solution ¶3 (split 2/5) | covered | renders `about` |
| REQ-7 | a Projects section with one card per project, whose title is a link to `url` | pitch.gate.md §Solution ¶3 (split 3/5) | covered | |
| REQ-8 | a Contact section with a `mailto:` link | pitch.gate.md §Solution ¶3 (split 4/5) | covered | |
| REQ-9 | The page's `<title>` tag is the name | pitch.gate.md §Solution ¶3 (split 5/5) | covered | |
| REQ-10 | The page renders in this order: [h1 + tagline]; About; Projects; Contact | pitch.gate.md §Solution ¶3 | covered | ordering clause of the same paragraph |
| REQ-11 | The script uses no library dependencies and makes no network calls | pitch.gate.md §Solution ¶4 (split 1/3) | covered | |
| REQ-12 | the generated page contains no JavaScript | pitch.gate.md §Solution ¶4 (split 2/3) | covered | |
| REQ-13 | the script never overwrites `content.json` | pitch.gate.md §Solution ¶4 (split 3/3) | covered | |
| REQ-14 | `build.mjs` may read `$CONTENT_FILE` and `$OUT_DIR` to change the input and output locations | pitch.gate.md §Solution ¶5 | covered | |
| REQ-15 | A project with no `url` shows its title as plain text, never as a link to `#` or an empty href | pitch.gate.md §Edge behavior 1 | covered | |
| REQ-16 | With no projects at all, the Projects section shows the sentence "Projects are coming soon." and no empty list | pitch.gate.md §Edge behavior 2 | covered | |
| REQ-17 | Text from `content.json` is HTML-escaped: a title like `<b>Rock & Roll</b>` must appear as text | pitch.gate.md §Edge behavior 3 | covered | |
| REQ-18 | If `content.json` is missing or cannot be parsed, `node build.mjs` exits with code 1, prints one error line to stderr naming the problem, and does not write `dist/index.html` | pitch.gate.md §Edge behavior 4 | covered | |
| REQ-19 | A missing required field (`name`) is the same: exit code 1, one line, nothing written | pitch.gate.md §Edge behavior 5 | covered | |
| REQ-20 | Running `node build.mjs` twice produces byte-identical output | pitch.gate.md §Edge behavior 6 | covered | |
| REQ-21 | Run with `node --test`: a test file drives `node build.mjs` over temporary content files and asserts on the generated HTML text (no browser needed) | pitch.gate.md §Verification | covered | |
