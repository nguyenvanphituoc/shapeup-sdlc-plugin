---
type: usecase
feature: personal-site
id: UC-BuildSite
bounded_context: site-generation
actor: Customer
entities: [SiteContent, Project]
repositories: [ContentSource, PageSink]
domain_events_emitted: []
tags: [cli, static-site]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: BuildSite

## Summary
The freelancer runs `node build.mjs`, which turns `content.json` into one static `dist/index.html`.

## Preconditions
- Node is installed; the project has no library dependencies to install.
- The content file (`$CONTENT_FILE` or `content.json`) is what the freelancer wants published.

## Input

```typescript
interface BuildSiteInput {
  // environment
  CONTENT_FILE?: string; // default "content.json"
  OUT_DIR?: string;      // default "dist"
  // content file (see [[domain-model#Aggregate-SiteContent]])
  name: string;          // required
  tagline?: string;
  about?: string;
  projects?: { title: string; summary?: string; url?: string }[];
  contact?: { email: string };
}
```

## Steps

```
1. Resolve BuildPaths from $CONTENT_FILE / $OUT_DIR (defaults content.json / dist)
2. ContentSource.load(): read the content file (missing → CONTENT_MISSING); parse JSON (→ CONTENT_INVALID_JSON)
3. Validate: name present (→ NAME_MISSING)
4. Render the HTML document in the fixed order of [[ux-behavior#Screen: PortfolioPage]], escaping every content string
5. PageSink.write(): create outDir if needed, write outDir/index.html
6. Exit 0
```

On any error in steps 2–3: print one line to stderr naming the problem, exit 1, write nothing.

## Output

```typescript
interface BuildSiteOutput {
  file: string;   // <OUT_DIR>/index.html
  exitCode: 0;
}
```

## System Flow

```
[CLI: node build.mjs]
  → [Use Case: BuildSite (build.mjs)]
    → [ContentSource.load() → FS: $CONTENT_FILE (read only)]
    → [render() → HTML string]
    → [PageSink.write() → FS: $OUT_DIR/index.html]
```

## Invariants
- [INV-01] The content file is never written, created, or modified by the build.
- [INV-02] The generated page contains no JavaScript (no `<script>` element, no `on*=` handler attribute, no `javascript:` URL).
- [INV-03] Running the build twice over the same input produces byte-identical output.
- [INV-04] The page has exactly one `<h1>`, whose text is `name`, and `<title>` is `name`.
- [INV-05] Every string from the content file is HTML-escaped in the output.
- [INV-06] A project with no `url` never renders as a link (no `href="#"`, no empty `href`).
- [INV-07] With no projects, the Projects section shows "Projects are coming soon." and no list element.
- [INV-08] The script uses no library dependencies and makes no network calls.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `CONTENT_MISSING` | the content file does not exist | n/a (exit 1) | one stderr line naming the file; nothing written |
| `CONTENT_INVALID_JSON` | the content file is not parseable JSON | n/a (exit 1) | one stderr line naming the parse problem; nothing written |
| `NAME_MISSING` | the parsed content has no `name` | n/a (exit 1) | one stderr line naming `name`; nothing written |

## Test Surface
<!-- DERIVED — regenerate via a retrofit-surface spec step; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | Hash the content file, run `node build.mjs` against it, hash it again | exit 0, hashes identical, mtime unchanged | D1: INV-01 |
| TS-INV-02 | process | Build from content whose strings include `<script>alert(1)</script>` and `onclick=` text | output has no `<script` element and no `on*=` attribute; the strings appear escaped | D1: INV-02 |
| TS-INV-03 | process | Run the build twice over the same content into two OUT_DIRs | the two `index.html` files are byte-identical | D1: INV-03 |
| TS-INV-04 | process | Build valid content with name "Ada" | exactly one `<h1>` whose text is "Ada"; `<title>Ada</title>` | D1: INV-04 |
| TS-INV-05 | process | Build with a project title `<b>Rock & Roll</b>` | output contains `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;` and no `<b>` element | D1: INV-05 |
| TS-INV-06 | process | Build with a project that has no `url` | the title appears as text; no `href="#"` and no `href=""` in the output | D1: INV-06 |
| TS-INV-07 | process | Build with `projects: []` and with `projects` absent | "Projects are coming soon." appears; no `<ul>`/`<ol>` in the Projects section | D1: INV-07 |
| TS-INV-08 | process | Inspect `package.json` dependencies; run the build with networking unavailable | no dependencies declared; build exits 0 | D1: INV-08 |
| TS-ERR-CONTENT_MISSING | process | Point `CONTENT_FILE` at a path that does not exist | exit 1, exactly one stderr line naming the file, no `index.html` in OUT_DIR | D2 |
| TS-ERR-CONTENT_INVALID_JSON | process | Point `CONTENT_FILE` at a file containing `{not json` | exit 1, exactly one stderr line, no `index.html` in OUT_DIR | D2 |
| TS-REQ-name-missing | process | Build content with every field except `name` | exit 1, exactly one stderr line naming `name`, no `index.html` in OUT_DIR | D3 + D2 (dedup: NAME_MISSING) |
| TS-NOGO-01 | process | Build with `about` = `**bold** _x_` | the Markdown appears as literal text; no `<strong>`/`<em>` | D4: no Markdown in about |
| TS-NOGO-02 | process | Build into an empty OUT_DIR | OUT_DIR holds exactly one file, `index.html` | D4: no multiple pages |
| TS-NOGO-03 | process | Run `node build.mjs` with valid content | the process exits on its own (no server left listening) | D4: no serving mode |

Spec gap (raised, not filled): the pitch does not say what a non-string `name` should do, so no
type-violation row is derived for `name`.

## Integration Points
- ← [[ux-behavior#Screen: PortfolioPage]] — the page this use case renders
- → [[domain-model#Repository Interfaces]] — ContentSource (read) and PageSink (write)
