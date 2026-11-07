---
type: usecase
feature: one-page-site
id: UC-BuildSite
bounded_context: SiteBuild
actor: Freelancer
entities: [SiteContent, Project]
repositories: [ContentSource, PageSink]
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: BuildSite

## Summary
The Freelancer runs `node build.mjs` on a valid content file and gets one static, script-free `index.html`.

## Preconditions
- A readable, valid content file exists at `$CONTENT_FILE` or `content.json`.

## Input

```typescript
interface BuildSiteInput {
  env: { CONTENT_FILE?: string; OUT_DIR?: string };
  content: ContentFile; // see [[contracts/content-file.contract]]
}
```

## Steps

```
1. Resolve input path ($CONTENT_FILE or content.json) and output dir ($OUT_DIR or dist)
2. Load and validate content (see [[usecases/UC-RejectInvalidContent]]); on failure stop, write nothing
3. Render the full document in memory: inline CSS, <title> = name, one <h1> = name, tagline, About, Projects, Contact
4. Render each project in array order as a card; title is a link only when url is http(s), else plain text
5. Zero projects → "Projects are coming soon." and no list
6. HTML-escape every content value in text and attribute positions
7. Create the output dir and write <OutDir>/index.html once, UTF-8, "\n" line endings
8. Exit 0
```

## Output

```typescript
interface BuildSiteOutput { exitCode: 0; file: "<OutDir>/index.html" }
```

## System Flow

```
[CLI: node build.mjs]
  → [Use Case: Freelancer.buildSite()]
    → [ContentSource.load() → content.json]
      → [render(SiteContent) → html string]
        → [PageSink.write() → dist/index.html]
```

## Invariants

- [INV-01] Two consecutive builds of the same content produce byte-identical output.
- [INV-02] The generated page contains no `<script>`, no inline event handler, and no external resource; CSS is inline.
- [INV-03] The content file is never written to.
- [INV-04] No content value reaches the page unescaped.
- [INV-05] A project without an http(s) `url` never renders an anchor (no `href="#"`, no empty href).
- [INV-06] The page has exactly one `<h1>`.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| — | Invalid input is handled by [[usecases/UC-RejectInvalidContent]] | n/a | exit 1 |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | Run `node build.mjs` twice against the same content into the same `OUT_DIR` and compare outputs | Byte-identical | D1: INV-01 |
| TS-INV-02 | process | Build, then search output for `<script`, ` on*=` attributes, `<link` and `src=` | None found; one `<style>` present | D1: INV-02 |
| TS-INV-03 | process | Hash the content file before and after a build | Hash unchanged | D1: INV-03 |
| TS-INV-04 | process | Build with project title `<b>Rock & Roll</b>` | Output contains `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; no raw `<b>` | D1: INV-04 |
| TS-INV-05 | process | Build with a project that has no `url` | Title present as plain text; no `href="#"`, no `href=""` | D1: INV-05 |
| TS-INV-06 | process | Build a full content file and count `<h1` | Exactly one, text = name | D1: INV-06 |
| TS-REQ-projects-empty | process | Build with `projects: []` | "Projects are coming soon." present; no `<ul>`/`<li>` | D3 |
| TS-REQ-projects-order | process | Build with three projects with urls | One card per project, array order, each title an `<a>` to its url | D3 |
| TS-REQ-layout | process | Build a full content file | `<title>` = name; h1, tagline, About, Projects, Contact in that order; contact is `mailto:` | D3 |
| TS-REQ-env-override | process | Build with `CONTENT_FILE` and `OUT_DIR` at temp paths | Output at `<OUT_DIR>/index.html` | D3 |
| TS-NOGO-01 | process | Read `build.mjs` imports; run the build | Only `node:` builtins; no network module; build succeeds | D4: no dependencies, no network |
| TS-NOGO-02 | process | Build with a `javascript:alert(1)` url | No `javascript:` href and no `<script` in output | D4: no JavaScript in the page |
| TS-NOGO-03 | process | Hash `content.json` before and after a build | Hash unchanged | D4: no overwriting content.json |

## Integration Points
- ← [[ux-behavior#Screen: SitePage]] — the rendered page
- ← [[ux-behavior#Screen: BuildOutcome]] — triggered by the CLI run
