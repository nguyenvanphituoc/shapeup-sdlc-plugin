---
type: usecase
feature: personal-site
id: UC-BuildPage
lens: lite
bounded_context: site-publishing
actor: Freelancer
entities: [SiteContent, Project, Contact]
repositories: [ContentSource, PageSink]
domain_events_emitted: []
tags: [cli, render]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: BuildPage

## Summary
The freelancer runs `node build.mjs`, which reads the content file and writes one static
`index.html` — or reports one error line and writes nothing.

## Preconditions
- Node with ESM support; no `npm install` (the script has no dependencies).
- A content file at `$CONTENT_FILE`, or `content.json` in the working directory.

## Input

```typescript
// Environment
interface BuildEnv {
  CONTENT_FILE?: string; // default "content.json", resolved against cwd
  OUT_DIR?: string;      // default "dist", resolved against cwd
}

// The content file (JSON)
interface BuildPageInput {
  name: string;                 // required, non-empty
  tagline?: string;
  about?: string;               // one paragraph, plain text
  projects?: { title: string; summary?: string; url?: string }[];
  contact?: { email?: string };
}
```

## Steps

```
1. Resolve ContentPath ($CONTENT_FILE | content.json) and OutputPath ($OUT_DIR | dist)
2. ContentSource.load(ContentPath) — missing → CONTENT_MISSING; bad JSON → CONTENT_UNPARSEABLE
3. Validate: name is a non-empty string — else NAME_MISSING
4. Render the page as a pure function of the content (escape every string; fixed order; no script)
5. PageSink.write(OutputPath, html) — create the directory, write index.html
6. Exit 0
   On any error in 2–3: print one line to stderr, exit 1, and reach step 5 never
```

## Output

```typescript
interface BuildPageOutput {
  file: "<OUT_DIR>/index.html"; // UTF-8 HTML, inline <style>, no JavaScript
  exitCode: 0;
}
```

## System Flow

```
[CLI: node build.mjs]
  → [UseCase: buildPage(env)]
    → [ContentSource.load(ContentPath) → fs.readFileSync]
    → [render(content) → html string]
    → [PageSink.write(OutputPath) → fs.mkdirSync + fs.writeFileSync <OUT_DIR>/index.html]
```

## Invariants
- [INV-01] The generated page contains no JavaScript: no `<script>` element, no `on*` attribute, no `javascript:` URL — a project `url` with any scheme other than `http:`/`https:`/relative renders its title as plain text.
- [INV-02] The content file is never written: its bytes are identical before and after any run.
- [INV-03] Two runs over the same content produce byte-identical `index.html`.
- [INV-04] Every content string is HTML-escaped: `<b>Rock & Roll</b>` appears as text, never as markup, in text and in attribute values.
- [INV-05] The page has exactly one `<h1>`, whose text is `name`, and its `<title>` is `name`; the tagline follows the `<h1>`; About, Projects, Contact follow in that order.
- [INV-06] A project with no `url` renders its title as plain text — no `<a>`, no `href="#"`, no empty `href`.
- [INV-07] With no projects, the Projects section contains "Projects are coming soon." and no list element.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `CONTENT_MISSING` | the content file does not exist | n/a (exit 1) | one stderr line naming the path; nothing written |
| `CONTENT_UNPARSEABLE` | the content file is not valid JSON | n/a (exit 1) | one stderr line naming the file and the parse failure; nothing written |
| `NAME_MISSING` | `name` is absent, not a string, or empty | n/a (exit 1) | one stderr line naming `name`; nothing written |

## Test Surface

<!-- DERIVED from Invariants (D1), Error Cases (D2), Input shape (D3), pitch No-gos (D4). Oracle: process — the deliverable is a CLI. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | build with a project `url` of `javascript:alert(1)` | exit 0; output has no `<script`, no ` on…=` attribute, no `javascript:`; that title is plain text | D1: INV-01 |
| TS-INV-02 | process | hash the content file, run the build, hash again | hashes equal | D1: INV-02 |
| TS-INV-03 | process | run the build twice into two output dirs over the same content | the two `index.html` files are byte-identical | D1: INV-03 |
| TS-INV-04 | process | build with a project title `<b>Rock & Roll</b>` and an `email` containing `"` | output contains `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`, no `<b>` element, and the `mailto:` href is escaped | D1: INV-04 |
| TS-INV-05 | process | build with full content | exactly one `<h1>` = name; `<title>` = name; tagline after `<h1>`; About before Projects before Contact | D1: INV-05 |
| TS-INV-06 | process | build with a project that has no `url` | its title appears with no `<a>`; output has no `href="#"` and no `href=""` | D1: INV-06 |
| TS-INV-07 | process | build with `projects: []` | output contains "Projects are coming soon." and no `<ul>`/`<ol>`/`<li>` | D1: INV-07 |
| TS-ERR-CONTENT_MISSING | process | `CONTENT_FILE` points at a path that does not exist | exit 1; stderr is one line naming the path; no `index.html` in `OUT_DIR` | D2 |
| TS-ERR-CONTENT_UNPARSEABLE | process | content file holds `{not json` | exit 1; stderr is one line; no `index.html` in `OUT_DIR` | D2 |
| TS-REQ-name-missing | process | content without `name` | exit 1; stderr is one line naming `name`; no `index.html` | D3 + D2 (dedup: NAME_MISSING) |
| TS-REQ-name-type | process | `name` = `42` and `name` = `""` | exit 1; one stderr line; no `index.html` | D3 + D2 (dedup: NAME_MISSING) |
| TS-NOGO-01 | process | `about` = `**bold** _x_` | the literal `**bold** _x_` appears; no `<strong>`/`<em>` | D4: no Markdown in `about` |
| TS-NOGO-02 | process | copy `build.mjs` alone into an empty temp dir with a content file and run it | exit 0 with no `node_modules` present; `package.json` declares no `dependencies` | D4: no library dependencies |

## Integration Points
- ← [[ux-behavior#Screen: PersonalPage]] — the page this use case writes
- → [[domain-model#Repository Interfaces]] — `ContentSource`, `PageSink`
