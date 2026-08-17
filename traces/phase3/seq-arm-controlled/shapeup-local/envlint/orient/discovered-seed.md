# Discovered-task seed — envlint

Seed observations for `.shapeup/envlint/discovery/ledger.md`, to be picked up when the ledger is
initialized (BA / task-executor / QA stages). Not yet filed as `TS-INV` rows — that requires
`ba --tasks-only --from-discovered` per AGENTS.md.

1. **Protocol gate is easy to drop from the `url` rule.** A naive `url` type check that only does
   `try { new URL(v) } catch {}` (see spike) will pass `ftp://…`, `mailto:…`, `data:…` values.
   EXPECTED.md's Test Surface must include a non-http(s) scheme as a case (e.g. `ftp://x.com`
   against a `url` field), not just a malformed-string case, or a partial implementation could
   still pass a thinner test suite.

2. **`export KEY=value` vs quoted values interaction is untested by name in EXPECTED.md.**
   EXPECTED.md gives separate examples for `export KEY=value` and for quote-stripping, but never
   states the combined form `export KEY="value"`. Worth an explicit fixture line so parsing order
   (strip `export` prefix, then trim, then strip quotes) is unambiguous to whoever builds Parsing.

3. **Duplicate-key + malformed-line interaction is unspecified.** EXPECTED.md says "a later
   assignment of the same key wins; the earlier one is not a finding," and separately that an
   unparseable line produces a finding (E4). Not stated: does a duplicate `KEY=` assignment that
   itself fails a Rules check (e.g. duplicate `PORT=abc` overriding an earlier valid `PORT=8080`)
   correctly evaluate against the *winning* value, not the first one? Worth a fixture.

4. **Empty schema object `{}`** (valid JSON, but no keys declared) is not covered by
   EXPECTED.md's E1–E5 edge list. Per "a key present in the file but absent from the schema is
   not a finding," an empty schema against a non-empty env file should exit 0 with `ok: N keys
   checked` — worth confirming as an explicit fixture rather than inferring it.

5. **`--json` output ordering** — EXPECTED.md pins the JSON shape
   (`{"ok":bool,"findings":[…],"checked":N}`) but not the findings array's ordering guarantee
   (file order vs. schema-key order). Since human-readable output is implicitly line-ordered
   (findings printed with `<file>:<line>`), the JSON mode's array should likely follow the same
   order for consistency, but this should be confirmed with the PO/BA rather than assumed by the
   builder.

None of these block scoping — they are candidate Test Surface rows / fixture gaps to raise at
`ba-pitch-analyzer` time, surfaced here because they were only visible after actually reading
EXPECTED.md line-by-line and cross-checking it against the spiked `url`/parsing behavior.
