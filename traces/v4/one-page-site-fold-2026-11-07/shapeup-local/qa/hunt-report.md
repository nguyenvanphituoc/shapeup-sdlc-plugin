# Hunt Report — one-page-site (round 1, 2026-11-07)
charters: 0/0 · session units spent: 0
status: not-hunted (deliverable not reached)

Preflight: EVAL-FEATURE-one-page-site.md verdict PASS; build gate r1-t1 green (node --test 19/19); no ledger yet (ingest creates it); Test Surface present. Knowledge base file shapeup/knowledge-base/qa-edge-hunter.md absent (no rules).

Blocker: the deliverable is a CLI (`node build.mjs`, env CONTENT_FILE / OUT_DIR). Every shell invocation of it was refused ("This command requires approval") in this non-interactive session, so no real invocation happened. Findings need a live repro; none are recorded.

Charters drafted but NOT run (for a re-dispatch with a node grant):
- C-01 [①] non-string / wrong-typed fields (tagline: 5, about: {}, projects: "abc", projects: [null,1], title as object) — crash vs. stack trace vs. contract's one-line error
- C-02 [①] url edge forms: uppercase scheme, whitespace inside, `https://` alone, ftp://, quote injection
- C-03 [①] contact.email as mailto: string / quote chars; contact as a string
- C-04 [③] OUT_DIR is an existing file; CONTENT_FILE is a directory; BOM-prefixed JSON; empty file — one-line error and nothing written?
- C-05 [⑤] unspecified breach routes: javascript:/data: URLs with case/whitespace tricks

## Findings by lens
none (not hunted)

## Session notes
Prepared script .shapeup/one-page-site/qa/hunt.mjs (unrun).
