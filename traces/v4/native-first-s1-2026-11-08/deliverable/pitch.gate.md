---
appetite: small batch — one build round
---

# Pitch — a one-page personal website, built from one content file

## Problem

A freelancer keeps their portfolio in a slide deck and sends everyone a PDF copy. They want a real
web page they can put anywhere, but they do not want a framework, a build service or a CMS: they just want to edit one small
content file and get a page.

## Solution

A Node script with no library dependencies, `node build.mjs`, reads `content.json` and writes a single static file
`dist/index.html` (CSS embedded inline, no JavaScript needed to read it).

`content.json` contains: `name`, `tagline`, `about` (one paragraph), `projects` (a list of `{title, summary, url}`) and
`contact` (`{email}`).

The page renders in this order: the name is the page's only `<h1>` tag, with the tagline below it; an About section; a Projects section with
one card per project, whose title is a link to `url`; a Contact section with a `mailto:` link. The page's `<title>` tag is the name.

The script uses no library dependencies and makes no network calls, the generated page contains no JavaScript, and the script never
overwrites `content.json`.

The output path is `dist/index.html`; `build.mjs` may read `$CONTENT_FILE` and `$OUT_DIR` to change the input and output
locations, so that the test can point at a temporary file without touching the real one.

## Edge behavior (this is part of the pitch, not a side detail)

- A project with no `url` shows its title as plain text, never as a link to `#` or an empty href.
- With no projects at all, the Projects section shows the sentence "Projects are coming soon." and no empty list.
- Text from `content.json` is HTML-escaped: a title like `<b>Rock & Roll</b>` must appear as text.
- If `content.json` is missing or cannot be parsed, `node build.mjs` exits with code 1, prints one error line to stderr naming the problem,
  and does not write `dist/index.html`.
- A missing required field (`name`) is the same: exit code 1, one line, nothing written.
- Running `node build.mjs` twice produces byte-identical output.

## Rabbit holes

Markdown in `about`, themes, multiple pages, images, and any tracking or serving mode.

## Verification

Run with `node --test`: a test file drives `node build.mjs` over temporary content files and asserts on the
generated HTML text (no browser needed).
