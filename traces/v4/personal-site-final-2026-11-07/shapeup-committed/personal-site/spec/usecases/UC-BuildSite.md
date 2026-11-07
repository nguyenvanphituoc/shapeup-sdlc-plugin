---
type: usecase
feature: personal-site
id: UC-BuildSite
bounded_context: site-generation
actor: Admin
entities: [SiteContent, Project, Contact]
repositories: [ContentSource, PageSink]
domain_events_emitted: []
tags: [cli, build]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: ready
---

# Use Case: BuildSite

## Summary
The site owner runs `node build.mjs`, which reads `content.json` and writes a single static `dist/index.html`.

## Preconditions
- Node is installed; no packages are needed (zero dependencies).
- A content file exists at `$CONTENT_FILE` (default `content.json`).

## Input

```typescript
// env: CONTENT_FILE (default "content.json"), OUT_DIR (default "dist")
interface BuildSiteInput {
  name: string;            // required
  tagline: string;
  about: string;           // one paragraph, plain text
  projects: { title: string; summary: string; url?: string }[];
  contact: { email: string };
}
```

## Steps

```
1. Resolve input path ($CONTENT_FILE or content.json) and output dir ($OUT_DIR or dist)
2. Read the content file — missing → CONTENT_MISSING
3. Parse JSON — unparsable → CONTENT_INVALID_JSON
4. Validate required field name — absent → NAME_MISSING
5. Render HTML: <title>name</title>; <h1>name</h1> + tagline; About; Projects (cards, or the
   coming-soon sentence); Contact (mailto: link); inline CSS; every string HTML-escaped
6. Create the output dir and write <out>/index.html
7. Exit 0
```

On any error in steps 2–4: print one line to stderr, exit 1, write nothing.

## Output

```typescript
interface BuildSiteOutput {
  exitCode: 0;
  file: "<OUT_DIR>/index.html";   // static HTML, inline CSS, no script required
}
```

## System Flow

```
[CLI: node build.mjs]
  → [ContentSource.load() → file: $CONTENT_FILE]
    → [render(SiteContent) → string]
      → [PageSink.write() → file: $OUT_DIR/index.html]
```

## Invariants
- [INV-01] Running the build twice over the same input produces byte-identical output. (covers: REQ-18)
- [INV-02] A failed build writes no `index.html`. (covers: REQ-16, REQ-17)
- [INV-03] Text from `content.json` is HTML-escaped: `<b>Rock & Roll</b>` appears as text. (covers: REQ-14)
- [INV-04] The page has exactly one `<h1>`, containing the name. (covers: REQ-4)
- [INV-05] A project with no `url` renders its title as plain text — never a link to `#` or an empty href. (covers: REQ-12)
- [INV-06] Zero projects renders the Projects section with "Projects are coming soon." and no empty list. (covers: REQ-13)

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `CONTENT_MISSING` | content file does not exist | n/a (exit 1) | one stderr line naming the problem; nothing written |
| `CONTENT_INVALID_JSON` | content file is not parsable JSON | n/a (exit 1) | one stderr line naming the problem; nothing written |
| `NAME_MISSING` | required field `name` absent | n/a (exit 1) | one stderr line naming the problem; nothing written |

## Test Surface

| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | run `node build.mjs` twice with the same `CONTENT_FILE`/`OUT_DIR`, compare the two `index.html` buffers | identical bytes | D1: INV-01 |
| TS-INV-02 | process | run with an unparsable content file into an empty `OUT_DIR` | exit 1; `OUT_DIR/index.html` does not exist | D1: INV-02 |
| TS-INV-03 | process | build with a project title `<b>Rock & Roll</b>` | output contains `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`, no `<b>Rock` element | D1: INV-03 |
| TS-INV-04 | process | build valid content with two projects, count `<h1` in output | exactly 1, containing the name | D1: INV-04 |
| TS-INV-05 | process | build with one project lacking `url` | that title is not inside an `<a>`; no `href="#"`, no `href=""` | D1: INV-05 |
| TS-INV-06 | process | build with `projects: []` | output contains "Projects are coming soon." and no `<ul>`/`<ol>`/`<li>` in the Projects section | D1: INV-06 |
| TS-ERR-CONTENT_MISSING | process | `CONTENT_FILE` pointing at a nonexistent path | exit 1, stderr is exactly one line naming the problem, no `index.html` | D2 |
| TS-ERR-CONTENT_INVALID_JSON | process | `CONTENT_FILE` containing `{not json` | exit 1, stderr is exactly one line naming the problem, no `index.html` | D2 |
| TS-ERR-NAME_MISSING | process | valid JSON without `name` | exit 1, stderr is exactly one line naming the problem, no `index.html` | D2 + D3 (dedup: `name` missing-field) |
| TS-NOGO-01 | process | build with `about` = `**bold** text` | appears literally; no `<strong>`/`<em>` produced | D4: NOGO-01 |
| TS-NOGO-03 | process | build into an empty `OUT_DIR`, list it | `index.html` is the only HTML file written | D4: NOGO-03 |
| TS-NOGO-05 | process | run `node build.mjs` on valid content | process exits 0 on its own (no watch/serve loop) | D4: NOGO-05 |

## Integration Points
- ← [[ux-behavior#Screen: PersonalPage]] — the page this use case renders
- → [[contracts/build-cli.contract]] — env, exit codes, stderr shape
