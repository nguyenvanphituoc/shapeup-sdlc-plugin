---
appetite: small batch — a single build round
---

# Pitch — a one-page personal site, built from a content file

## Problem

A freelancer keeps their portfolio in a slide deck and sends people a PDF. They want a real web page
they can host anywhere, but they do not want a framework, a build service, or a CMS: they want to edit
one small content file and get a page.

## Solution shape

A zero-dependency Node script, `node build.mjs`, reads `content.json` and writes a single static
`dist/index.html` (inline CSS, no JavaScript required to read it).

`content.json` holds: `name`, `tagline`, `about` (one paragraph), `projects` (a list of
`{title, summary, url}`), and `contact` (`{email}`).

The page shows, in order: the name as the page's one `<h1>` with the tagline under it; an About section;
a Projects section with one card per project, each title a link to its `url`; a Contact section with a
`mailto:` link. The page `<title>` is the name.

The output path is `dist/index.html`; `build.mjs` may read `$CONTENT_FILE` and `$OUT_DIR` to override the
input and output locations, so a test can point it at throwaway files without touching the real ones.

## Edge behaviour (this is part of the pitch, not a detail)

- A project with no `url` renders its title as plain text, never as a link to `#` or an empty href.
- Zero projects renders the Projects section with the sentence "Projects are coming soon." and no empty list.
- Text from `content.json` is HTML-escaped: a title like `<b>Rock & Roll</b>` must appear as text.
- A missing or unparsable `content.json` makes `node build.mjs` exit 1 with one line on stderr naming the
  problem, and writes no `dist/index.html`.
- A missing required field (`name`) is the same: exit 1, one line, nothing written.
- `node build.mjs` run twice produces byte-identical output.

## Rabbit holes

Markdown in `about`, themes, multiple pages, images, and any watch or serve mode.

## No-gos

- No dependencies, no network calls, no JavaScript in the generated page.
- No overwriting `content.json`.

## Verification

Run by `node --test`: a test file that drives `node build.mjs` against throwaway content files and asserts
on the generated HTML text (no browser needed).
