---
feature: personal-site
---
# Discovery Ledger — personal-site

## Discovered — personal-site/hunt (2026-11-07)
~ [lens:①boundary] [QA-001] [UC-BuildSite] Non-string `name` (0, false, array, object) passes validation and renders as `<h1>0</h1>`, `<h1>false</h1>`, `<h1>a</h1>`, `<h1>[object Object]</h1>`
    repro: 1. Write content.json {"name":{"a":1}} (also 0, false, ["a"]). 2. CONTENT_FILE=content.json OUT_DIR=out node build.mjs. 3. Exit 0; out/index.html has <h1>[object Object]</h1> and <title>[object Object]</title>.
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-002] [UC-BuildSite] Whitespace-only `name` is accepted as present, giving an empty-looking h1 and title
    repro: 1. content.json {"name":"   "}. 2. CONTENT_FILE=content.json OUT_DIR=out node build.mjs. 3. Exit 0; <h1>   </h1> and <title>   </title>, no NAME_MISSING.
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-003] [UC-BuildSite] `url` is escaped but not scheme-checked: `javascript:` url becomes a live link, and a whitespace-only url renders `<a href="   ">` instead of plain text
    repro: 1. content.json {"name":"A","projects":[{"title":"t","url":"javascript:alert(1)"}]}. 2. Run build with CONTENT_FILE/OUT_DIR. 3. Output has <a href="javascript:alert(1)">. Repeat with url "   ": <a href="   ">t</a>.
    severity-hint: boundary-breach
    test-gap: unit
~ [lens:①boundary] [QA-004] [UC-BuildSite] Wrong-typed or empty optional fields render garbage silently: `contact.email` object gives `mailto:[object Object]`, `about` array gives `a,b`, and a project entry that is null, a number, a string or `{}` gives an empty `<article><h3></h3></article>`; a project with url and no title gives an empty link `<a href="http://x"></a>`
    repro: 1. content.json {"name":"E","about":["a","b"],"contact":{"email":{"x":1}},"projects":[null,5,{},"str"]}. 2. Run build with CONTENT_FILE/OUT_DIR. 3. Exit 0; mailto:[object Object], <p>a,b</p>, four empty <article> cards.
    severity-hint: ux-degradation
    test-gap: unit
~ [lens:①boundary] [QA-005] [UC-BuildSite] Control characters pass through unescaped: a NUL byte or newline in `name` reaches the output HTML (newline lands inside <title>); a 1 MB `about` is emitted without limit
    repro: 1. content.json built with JSON.stringify({name:"N\u0000x\u202e", about:"a".repeat(1e6)}). 2. Run build. 3. Exit 0, output is 1000591 bytes and contains a raw U+0000. With name "l1\nl2", <title> spans two lines.
    severity-hint: cosmetic
    test-gap: unit
~ [lens:③state-interruption] [QA-006] [UC-BuildSite] UTF-8 BOM content file is rejected as CONTENT_INVALID_JSON (common for files saved by Windows editors); a build that fails leaves the previous dist/index.html in place, so a stale page can be deployed after a failed build
    repro: 1. printf '\xef\xbb\xbf{"name":"F"}' > c.json; CONTENT_FILE=c.json OUT_DIR=out node build.mjs -> exit 1, CONTENT_INVALID_JSON, 'Unexpected token'. 2. Build a valid file into out/, then build {} into the same OUT_DIR: exit 1 and out/index.html still holds the old page.
    severity-hint: ux-degradation
    test-gap: integration
~ [lens:⑤no-go] [QA-007] [UC-BuildSite] Unspecified path failures are not covered by the one-line error contract: OUT_DIR pointing at an existing file crashes with a raw Node stack trace (EEXIST) instead of a coded one-line stderr; OUT_DIR set to empty string silently falls back to dist/
    repro: 1. touch afile; echo '{"name":"P"}' > c.json. 2. CONTENT_FILE=c.json OUT_DIR=afile node build.mjs -> exit 1 with a multi-line 'node:fs ... Error: EEXIST: file already exists, mkdir' trace. 3. CONTENT_FILE=c.json OUT_DIR= node build.mjs writes ./dist/index.html.
    severity-hint: ux-degradation
    test-gap: integration
