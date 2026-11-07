# Requirements registry — envlint

Source: the kicked-off pitch `pitch.gate.md` (raw idea — `envlint`). It carries no R-ids, so numbering
starts at REQ-1. Ids are frozen: never renumber; a dropped clause is marked `CUT (PO-approved)`.

| REQ-id | clause (verbatim) | source | status | note |
|---|---|---|---|---|
| REQ-1 | point it at a `.env` file and a small JSON schema describing which keys are required and what shape each value must have | pitch.gate.md §The pitch | covered | |
| REQ-2 | it tells them exactly what is wrong — key by key, line by line | pitch.gate.md §The pitch | covered | |
| REQ-3 | and exits non-zero so CI can fail on it | pitch.gate.md §The pitch | covered | |
| REQ-4 | It must behave sanely at the edges: a missing file | pitch.gate.md §The pitch (split 1/3) | covered | |
| REQ-5 | It must behave sanely at the edges: an unreadable schema | pitch.gate.md §The pitch (split 2/3) | covered | |
| REQ-6 | It must behave sanely at the edges: a file with no assignments at all | pitch.gate.md §The pitch (split 3/3) | covered | |
| REQ-7 | A linter that crashes on a malformed input is worse than no linter | pitch.gate.md §The pitch | covered | |
| REQ-8 | The env file and the schema file are both passed as arguments — `envlint --schema <schema.json> <envfile>` | pitch.gate.md §The pitch | covered | |
| REQ-9 | with no implicit lookup of the developer's own `.env` | pitch.gate.md §The pitch | covered | |
| REQ-10 | Parsing — turn `.env` text into key/value pairs | pitch.gate.md §The three pieces | covered | |
| REQ-11 | Handles `KEY=value` | pitch.gate.md §The three pieces (split 1/6) | covered | |
| REQ-12 | Handles `#` comments | pitch.gate.md §The three pieces (split 2/6) | covered | |
| REQ-13 | Handles blank lines | pitch.gate.md §The three pieces (split 3/6) | covered | |
| REQ-14 | Handles `export KEY=value` | pitch.gate.md §The three pieces (split 4/6) | covered | |
| REQ-15 | Handles single-quoted values | pitch.gate.md §The three pieces (split 5/6) | covered | |
| REQ-16 | Handles double-quoted values | pitch.gate.md §The three pieces (split 6/6) | covered | |
| REQ-17 | reports the 1-based line number of anything it cannot parse | pitch.gate.md §The three pieces | covered | |
| REQ-18 | Pure: text in, `{pairs, problems}` out | pitch.gate.md §The three pieces (Parsing) | covered | |
| REQ-19 | Rules — given parsed pairs and a schema, decide what is wrong. Supports `required` | pitch.gate.md §The three pieces (split 1/6) | covered | |
| REQ-20 | `type` of `string` | pitch.gate.md §The three pieces (split 2/6) | covered | |
| REQ-21 | `type` of `int` | pitch.gate.md §The three pieces (split 3/6) | covered | |
| REQ-22 | `type` of `bool` | pitch.gate.md §The three pieces (split 4/6) | covered | |
| REQ-23 | `type` of `url` | pitch.gate.md §The three pieces (split 5/6) | covered | |
| REQ-24 | and `enum` | pitch.gate.md §The three pieces (split 6/6) | covered | |
| REQ-25 | Pure: data in, findings out | pitch.gate.md §The three pieces (Rules) | covered | |
| REQ-26 | The CLI — argument handling, reading the two files, printing findings, exit codes | pitch.gate.md §The three pieces | covered | |
| REQ-27 | Parsing and Rules share nothing: neither imports the other | pitch.gate.md §The three pieces | covered | |
| REQ-28 | `envlint` never writes a `.env` file | pitch.gate.md §Boundaries | covered | |
| REQ-29 | never interpolates `${VAR}` references | pitch.gate.md §Boundaries | covered | |
| REQ-30 | has no dotenv-compatible loading | pitch.gate.md §Boundaries | covered | |
| REQ-31 | Its output has no colors, no TUI and no interactive prompts | pitch.gate.md §Boundaries | covered | |
| REQ-32 | It makes no network access, ever | pitch.gate.md §Boundaries | covered | |
| REQ-33 | the `url` type validates the shape of the string only | pitch.gate.md §Boundaries | covered | |
