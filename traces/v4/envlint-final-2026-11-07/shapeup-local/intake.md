# Raw idea — `envlint`

A tiny command-line validator for `.env` files, deliberately shaped so the work splits into
**independent pieces that can be built at the same time**. Two of its three parts are pure
functions that share no file with each other; only the third touches both.

## The pitch (one paragraph)

A `.env` file is the one config file nobody validates, so a typo in it becomes a production
incident. Give developers `envlint`: point it at a `.env` file and a small JSON schema describing
which keys are required and what shape each value must have, and it tells them exactly what is
wrong — key by key, line by line — and exits non-zero so CI can fail on it. It must behave sanely
at the edges: a missing file, an unreadable schema, a file with no assignments at all. A linter
that crashes on a malformed input is worse than no linter.

**The env file and the schema file are both passed as arguments** — `envlint --schema <schema.json>
<envfile>` — with no implicit lookup of the developer's own `.env`. This is a real constraint, not
a detail: it is the only way a test can point the tool at a throwaway fixture, and every edge case
above can only be exercised by files a test wrote. A harness run is graded by driving this binary,
so a linter that cannot be pointed at a fixture cannot be verified.

## The three pieces

- **Parsing** — turn `.env` text into key/value pairs. Handles `KEY=value`, `#` comments, blank
  lines, `export KEY=value`, single- and double-quoted values, and reports the 1-based line number
  of anything it cannot parse. Pure: text in, `{pairs, problems}` out.
- **Rules** — given parsed pairs and a schema, decide what is wrong. Supports `required`, and
  `type` of `string` / `int` / `bool` / `url`, and `enum`. Pure: data in, findings out.
- **The CLI** — argument handling, reading the two files, printing findings, exit codes.

Parsing and Rules share nothing: neither imports the other, and each is verifiable alone against
its own fixtures. Only the CLI depends on both.

## Appetite

Small batch — a single build round.

## No-gos

- No `.env` writing, no interpolation of `${VAR}` references, no dotenv-compatible loading.
- No colors, no TUI, no interactive prompts (keep output assertable).
- No network access, ever — a `url` type check validates the shape of the string only.
