# Requirements — envlint

Atomic customer clauses extracted from the pitch `pitch.gate.md` (repo root). Ids are frozen: append new
clauses with fresh ids, mark removed ones `CUT (PO-approved)`, never renumber.

| REQ-id | clause (verbatim) | source | status | note |
|---|---|---|---|---|
| REQ-1 | point it at a `.env` file and a small JSON schema describing which keys are required and what shape each value must have | pitch.gate.md §The pitch ¶1 (split 1/4) | covered | |
| REQ-2 | it tells them exactly what is wrong — key by key, line by line | pitch.gate.md §The pitch ¶1 (split 2/4) | covered | |
| REQ-3 | exits non-zero so CI can fail on it | pitch.gate.md §The pitch ¶1 (split 3/4) | covered | |
| REQ-4 | It must behave sanely at the edges: a missing file | pitch.gate.md §The pitch ¶1 (split 4/4, edge 1/3) | covered | |
| REQ-5 | It must behave sanely at the edges: an unreadable schema | pitch.gate.md §The pitch ¶1 (edge 2/3) | covered | |
| REQ-6 | It must behave sanely at the edges: a file with no assignments at all | pitch.gate.md §The pitch ¶1 (edge 3/3) | covered | |
| REQ-7 | A linter that crashes on a malformed input is worse than no linter | pitch.gate.md §The pitch ¶1 | covered | no uncaught exception / stack trace on any input |
| REQ-8 | The env file and the schema file are both passed as arguments — `envlint --schema <schema.json> <envfile>` | pitch.gate.md §The pitch ¶2 (split 1/2) | covered | |
| REQ-9 | with no implicit lookup of the developer's own `.env` | pitch.gate.md §The pitch ¶2 (split 2/2) | covered | |
| REQ-10 | Parsing — turn `.env` text into key/value pairs | pitch.gate.md §The three pieces, Parsing (split 1/8) | covered | |
| REQ-11 | Handles `KEY=value` | pitch.gate.md §The three pieces, Parsing (split 2/8) | covered | |
| REQ-12 | Handles `#` comments | pitch.gate.md §The three pieces, Parsing (split 3/8) | covered | |
| REQ-13 | Handles blank lines | pitch.gate.md §The three pieces, Parsing (split 4/8) | covered | |
| REQ-14 | Handles `export KEY=value` | pitch.gate.md §The three pieces, Parsing (split 5/8) | covered | |
| REQ-15 | Handles single- and double-quoted values | pitch.gate.md §The three pieces, Parsing (split 6/8) | covered | |
| REQ-16 | reports the 1-based line number of anything it cannot parse | pitch.gate.md §The three pieces, Parsing (split 7/8) | covered | |
| REQ-17 | Pure: text in, `{pairs, problems}` out | pitch.gate.md §The three pieces, Parsing (split 8/8) | covered | |
| REQ-18 | Rules — given parsed pairs and a schema, decide what is wrong | pitch.gate.md §The three pieces, Rules (split 1/5) | covered | |
| REQ-19 | Supports `required` | pitch.gate.md §The three pieces, Rules (split 2/5) | covered | |
| REQ-20 | Supports `type` of `string` / `int` / `bool` / `url` | pitch.gate.md §The three pieces, Rules (split 3/5) | covered | |
| REQ-21 | Supports `enum` | pitch.gate.md §The three pieces, Rules (split 4/5) | covered | |
| REQ-22 | Pure: data in, findings out | pitch.gate.md §The three pieces, Rules (split 5/5) | covered | |
| REQ-23 | The CLI — argument handling, reading the two files, printing findings, exit codes | pitch.gate.md §The three pieces, The CLI | covered | |
| REQ-24 | Parsing and Rules share nothing: neither imports the other | pitch.gate.md §The three pieces ¶2 (split 1/2) | covered | |
| REQ-25 | each is verifiable alone against its own fixtures | pitch.gate.md §The three pieces ¶2 (split 2/2) | covered | |
| REQ-26 | `envlint` never writes a `.env` file | pitch.gate.md §Boundaries (split 1/6) | covered | |
| REQ-27 | never interpolates `${VAR}` references | pitch.gate.md §Boundaries (split 2/6) | covered | |
| REQ-28 | has no dotenv-compatible loading | pitch.gate.md §Boundaries (split 3/6) | covered | |
| REQ-29 | Its output has no colors, no TUI and no interactive prompts, so it can be asserted on | pitch.gate.md §Boundaries (split 4/6) | covered | |
| REQ-30 | It makes no network access, ever | pitch.gate.md §Boundaries (split 5/6) | covered | |
| REQ-31 | the `url` type validates the shape of the string only | pitch.gate.md §Boundaries (split 6/6) | covered | |
