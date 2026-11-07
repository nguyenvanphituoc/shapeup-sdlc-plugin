# Requirements registry — envlint

Source: the committed pitch `pitch.md` (no R-ids in the source; ids assigned once from REQ-1 and frozen).

| REQ-id | clause (verbatim) | source | status | note |
|---|---|---|---|---|
| REQ-1 | point it at a `.env` file and a small JSON schema describing which keys are required and what shape each value must have | pitch.md — The pitch (split 1/4) | covered | |
| REQ-2 | it tells them exactly what is wrong — key by key, line by line | pitch.md — The pitch (split 2/4) | covered | |
| REQ-3 | exits non-zero so CI can fail on it | pitch.md — The pitch (split 3/4) | covered | |
| REQ-4 | It must behave sanely at the edges: a missing file | pitch.md — The pitch (split 4/4, edge 1/3) | covered | |
| REQ-5 | It must behave sanely at the edges: an unreadable schema | pitch.md — The pitch (edge 2/3) | covered | |
| REQ-6 | It must behave sanely at the edges: a file with no assignments at all | pitch.md — The pitch (edge 3/3) | covered | |
| REQ-7 | A linter that crashes on a malformed input is worse than no linter. | pitch.md — The pitch | covered | |
| REQ-8 | The env file and the schema file are both passed as arguments — `envlint --schema <schema.json> <envfile>` | pitch.md — arguments paragraph (split 1/2) | covered | |
| REQ-9 | with no implicit lookup of the developer's own `.env` | pitch.md — arguments paragraph (split 2/2) | covered | |
| REQ-10 | Parsing — turn `.env` text into key/value pairs. Handles `KEY=value` | pitch.md — The three pieces / Parsing (split 1/7) | covered | |
| REQ-11 | Handles `#` comments | pitch.md — Parsing (split 2/7) | covered | |
| REQ-12 | Handles blank lines | pitch.md — Parsing (split 3/7) | covered | |
| REQ-13 | Handles `export KEY=value` | pitch.md — Parsing (split 4/7) | covered | |
| REQ-14 | Handles single- and double-quoted values | pitch.md — Parsing (split 5/7) | covered | |
| REQ-15 | reports the 1-based line number of anything it cannot parse | pitch.md — Parsing (split 6/7) | covered | |
| REQ-16 | Pure: text in, `{pairs, problems}` out. | pitch.md — Parsing (split 7/7) | covered | |
| REQ-17 | Rules — given parsed pairs and a schema, decide what is wrong. Supports `required` | pitch.md — The three pieces / Rules (split 1/4) | covered | |
| REQ-18 | Supports `type` of `string` / `int` / `bool` / `url` | pitch.md — Rules (split 2/4) | covered | |
| REQ-19 | Supports `enum` | pitch.md — Rules (split 3/4) | covered | |
| REQ-20 | Pure: data in, findings out. | pitch.md — Rules (split 4/4) | covered | |
| REQ-21 | The CLI — argument handling, reading the two files, printing findings, exit codes. | pitch.md — The three pieces / The CLI | covered | |
| REQ-22 | Parsing and Rules share nothing: neither imports the other, and each is verifiable alone against its own fixtures. | pitch.md — The three pieces | covered | |

The pitch's No-gos (no `.env` writing, no `${VAR}` interpolation, no dotenv-compatible loading) are not
registered as requirements: each is graded as a breach probe (`TS-NOGO-NN`) on the use case it touches.
