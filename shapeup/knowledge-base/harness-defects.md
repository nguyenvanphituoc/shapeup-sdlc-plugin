# Harness Defect Register

> Filed by `/coach` from Ship-Gate (L4) feedback the PO categorized as `harness-defect` at
> GATE COACH-1. **Read by no worker** — these are drafted raw ideas for the Betting Table
> (the debt-free path), not guidelines. Remove an entry when its fix ships or its pitch is bet.

## Defects

*(none open — see Resolved)*

## Resolved

Kept rather than deleted. A defect that shipped a fix is evidence about the mechanism, and the
register is the only place that records one was ever open — the same discipline
`evals/DAY1-REPORT.md` applies to withdrawn measurements.

- **HD-005 — FIXED 2026-08-04. The fifth of the family, and the first that fails CLOSED.**
  A markdown **code span** around a cell value was read as part of the value. These contracts are
  markdown, and a code span is how anyone writes a path in one — this repo's own prose backticks
  every path it names, and the `solution-architect` contract that governs the field says only
  *"repo-relative path — name the real path"*, which a backticked path is. Read literally,
  `` `src/capture/add.js` `` is a filename with two backticks in it, so `trace-lint` reported
  `engine file not on disk` for all six engines of a wiring map, and then
  `reachability is not demonstrated` — for a map in which every engine **resolves and reaches the
  entry point**, and which had correctly excluded the orphaned `src/legacy/archive.js` by name.
  **HD-001 made this gate fail open; HD-005 makes the same gate fail closed.** Both produce a wrong
  verdict from correct content, and the closed direction is the one that sends a worker to fix a
  defect that does not exist — or blocks a correct map at GATE L1a.5.
  Fixed in `contract-md.mjs`'s `coerce`, which is the one place both frontmatter and table cells
  pass through: a value that is *entirely* one code span is unwrapped, and prose that merely
  contains spans (every wiring map's `wiring_seam` and `entry_call_site` column) is untouched.
  Pinned by structural §46(i) and mutation-verified in both directions — reverting the fix fires
  the regression guard, and stripping backticks everywhere instead fires the two non-regression
  guards. · discovered by the Day-1 measurement loop, not in production — a paid
  `solution-architect` round scored **0.667 on a correct map**, and re-scoring the identical stored
  draft with the backticks stripped and nothing else changed took it to **1.0** (2026-08-04)

- **HD-003 / HD-004 — FIXED 2026-08-04. One defect, two parsers, and the second is the finding.**
  A frontmatter list written as a YAML **block sequence** was silently discarded — the key parsed
  as `null`, its members gone, and no reader could tell "declared nothing" from "declared something
  I threw away". HD-003 was that defect in `contract-md.mjs` (committed contracts), found when a
  `scope-architect` run wrote three scopes of researched fixtures in block form and every one
  evaporated. It was fixed there — and **the identical defect was still live in a second parser**,
  `board-derive.mjs`'s private `listField`, which reads the BOARD. That is HD-004, and it cost a
  full paid `ba-pitch-analyzer` measurement: all three runs wrote block-form task frontmatter, so
  `use_case_refs` and `touched_files` came back empty for every task, `depends_on`/`unlocks` came
  back empty in **both** directions so edge-symmetry passed VACUOUSLY, and the published number
  (v1 0.8, approve 1/3) described the parser. Re-scored under the fix the same drafts read 9/10,
  9/10, 10/10.
  **The lesson is the duplication, not the bug.** This repo had two hand-rolled frontmatter readers
  for one documented format, and they had drifted; fixing one left the other reporting empty. The
  fix removes the second implementation rather than patching it — `board-derive`'s `listField` now
  delegates to `splitFrontmatter`, and the eval renderer uses the same reader, so there is one
  parser for one format. Both forms are now accepted (inline `[a, b]` and block), and any indented
  shape that is still unreadable is reported through the HD-001 `unreadableReason()` channel rather
  than dropped. Pinned by structural §46(h); mutation-verified.

- **HD-002 — FIXED 2026-08-04**, found and fixed in the same session. **A committed contract's
  `[a, b]` list was split on every comma, quoted or not**, so any member carrying a comma was
  silently shredded into several. Found by a paid `scope-architect` run doing exactly what its own
  SKILL.md asks: it probed the running CLI, confirmed `tag` was unimplemented, and wrote one
  honest entry —
  `["TBD — `tag` is not in dispatch.js's TABLE (exits 1, confirmed against the running CLI). A
  fixture asserting the spec'd behaviour (attach/remove a tag, idempotent double-tag) can only be
  written once the command exists."]` — which the parser turned into **four** members, three of
  them prose. This field is not inert: `t0-verify` **executes** `e2e_verification_fixtures`, so the
  run would have tried to spawn `idempotent double-tag)`. The rule that says *"mark TBD and flag
  it"* was in direct tension with a format that could not carry a flag containing a comma.
  Mechanism: `contract-md.mjs` `coerce()` (naive `split(",")`) and `uncoerce()` (rendered members
  back unquoted, so the round trip re-shredded them). Fix: quote-aware `splitList()`, `uncoerce()`
  quotes any member containing a comma or a quote, and the list test now runs BEFORE quote
  stripping so `"[a, b]"` stays a string rather than becoming a list. Pinned by structural §46(g)
  including the non-regression cases (id lists, substrate globs); mutation-verified — restoring the
  naive split reproduces the shredding verbatim, 1 member into 3.
  <br/>**Discovered by the Day-1 loop, in the act of measuring** — the fixture that surfaced it was
  built to test whether a skill checks facts about the running build, and the first thing it found
  was that the harness could not faithfully record the answer.

- **HD-001 — FIXED 2026-08-04**, in the session that found it, at the PO's direction.
  `parseContract` now distinguishes *declared-and-absent* from *declared-and-unreadable*: each
  contract type carries a `signatures` column set (`WiringMap.entries` → `use_case` + `engine`),
  and a table matching that signature under a heading the spec does not claim is recorded on
  `$unreadable_tables` and surfaced by `unreadableReason()`. `trace-lint` now emits a red
  `WIRING-UNREADABLE` and reports `reachability.checked: false` rather than claiming a walk it
  never made; `spec-lint` emits a red `CONTRACT-UNREADABLE`. Prose tables are unaffected — the
  signature columns are what identify the field. Pinned by structural §46(f) on all three legs
  (the diagnosis, the oracle's verdict, the gate's exit code), mutation-verified: removing the fix
  fails all three and reproduces the original behaviour verbatim — `overall=green`,
  `reachability checked=true pass=true having walked nothing`.
  <br/>Original entry, for the record:

- **HD-001** — A committed contract whose markdown table sits under a heading the parser does not
  recognise loads as **empty, silently**, and the oracle that exists to check it then reports
  **green**. Observed with `wiring-map.md`: `contract-md.mjs` keys the entries table on a heading
  whose text is exactly `Wiring`, so a map written under `# Wiring map — <slug>` parses to zero
  entries; `trace-lint.mjs` then prints `🟢 green · reachability: 0/0 engines reach src/cli/main.js`
  for a file holding six correct rows. The artifact whose whole purpose is *"no engine ships
  orphaned"* fails **open** — a run in which the wiring map was written, reviewed and committed can
  pass GATE L1a.5 having checked nothing. `readContract` returns the parsed object with the table
  field simply absent, and every downstream reader treats absent as "none declared" rather than as
  "this file said something I could not read". The same shape applies to `ScopeContract`'s
  `## Affordances` and to any future table field. Suspected mechanism:
  `skills/tech-lead/scripts/lib/contract-md.mjs` (`parseTables` / `parseContract` — a declared
  table with no matching heading is indistinguishable from one with no rows) plus every oracle that
  reads a contract without asserting the read succeeded.
  Raw idea: make an unparseable contract loud instead of empty. `parseContract` should distinguish
  *declared-and-absent* from *declared-and-unreadable* — if a spec names a table and the body
  contains a markdown table under no recognised heading, that is a parse error, not an empty list.
  Oracles that consume contracts (`trace-lint`, `spec-lint`) should refuse to report green on a
  contract that failed to parse, the same way `process-oracle` exits 2 on a malformed contract
  rather than grading the artifact 0. Cheapest partial fix if the full one is too big for the
  appetite: have `renderContract`'s heading set be the *only* accepted form and add a structural
  test that round-trips each contract type through a wrong-heading mutation, asserting the reader
  reports a failure. · discovered by the Day-1 measurement loop, not in production — `P3` /
  `solution-architect`, 2 of 3 first drafts on `claude-sonnet-5` wrote the correct content under a
  heading the parser rejects (2026-08-04)
