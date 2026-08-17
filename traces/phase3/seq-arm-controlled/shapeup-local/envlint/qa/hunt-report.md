# Hunt Report — envlint (round 2, 2026-08-17)

charters: 6/6 · session units spent: 6
out of bounds (excluded): none (non-interactive dispatch — no question raised)
hammered out at GATE Q1 (not hunted): none — `--auto`-equivalent (order has `interaction.pause_gates: false`)

## Preflight
- Entry point: `bin/envlint.mjs` (process/CLI feature — `app_url` correctly absent from the
  order; drove the built binary directly per project-profile.md, matching the evaluator's own
  probe method).
- EVAL: `.shapeup/envlint/evaluation/EVAL-FEATURE-envlint.md` — verdict PASS (round 2, dimension
  spec-conformance).
- Ledger: absent — first hunt for this feature.
- Test Surface: present (`shapeup/envlint/spec/usecases/UC-01.md`) — no degraded mode.

## Charter Map (post EVAL-coverage subtraction)
| ID | Lens | Mission |
|---|---|---|
| C-01 | ① Boundary overflow | argv shapes the Steps/Input contract never bounds: unrecognized flags, absent envfile positional |
| C-02 | ① Boundary overflow | schema JSON shapes the domain model never bounds: non-object rule values, non-object top-level schema (`null`, array, number) |
| C-03 | ① Boundary overflow | env value content: unicode/emoji, CRLF line endings, very long (20KB) values |
| C-04 | ⑤ No-go probing | interpolation via bash-style `$VAR` (no braces) — TS-NOGO-01 only pins `${OTHER_VAR}` |
| C-05 | ⑥ Data residue | schema/env source files unmodified after a run (no fs write path exists in source — low yield, confirmed by inspection + one live run) |
| C-06 | ④ Cross-UC journey | N/A — single UC feature (dropped, no journey to chain) |

Lenses ② (concurrency) and ③ (state interruption) were considered and dropped as low-yield:
`envlint` is a single-shot, synchronous, stateless process invocation with no persisted
aggregate to race on or interrupt mid-flow — the entire "flow" is one function call.

## Findings by lens
| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01, C-02, C-03 | 3 | 1 |
| ⑤ No-go | C-04 | 0 | 0 |
| ⑥ Data residue | C-05 | 0 | 0 |

→ full finding details land in `.shapeup/envlint/discovery/ledger.md` under the `## Discovered`
  section ingest appends for this hunt's order.

## Shaping-quality signal (advisory, for the PO — next cycle's input)
- Lens ① findings cluster entirely around **unvalidated external input shapes** the Input
  contract (`LintEnvFileInput`) and domain model (`SchemaRule`) never bound: argv tokens outside
  `--schema`/`--json`/one positional, and schema-file JSON shapes outside "object of
  `SchemaRule`". The spec pins value-level edge cases exhaustively (Test Surface TS-TYPE-*) but
  never pins the *shape* of the schema document itself or of argv beyond the happy path — that
  gap, not a coding slip, is what let `Object.keys(null)` reach production code unguarded.
- No lens ⑤ or ⑥ findings — the no-go boundary (no interpolation, no writes, no network) is
  drawn tightly and holds under adversarial variants the Test Surface didn't literally spell out.

## Session notes

