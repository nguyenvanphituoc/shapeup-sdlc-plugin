---
type: usecase
feature: one-page-site
id: UC-BuildPage
bounded_context: SiteBuild
actor: Customer
entities: [SiteContent]
repositories: []
domain_events_emitted: []
tags: [cli]
depends_on: ["[[domain-model]]", "[[ux-behavior]]"]
status: draft
---

# Use Case: BuildPage

## Summary
The site owner runs `node build.mjs`, which reads the content file and writes one static
`index.html`, or exits 1 with one error line and writes nothing.

## Preconditions
- Node is installed; the script has no library dependencies to install.

## Input

```typescript
interface BuildPageInput {
  CONTENT_FILE?: string; // env — default "content.json"
  OUT_DIR?: string;      // env — default "dist"
  content: {             // parsed from CONTENT_FILE, see [[domain-model#SiteContent (entity, new)]]
    name: string;        // required
    tagline?: string;
    about?: string;
    projects?: { title: string; summary: string; url?: string }[];
    contact?: { email: string };
  };
}
```

## Steps

```
1. Resolve the content path ($CONTENT_FILE, else content.json) and output dir ($OUT_DIR, else dist)
2. Read the content file; missing → CONTENT_MISSING
3. Parse it as JSON; failure → CONTENT_UNPARSEABLE
4. Check `name` is present; absent → NAME_MISSING
5. Render the page: <title>=name, <h1>=name, tagline, About, Projects, Contact; every value escaped
6. Create the output dir and write <out>/index.html (utf8)
7. Exit 0
```

## Output

```typescript
interface BuildPageOutput {
  file: "<OUT_DIR>/index.html"; // only on success
  exitCode: 0 | 1;
  stderr: string;               // exactly one line on failure
}
```

## System Flow

```
[Terminal: node build.mjs]
  → [Use Case: Owner.buildPage()]
    → [node:fs readFileSync(CONTENT_FILE) → JSON.parse → validate name]
      → [render(content) → HTML string]
        → [node:fs writeFileSync(OUT_DIR/index.html)]
```

## Invariants
- [INV-01] The content file is never written or modified by a build.
- [INV-02] Two builds of the same content produce byte-identical `index.html`.
- [INV-03] A failed build writes no `index.html`.
- [INV-04] Every text value from the content file appears HTML-escaped (a title `<b>Rock & Roll</b>` renders as text).
- [INV-05] The generated page contains no JavaScript (`<script` does not appear).
- [INV-06] The page has exactly one `<h1>`, holding the name, and its `<title>` is the name.
- [INV-07] A project with no `url` renders its title as plain text — no `<a>`, no `href="#"`, no empty href.
- [INV-08] With no projects, the Projects section shows "Projects are coming soon." and no list element.

## Error Cases

| Error Code | Condition | HTTP Status | Handling |
|---|---|---|---|
| `CONTENT_MISSING` | the content file does not exist | exit 1 | one stderr line naming the file; nothing written |
| `CONTENT_UNPARSEABLE` | the content file is not valid JSON | exit 1 | one stderr line naming the parse problem; nothing written |
| `NAME_MISSING` | `name` is absent | exit 1 | one stderr line naming `name`; nothing written |

## Test Surface
<!-- DERIVED — regenerate via a retrofit-surface spec step; do not hand-author rows here.
     Source must cite D1–D4. Exploratory/edge tests live in QA's charters, not here. -->
| ID | Oracle | Probe | Expect | Source |
|---|---|---|---|---|
| TS-INV-01 | process | Hash the content file, run `node build.mjs`, hash it again | exit 0, hashes equal | D1: INV-01 |
| TS-INV-02 | process | Run `node build.mjs` twice over the same content, compare outputs | both exit 0, files byte-identical | D1: INV-02 |
| TS-INV-03 | process | Run with an unparseable content file into an empty `OUT_DIR` | exit 1, no `index.html` in `OUT_DIR` | D1: INV-03 |
| TS-INV-04 | process | Build with a project title `<b>Rock & Roll</b>` | output contains `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`, not `<b>Rock` | D1: INV-04 |
| TS-INV-05 | process | Build valid content, search output for `<script` | not found | D1: INV-05 |
| TS-INV-06 | process | Build valid content, count `<h1` and read `<title>` | exactly one `<h1>` containing the name; `<title>` = name | D1: INV-06 |
| TS-INV-07 | process | Build with a project that has no `url` | title present as text; no `href="#"`, no `href=""`, no `<a>` around it | D1: INV-07 |
| TS-INV-08 | process | Build with `projects: []` | output contains "Projects are coming soon." and no `<ul`/`<li` | D1: INV-08 |
| TS-ERR-CONTENT_MISSING | process | Point `CONTENT_FILE` at a path that does not exist | exit 1, one stderr line naming the file, no `index.html` | D2 |
| TS-ERR-CONTENT_UNPARSEABLE | process | Content file holds `{not json` | exit 1, one stderr line naming the parse problem, no `index.html` | D2 |
| TS-REQ-name-missing | process | Content without `name` | exit 1, one stderr line naming `name`, no `index.html` | D3 + D2 (dedup: NAME_MISSING) |
| TS-NOGO-01 | process | Build with `about` = `**bold** _x_` (no-go: Markdown in about) | text appears literally; no `<strong>`/`<em>` | D4 |
| TS-NOGO-02 | process | Build into an empty `OUT_DIR`, list it (no-go: multiple pages) | exactly one file, `index.html` | D4 |
| TS-NOGO-03 | process | Run `node build.mjs` (no-go: serving mode) | the process exits on its own with code 0; nothing listens | D4 |

Spec gap (raised, not filled): `name` type-violation rows (D3) are not derived — the pitch gives no
behavior for a non-string `name`.

## Integration Points
- ← [[ux-behavior#GeneratedPage]] — produces the generated page.
