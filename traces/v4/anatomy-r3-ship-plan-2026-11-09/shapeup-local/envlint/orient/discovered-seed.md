# Discovered seed (raw material; no ids, order or deps)

0 Discovered tasks: there is no code to cite, so everything below is Imagined.

## Suspected scope: parsing
- Imagined: parse `KEY=value`, `export KEY=value`, comments, blank lines.
- Imagined: single/double-quoted values; unterminated quote reported as a problem.
- Imagined: 1-based line number for each unparseable line; CRLF tolerance; empty input yields empty pairs, no crash.
- Imagined: unit tests with fixtures.

## Suspected scope: rules
- Imagined: `required` missing-key finding.
- Imagined: `type` string/int/bool/url validation (url is shape only, no network).
- Imagined: `enum` membership; handling of keys absent from the schema.
- Imagined: malformed-schema handling; unit tests.

## Suspected scope: cli
- Imagined: argument handling `--schema <file> <envfile>`; no implicit `.env` lookup; usage error on missing args.
- Imagined: missing env file, unreadable/invalid-JSON schema, file with no assignments: clean message, non-zero exit, no stack trace.
- Imagined: print findings (line-oriented, no color); non-zero exit on findings, zero when clean.
- Imagined: end-to-end tests writing throwaway fixtures and spawning the binary.
- Imagined: never writes `.env`, no `${VAR}` interpolation.
