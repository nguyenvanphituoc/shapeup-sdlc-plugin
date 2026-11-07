# Requirements registry — one-page-site

Source: the kicked-off pitch `pitch.gate.md` ("Pitch — a one-page personal website, built from one
content file"). The pitch carries no `R<n>` ids, so ids start at REQ-1. Ids are frozen: never renumber;
a dropped clause is marked `CUT (PO-approved)`.

| REQ-id | clause (verbatim) | source | status | note |
|---|---|---|---|---|
| REQ-1 | A Node script, `node build.mjs`, reads `content.json` and writes a single static file `dist/index.html` | pitch.gate.md § Solution ¶1 | covered | |
| REQ-2 | CSS embedded inline | pitch.gate.md § Solution ¶1 | covered | |
| REQ-3 | the generated page contains no JavaScript (no JavaScript needed to read it) | pitch.gate.md § Solution ¶1, ¶4 | covered | |
| REQ-4 | The script uses no library dependencies | pitch.gate.md § Solution ¶1, ¶4 | covered | |
| REQ-5 | `content.json` contains: `name`, `tagline`, `about` (one paragraph), `projects` (a list of `{title, summary, url}`) and `contact` (`{email}`) | pitch.gate.md § Solution ¶2 | covered | |
| REQ-6 | the name is the page's only `<h1>` tag | pitch.gate.md § Solution ¶3 | covered | |
| REQ-7 | with the tagline below it | pitch.gate.md § Solution ¶3 | covered | |
| REQ-8 | The page renders in this order: name/tagline; an About section; a Projects section; a Contact section | pitch.gate.md § Solution ¶3 (split 1/4) | covered | |
| REQ-9 | a Projects section with one card per project, whose title is a link to `url` | pitch.gate.md § Solution ¶3 (split 2/4) | covered | |
| REQ-10 | a Contact section with a `mailto:` link | pitch.gate.md § Solution ¶3 (split 3/4) | covered | |
| REQ-11 | The page's `<title>` tag is the name | pitch.gate.md § Solution ¶3 (split 4/4) | covered | |
| REQ-12 | The script makes no network calls | pitch.gate.md § Solution ¶4 | covered | |
| REQ-13 | the script never overwrites `content.json` | pitch.gate.md § Solution ¶4 | covered | |
| REQ-14 | `build.mjs` may read `$CONTENT_FILE` to change the input location | pitch.gate.md § Solution ¶5 (split 1/2) | covered | |
| REQ-15 | `build.mjs` may read `$OUT_DIR` to change the output location (default output path `dist/index.html`) | pitch.gate.md § Solution ¶5 (split 2/2) | covered | |
| REQ-16 | A project with no `url` shows its title as plain text, never as a link to `#` or an empty href | pitch.gate.md § Edge behavior ¶1 | covered | |
| REQ-17 | With no projects at all, the Projects section shows the sentence "Projects are coming soon." and no empty list | pitch.gate.md § Edge behavior ¶2 | covered | |
| REQ-18 | Text from `content.json` is HTML-escaped: a title like `<b>Rock & Roll</b>` must appear as text | pitch.gate.md § Edge behavior ¶3 | covered | |
| REQ-19 | If `content.json` is missing or cannot be parsed, `node build.mjs` exits with code 1 | pitch.gate.md § Edge behavior ¶4 (split 1/3) | covered | |
| REQ-20 | (missing/unparseable content) prints one error line to stderr naming the problem | pitch.gate.md § Edge behavior ¶4 (split 2/3) | covered | |
| REQ-21 | (missing/unparseable content) does not write `dist/index.html` | pitch.gate.md § Edge behavior ¶4 (split 3/3) | covered | |
| REQ-22 | A missing required field (`name`) is the same: exit code 1, one line, nothing written | pitch.gate.md § Edge behavior ¶5 | covered | |
| REQ-23 | Running `node build.mjs` twice produces byte-identical output | pitch.gate.md § Edge behavior ¶6 | covered | |
| REQ-24 | Run with `node --test`: a test file drives `node build.mjs` over temporary content files and asserts on the generated HTML text (no browser needed) | pitch.gate.md § Verification | covered | |

Out of scope (pitch § Rabbit holes, not requirements): Markdown in `about`, themes, multiple pages,
images, tracking or serving mode.
