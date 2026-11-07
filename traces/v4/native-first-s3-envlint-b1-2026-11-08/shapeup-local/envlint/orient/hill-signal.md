# Hill signal — envlint

Raw per-area unknowns. These are facts only; the loop decides where each dot goes.

## parsing
- OPEN: quote semantics. Escapes inside `"..."`, unterminated quotes and multiline values are not
  specified.
- OPEN: inline `#` after an unquoted value (comment, or part of the value?).
- OPEN: CRLF handling and duplicate-key behaviour.
- OPEN (shared with rules): the pair shape, specifically whether each pair carries `line`.
- PROVEN: none. There is no code; the approach is conventional with no external seam.

## rules
- OPEN: schema JSON structure (per-key object vs top-level `required` list).
- OPEN: accepted `bool` spellings; `int` sign and leading zeros.
- OPEN: whether `url` requires a scheme. The approach (global `URL`, no network) is known to exist
  in Node v24.15.0 but was not spiked.
- OPEN (shared with parsing): the input pair shape.

## cli
- PROVEN (spike RESOLVED): subprocess-driven `node --test` against tmpdir fixtures works; `parseArgs`
  strict mode plus manual positional/`--schema` checks covers argv errors; ENOENT, EISDIR and JSON
  SyntaxError are each distinguishable.
- OPEN: exit-code table (findings vs usage/IO error) and the finding output line format.
- OPEN: owner of "schema parses but has the wrong shape" (CLI or rules).
- OPEN: whether an env file with no assignments passes against a schema with no `required` keys.

## cross-cutting
- FACT: `node --test` with zero tests exits 0, so an empty suite is green.
- FACT: `build_probe` is red on baseline (`bin/envlint.mjs` absent) until the CLI scope lands.
- FACT: no `launch_probe` in the profile (archetype `library`).

Summary: one area proven by spike (cli harness); parsing and rules are uphill only on unspecified
semantics, not on technical risk.
