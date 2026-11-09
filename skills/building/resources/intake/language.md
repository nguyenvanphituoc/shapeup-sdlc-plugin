# Intake — the language gate

| Contract | |
|---|---|
| Phase | `sub-command` |
| Order | `none` |
| Gate | `none` |
| Done when | every queued file has its `<name>.en.md` and the residual scan is clean; under `--check`, the detection is printed and nothing is written |

## 2. Language check — the harness is English end to end

The planner, the doers and the judge all assume English and fail hard on anything else, so this is the one
place a non-English intake is made English: **faithfully, once, by you, in this context** — no sub-agent. It
normalises language and nothing else: it never plans, builds or judges, never summarises, adds or drops a
requirement, and never translates harness *output* back into the PO's language. `/ship intake <path>…` (the
`intake` sub-command) runs just this step over named files, and with `--check` stops after the detection and
writes nothing.

**Detect.** For the pitch **and** its breadboard, sample headings and body prose (ignore code, identifiers and
URLs): `English` → used as it is, no `.en.md` written (idempotent, so a re-run and `--check` are safe and
cheap); `non-English` → queue; `mixed` → queue, and leave the English spans exactly as written.

**Glossary.** One English term per source term, across every document and every run — two spellings read as two
concepts to the planner's domain pass. Load the feature's `shapeup/<slug>/shaping/glossary.md` when it exists as
the base map; extract domain nouns, actor names, status/enum values, screen names and feature jargon with a
proposed English term each; mark the do-not-translate tokens (proper nouns, brand and product names, code
identifiers, API names, env vars, file paths), which pass through verbatim. **An ambiguous term (one source
word, several valid English terms) is asked of the PO and never guessed** — a wrong canonical term cascades
into every document and every round. `auto` and `unattended` runs go on when nothing is ambiguous, and still
stop when something is.

**Translate.** Write `<name>.en.md` beside its source — under `shapeup/<slug>/shaping/` when the source lives
there; the **original is never overwritten**. This is the committed tier, and the loop is its writer. Prose
becomes English with the glossary applied to every domain term; everything a machine parses stays byte
identical, and structure stays 1:1 — same headings, table rows, list items, order. What is kept and what is
translated, the glossary protocol and the verification scan are in `resources/intake/preservation.md`; read it
before translating any file.

**Verify, then sign off.** A residual-language scan of every `.en.md` outside code and do-not-translate tokens
(any hit lists `file:line` and the file does not pass), a structural diff against the source (heading, table-row,
list-item, wikilink and code-block counts must match — a mismatch is a requirement dropped or added), and a
glossary with no unresolved term. A dirty scan stops the run in every lane: a half-translated intake makes the
planner fail mid-run, which is worse than stopping here. Clean →

```
Translated   : <k> files → <name>.en.md
Glossary     : shapeup/<slug>/shaping/glossary.md (<t> terms, <a> resolved ambiguities)
Residual scan: clean | <n> non-English spans → [file:line …]
Structure    : matches source | <diff>
```

The run **opens on the `.en.md` files** (`--intake-file <name>.en.md`, and the `<breadboard>.en.md` copied to `.shapeup/<slug>/breadboard.md`):
the intake is what every planning step reads, so a translation made after the run opened reaches nobody. A run
already open on the original is reopened with `init run --force` — nothing has been planned yet. Once the run
is open, write the audit trail (what was detected, skipped or flagged, the glossary diff, the scan result) to
`.shapeup/<slug>/translation-report.md`.
