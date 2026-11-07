# Hunt Report — one-page-site (round 1, 2026-11-08)
charters: 0/18 · session units spent: 0
status: not-hunted (deliverable not reached)

## Gate Q0
- Deliverable: CLI (`node build.mjs`, no app_url, no launch_cmd). Every execution of `build.mjs`, with or without a
  CONTENT_FILE/OUT_DIR env prefix, and of a driver script `.shapeup/one-page-site/qa/hunt.mjs`, was refused
  for approval in this sandbox. Only `node --version` (v24.15.0) ran. Nothing was reached.
- EVAL: PASS. Test Surface present.
- Knowledge base `shapeup/knowledge-base/qa-edge-hunter.md`: absent (none recorded).

## Findings by lens
None confirmed. Rule 7 forbids findings from code reading; none were recorded.

## Prepared but unrun (candidate charters, from reading build.mjs)
- (1) `projects: [null]` or `[5]`: renderProject reads `p.url` on null and would throw an unhandled TypeError, with a stack trace and no dist.
- (1) `name` non-string (object/number/false): EVAL notes the spec gap. `name: false` or `0` passes the guard and renders; an object renders "[object Object]".
- (1) content root `[]` or `null`: guard handles null; `[]` reports missing name.
- (5) `url: "javascript:..."` is emitted unfiltered as an href (esc only escapes quotes).
- (1) `projects` as a string renders the coming-soon text silently; `contact` as a string renders an empty Contact section.
- (1) project without `title`: renders "undefined" via `String(undefined)`.
- (1) UTF-8 BOM in content.json: JSON.parse likely fails with a misleading message.
- (6) OUT_DIR reuse: stale files from earlier builds survive beside index.html (TS-NOGO-02 only checks a fresh dir).
Driver `.shapeup/one-page-site/qa/hunt.mjs` is ready to execute all of these once node execution is allowed.

## Session notes
All of the above is unconfirmed speculation from code reading and is NOT recorded as findings.
