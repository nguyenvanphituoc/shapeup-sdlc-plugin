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
The Freelancer runs `node build.mjs` on a valid content file and gets one static, script-free `dist/index.html`.

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
3. Render the full document in memory: inline CSS, h1 name + tagline, About, Projects, Contact, title = name
4. Render each project in array order as a card; title is a link only when url is an allowed http(s) url, else plain text
5. Render "Projects are coming soon." and no list when there are zero projects
6. HTML-escape every content value in text and attribute positions
7. Create the output dir and write <OutDir>/index.html once, UTF-8, "\n" line endings
8. Exit 0
```

## Output

```typescript
interface BuildSiteOutput {
  exitCode: 0;
  file: "<OutDir>/index.html";
}
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

- [INV-01] Two consecutive builds of the same content produce byte-identical output (no timestamps, no randomness).
- [INV-02] The generated page contains no `<script>` and no external resource; CSS is inline.
- [INV-03] The content file is never written to.
- [INV-04] No content value reaches the page unescaped.
- [INV-05] A project without an allowed `url` never renders an anchor with `href="#"` or an empty href.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| — | Invalid input is handled by [[usecases/UC-RejectInvalidContent]] | n/a | exit 1 |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | Run `node build.mjs` twice against the same content and compare the two output files | Files are byte-identical | D1: INV-01 |
| TS-INV-02 | process | Build, then search the output text for `<script` and external `http` resources in `src`/`link` | None found; `<style>` is present | D1: INV-02 |
| TS-INV-03 | process | Hash the content file before and after a build | Hash unchanged | D1: INV-03 |
| TS-INV-04 | process | Build with a project title `<b>Rock & Roll</b>` and an `about` containing `<i>` | Output contains `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`; no raw `<b>` or `<i>` from content | D1: INV-04 |
| TS-INV-05 | process | Build with a project that has no `url` | Title appears as plain text; output has no `href="#"` and no `href=""` | D1: INV-05 |
| TS-REQ-projects-empty | process | Build with `projects: []` | Output contains "Projects are coming soon." and no `<ul>`/`<li>` in the Projects section | D3 |
| TS-REQ-projects-order | process | Build with three projects and `url`s | One card per project in array order; each title is an `<a>` with its url | D3 |
| TS-REQ-layout | process | Build a full content file | Exactly one `<h1>` equal to name, tagline after it, then About, Projects, Contact in order; `<title>` equals name; contact is a `mailto:` link | D3 |
| TS-REQ-env-override | process | Build with `CONTENT_FILE` and `OUT_DIR` pointing at temp paths | Output at `<OUT_DIR>/index.html`; default `dist/` untouched | D3 |
| TS-NOGO-01 | process | Inspect the build source and run it with the network unavailable | No imports beyond `node:` builtins, no network calls; build succeeds | D4: no dependencies, no network |
| TS-NOGO-02 | process | Build with a `javascript:` url | No anchor with a `javascript:` href in the output | D4: no JavaScript in the page |

## Integration Points
- ← [[ux-behavior#Screen: BuildOutcome]] — triggered by the CLI run
- → [[integration]] — filesystem read and write only
