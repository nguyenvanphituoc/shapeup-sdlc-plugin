# Requirements — envlint

Extracted from the committed pitch `pitch.gate.md` (no R-ids in the source; numbered from REQ-1). Ids are frozen.

| REQ-id | clause (verbatim) | source | status | note |
|---|---|---|---|---|
| REQ-1 | point it at a `.env` file and a small JSON schema describing which keys are required and what shape each value must have, and it tells them exactly what is wrong — key by key, line by line | pitch.gate.md §The pitch | covered | |
| REQ-2 | exits non-zero so CI can fail on it | pitch.gate.md §The pitch | covered | |
| REQ-3 | It must behave sanely at the edges: a missing file | pitch.gate.md §The pitch (split 1/3) | covered | |
| REQ-4 | It must behave sanely at the edges: an unreadable schema | pitch.gate.md §The pitch (split 2/3) | covered | |
| REQ-5 | It must behave sanely at the edges: a file with no assignments at all | pitch.gate.md §The pitch (split 3/3) | covered | |
| REQ-6 | A linter that crashes on a malformed input is worse than no linter. | pitch.gate.md §The pitch | covered | |
| REQ-7 | The env file and the schema file are both passed as arguments — `envlint --schema <schema.json> <envfile>` | pitch.gate.md §The pitch | covered | |
| REQ-8 | with no implicit lookup of the developer's own `.env` | pitch.gate.md §The pitch | covered | |
| REQ-9 | Parsing — turn `.env` text into key/value pairs. Handles `KEY=value` | pitch.gate.md §The three pieces — Parsing (split 1/7) | covered | |
| REQ-10 | Handles `#` comments | pitch.gate.md §The three pieces — Parsing (split 2/7) | covered | |
| REQ-11 | Handles blank lines | pitch.gate.md §The three pieces — Parsing (split 3/7) | covered | |
| REQ-12 | Handles `export KEY=value` | pitch.gate.md §The three pieces — Parsing (split 4/7) | covered | |
| REQ-13 | Handles single- and double-quoted values | pitch.gate.md §The three pieces — Parsing (split 5/7) | covered | |
| REQ-14 | reports the 1-based line number of anything it cannot parse | pitch.gate.md §The three pieces — Parsing (split 6/7) | covered | |
| REQ-15 | Pure: text in, `{pairs, problems}` out. | pitch.gate.md §The three pieces — Parsing (split 7/7) | covered | |
| REQ-16 | Rules — given parsed pairs and a schema, decide what is wrong. Supports `required` | pitch.gate.md §The three pieces — Rules (split 1/4) | covered | |
| REQ-17 | `type` of `string` / `int` / `bool` / `url` | pitch.gate.md §The three pieces — Rules (split 2/4) | covered | |
| REQ-18 | and `enum` | pitch.gate.md §The three pieces — Rules (split 3/4) | covered | |
| REQ-19 | Pure: data in, findings out. | pitch.gate.md §The three pieces — Rules (split 4/4) | covered | |
| REQ-20 | The CLI — argument handling, reading the two files, printing findings, exit codes. | pitch.gate.md §The three pieces — The CLI | covered | |
| REQ-21 | Parsing and Rules share nothing: neither imports the other, and each is verifiable alone against its own fixtures. | pitch.gate.md §The three pieces | covered | |
| REQ-22 | `envlint` never writes a `.env` file | pitch.gate.md §Boundaries (split 1/4) | covered | |
| REQ-23 | never interpolates `${VAR}` references and has no dotenv-compatible loading | pitch.gate.md §Boundaries (split 2/4) | covered | |
| REQ-24 | Its output has no colors, no TUI and no interactive prompts, so it can be asserted on. | pitch.gate.md §Boundaries (split 3/4) | covered | |
| REQ-25 | It makes no network access, ever; the `url` type validates the shape of the string only. | pitch.gate.md §Boundaries (split 4/4) | covered | |
