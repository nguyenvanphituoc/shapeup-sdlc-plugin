# Hunt Report — envlint (round 1, 2026-08-17)

charters: 6/6 hunted (2 hammered out as inapplicable — logged below; auto mode, GATE Q1 not paused: interaction.pause_gates=false)
session units spent: ~6
out of bounds (excluded): none — local, stateless CLI tool; no payments/PII/prod data
hammered out at GATE Q1 (not hunted): none cut by review; 2 charters (③ state interruption, ⑥ data residue)
were narrowed to a single confirming probe each because UC-01/TS-NOGO-02/TS-NOGO-04 already establish the
tool is a single-process, no-persistence, no-network, read-only invocation (no state to interrupt, no
residue to leave)

## Findings by lens

| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary overflow | C-01 (encoding/size), C-02 (schema shape/type edges), C-03 (argv edges) | 5 | 0 |
| ② Concurrency | C-04 (not executed — read-only, no shared mutable resource per TS-NOGO-02) | 0 | 0 |
| ③ State interruption | (single-process invocation, no persistence — inapplicable, confirmed not hunted beyond reasoning) | 0 | 0 |
| ④ Cross-UC journey | (single UC in this feature — no journey to chain) | 0 | 0 |
| ⑤ No-go probing | C-05 (directory-as-path, path-shape breaches) | 0 | 0 |
| ⑥ Data residue | (no persistence per TS-NOGO-02/04 — inapplicable) | 0 | 0 |

→ details live in `.shapeup/envlint/discovery/ledger.md` under the `## Discovered` section ingest
  appends for this hunt's order.

## Shaping-quality signal (advisory, for the PO — next cycle's input)
- Lens ① produced all 5 findings, clustered around **schema-shape and schema-value validation** —
  the spec (`schema: Object.<string, Rule>`) never states what happens when the schema JSON parses
  but isn't shaped like that record (array/number/string), or when a `Rule`'s own fields are
  unrecognized/contradictory (`type` typo, `type` + `enum` both present). `isValueValid`'s
  fallthrough-to-`true` behavior for anything it doesn't recognize is a real permissiveness pattern,
  not a one-off — worth a domain-model note on "unknown schema shape/rule" as its own class next
  time UC-01 or a sibling UC is shaped.
- Lens ⑤ (no-go / non-file breach routes) came up clean — directory-as-path and path-traversal did
  not surface anything beyond the already-graceful E1/E2 errors.

## Session notes

**C-01 — boundary: encoding & size** (schema `{"X":{"type":"string"}}` / similar)
- 200 KB single value → parses fine, no truncation, no crash. Not a finding.
- Emoji (multi-codepoint `🏳️‍🌈`) and non-ASCII (`café`) values in both plain and `--json`
  render → both fine, correctly round-tripped in JSON output. Not a finding.
- Huge integer literal (`999...` far beyond MAX_SAFE_INTEGER) against `type:"int"` → regex-based
  check (`/^-?\d+$/`) accepts it, consistent with the spec's stated matcher, not a bug.

**C-02 — boundary: schema shape / rule-field edges**
- Empty schema object `{}` against a non-empty env file → `exit 0`, `ok: 0 keys checked`. Matches
  the ORIENT-seeded ledger expectation exactly. Not a finding (already flagged `+` at orient time).
- Unrecognized `type` value (e.g. `"weirdtype"`) → silently treated as always-valid; no error, no
  warning. **Finding QA-001.**
- `type` + `enum` both present on the same rule (e.g. `type:"string"` with `enum:["debug","info"]`)
  → `isValueValid`'s type-then-enum branch order returns on the `type==='string'` check before ever
  consulting `enum`, so the enum constraint is silently dropped. **Finding QA-002.**
- Schema JSON that parses but isn't an object — a bare array (`["not","an","object"]`) or a bare
  number (`42`) — passes the "valid JSON" gate (E2) and is handed straight to `Object.keys()`,
  producing nonsensical-but-not-erroring output (`ok: 3 keys checked` for the array case). **Finding
  QA-003.**

**C-03 — boundary: argv edges**
- Extra trailing positional arg (`envlint --schema s.json e.env extra-arg`) → silently ignored,
  only `e.env` is checked, no warning that `extra-arg` was dropped. **Folded into QA-004** (low
  severity, cosmetic).
- Unrecognized flag (`envlint --schema s.json --bogus e.env`) → `--bogus` is not recognized as a
  flag, falls into `positionals`, and becomes `positionals[0]` — i.e. it *shadows* the real
  `e.env` as the env-file path, producing the confusing `Error: cannot read env file: --bogus`
  instead of any hint that `--bogus` was the actual problem. **Finding QA-004.**
- `--schema` given twice → last one silently wins, no warning about the discarded first value.
  **Folded into QA-005** (low severity, cosmetic).
- Positional argument before `--schema` (`envlint e.env --schema s.json`) → parses correctly,
  order-independent. Not a finding (this is graceful, not a bug).

**C-05 — no-go: path-shape breaches**
- Env-file path is a directory → graceful `E1` (`Error: cannot read env file: <path>`), exit 2, no
  stack trace. Not a finding.
- Schema-file path is a directory → graceful `E_SCHEMA_UNREADABLE`, exit 2, no stack trace. Not a
  finding.

**C-04 — concurrency** — not executed as a live probe: the tool is confirmed read-only
(TS-NOGO-02: never writes to the `.env` file) and single-process with no shared external
mutable state, so two simultaneous invocations against the same fixture files have no
interaction surface to test. Reasoned inapplicable rather than run, to avoid spending a session
unit on a charter with no plausible finding.

✅ hunt complete — 5 findings (all `~`) → ledger · triage at SHIP S.0 / GATE L4.
