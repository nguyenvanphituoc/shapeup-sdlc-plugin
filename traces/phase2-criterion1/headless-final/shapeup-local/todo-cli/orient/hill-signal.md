# Hill signal — todo-cli

Raw per-area unknown inventory (facts only; tech-lead positions the dots on the Hill).

## Scaffolding
- Open unknowns: none technical. No `package.json` exists yet (confirmed, code-surface.md) —
  purely build work, not a risk.
- Signal: **no uphill unknown**.

## Persistence / store
- Spiked this round (`spike-persistence.md`). Result: RESOLVED — corruption handling
  (`SyntaxError` on bad JSON), missing-file handling (`ENOENT`), and safe-write
  (tmp-file + `rename`) all confirmed working with Node core `fs` only, no dependency.
- One residual unknown, explicitly accepted out of scope: concurrent-process write races
  (no merge/lock). Not a blocker — pitch has no concurrency requirement and no-gos exclude
  server/sync.
- Signal: **at the crest** — approach proven, no open technical question remains.

## Commands (add / list / done / rm)
- Open unknown (unresolved, not spiked — it's a product/design decision, not a technical
  risk): are `<n>` arguments to `done`/`rm` positional indices (renumber on removal) or stable
  ids (assigned once, never reused)? This determines what "bad index" validation and post-`rm`
  numbering look like. Needs a `ba` decision before task ACs for `done`/`rm` can be written
  unambiguously.
- Open unknown: store file location (cwd-relative vs. home-relative) — affects how `list`
  behaves across different working directories and how tests set up fixtures.
- Signal: **uphill** — two unresolved decisions block precise task ACs, though neither is a
  technical risk (both are cheap to resolve, no spike needed — they're decisions, not
  unknowns-in-the-code).

## Summary
No uphill *technical* risk remains — the single spiked area (persistence/corruption handling,
the pitch's explicit "must behave sanely at the edges" requirement) is resolved at the crest.
The commands area carries two open *decisions* (index semantics, store location) that `ba`
should pin down in the spec before writing task acceptance criteria, so `done`/`rm` behavior is
testable and unambiguous.
