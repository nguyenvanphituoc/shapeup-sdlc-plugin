---
type: ux-behavior
feature: one-page-site
tags: [ux]
depends_on: ["[[domain-model]]"]
status: draft
---

# UX Behavior: One-page site

## Screen: SitePage
The generated `index.html`. Static, readable with JavaScript disabled, CSS inline in one `<style>`.

| Region (in order) | Content | State rules |
|---|---|---|
| `<title>` | `name` | always |
| Header | one `<h1>` = `name`; tagline under it | tagline omitted when absent |
| About | heading + `about` paragraph | paragraph omitted when absent |
| Projects | heading + one card per project (title, summary) | title is an `<a href>` only when the url is `http(s)`; otherwise plain text. Zero projects → the sentence "Projects are coming soon." and no list |
| Contact | heading + `mailto:` link to `contact.email` | link omitted when no email |

All text from the content file is HTML-escaped in text and attribute positions.

## Screen: BuildOutcome
The terminal result of `node build.mjs`.

| State | Observable |
|---|---|
| success | exit 0, `<OutDir>/index.html` written, stdout may be empty |
| error | exit 1, exactly one line on stderr naming the problem, no `index.html` written |

```
$ node build.mjs            → exit 0, dist/index.html
$ node build.mjs (bad file) → "build: content is missing required field \"name\"", exit 1
```