**C-01 — argv boundary (finding QA-001)**
Tried: missing `--schema`, missing positional (both match spec, no finding), an unrecognized
flag token (`--unknown-flag`) placed between `--schema <path>` and the real envfile path.
`parseArgs` treats any token that isn't `--schema`/`--json` as *the* positional envPath the
first time it sees one — so the unrecognized flag itself becomes `envPath`, and the real
envfile argument that follows is silently dropped (loop only fills `envPath` once, `if
(envPath === null)`). Confirmed via repro below. No repro found for `--schema` given twice
(later wins, undocumented but harmless and consistent with the codebase's own INV-02 "last
wins" convention elsewhere) — logged as observation only, not a finding.

**C-02 — schema shape boundary (findings QA-002, QA-003)**
Tried: a schema entry whose rule is a bare string (`{"X":"int"}`) instead of a `SchemaRule`
object; a schema document that is a JSON array; a schema document that is the JSON literal
`null`; a schema document that is a bare JSON number.
- Bare-string rule: `rule.type` reads `undefined` off a string primitive → the `if (rule &&
  rule.type)` guard is silently false → zero type/enum checking ever runs for that key, and the
  tool reports `ok` even for a value that would fail every stated type rule. No crash, no
  message — a silent pass-through. (QA-002)
- `null` schema: `Object.keys(schema)` throws `TypeError: Cannot convert undefined or null to
  object` inside `main()`. Node prints the full stack trace to stderr and the process exits
  with **code 1** — not the `Error: `-prefixed single line INV-05 requires, not the "exit ∈
  {0,1,2}, never a raw stack trace" INV-03 promises. This is the headline finding: it directly
  contradicts two invariants the evaluator graded PASS this round (its TS-INV-03/TS-INV-05
  probes never tried a schema document that parses to something other than an object). (QA-003,
  `contradicts: INV-03, INV-05`)
- Array / bare-number schema: no crash (`Object.keys` on an array yields index strings,
  `Object.keys` on a boxed number yields `[]`) — logged as observation only (nonsensical
  `checked` count, e.g. an array `["a","b","c"]` reports `checked: 3`, but no crash and no
  finding worth a separate ledger entry beyond QA-003's root cause).

**C-03 — env value boundary**
Tried: ZWJ emoji sequences and RTL unicode in both key position and value position, CRLF
(`\r\n`) line endings throughout a fixture, a single 20,000-character value. All three parsed
and rendered correctly — `.trim()` strips `\r`, unicode passes through untouched, no length cap
misbehaves. No finding.

**C-04 — no-go interpolation via bash-style `$VAR`**
`B=$A world` next to `A=hello` in the same file: the literal string `$A world` is what gets
checked, matching the `${OTHER_VAR}` behavior TS-NOGO-01 already pins for the braced form. No
finding — the no-go holds for the unbraced variant too.

**C-05 — data residue**
Inspected `src/parsing.mjs`, `src/rules.mjs`, `bin/envlint.mjs` for any `fs.write*`/`fs.append*`
call — none exists; the only filesystem calls are two `readFileSync`s. One live run followed by
inspection of the schema/env fixtures showed no observable mutation. No finding; charter closed
early once source inspection made the "low yield" call visible (documented via
`H.5`-style honesty rather than manufacturing findings on a stateless CLI with no residue
surface).

## Reproductions

**QA-001 — argv: unrecognized flag consumes the positional envfile slot**
```
1. schema.json: {"X":{"type":"int"}}
2. envfile.env: X=1
3. Run: node bin/envlint.mjs --schema schema.json --unknown-flag envfile.env
4. Observed: stderr "Error: cannot read env file: --unknown-flag", exit 2
   Expected (per Input contract, silently): envfile.env is read; --unknown-flag is either
   rejected explicitly or ignored, not treated as the positional argument.
```

**QA-002 — schema: non-object rule value silently disables all validation for that key**
```
1. schema.json: {"X":"int"}          (rule is a bare string, not {"type":"int"})
2. envfile.env: X=notanumber
3. Run: node bin/envlint.mjs --schema schema.json --json envfile.env
4. Observed: {"ok":true,"findings":[],"checked":1}, exit 0
   A value that would fail an equivalent well-formed rule ({"type":"int"}) is silently
   accepted because `rule.type` is undefined on a string primitive.
```

**QA-003 — schema: `null` document crashes with an uncaught stack trace (contradicts INV-03, INV-05)**
```
1. schema.json content: null          (valid JSON, JSON.parse succeeds)
2. envfile.env: X=1
3. Run: node bin/envlint.mjs --schema schema.json --json envfile.env
4. Observed stderr:
   TypeError: Cannot convert undefined or null to object
       at Object.keys (<anonymous>)
       at main (bin/envlint.mjs:68:26)
       ... (full stack trace, no "Error: " prefix, multi-line)
   Observed exit code: 1 (not 2)
   Expected per INV-03: exit code ∈ {0,1,2}, never a raw stack trace.
   Expected per INV-05: any tool-cannot-run condition -> exit 2, stderr "Error: <reason>",
   single line, no stack trace. Neither holds.
```

✅ hunt complete — 3 findings (all ~) → ledger · triage at SHIP S.0 / GATE L4.
