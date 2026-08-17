# Discovered-task seed — envlint

Candidates surfaced during orient, for the ledger / future `ba --tasks-only --from-discovered`
pass. None of these block the board from being written; they are open questions the spike could
not resolve from EXPECTED.md alone.

1. **Truncation semantics for E4** — EXPECTED.md says "line text truncated to 30 chars" but does
   not say whether truncation is by character count, whether multi-byte characters change that,
   or whether a truncation marker (e.g. `...`) is appended. Needs a decision + fixture before the
   E4 task can have an unambiguous acceptance test.
2. **`--json` payload shape details** — `{"ok":bool,"findings":[...],"checked":N}` is given, but
   the shape of each element of `findings` (field names: `key`? `line`? `message`?) is not
   specified. Needs to be pinned down when the Rules/CLI tasks are written so JSON and
   human-readable output stay in sync.
3. **`checked` count definition** — unclear whether `checked` counts schema keys, keys actually
   present in the file, or both. Affects the `ok: N keys checked` message and the JSON `checked`
   field identically — should be defined once and reused by both output paths.
4. **Duplicate key + type violation interaction** — EXPECTED.md says "a later assignment of the
   same key wins; the earlier one is not a finding" for parsing, but doesn't clarify whether
   type/enum rule-checking runs only against the winning (last) value — implied but worth an
   explicit test fixture.

None of these are rank-2+ risks (no crash/architecture risk, pure spec-clarification), so they do
not block Map Scopes; they should land as Test Surface rows once the BA pass writes the board.
