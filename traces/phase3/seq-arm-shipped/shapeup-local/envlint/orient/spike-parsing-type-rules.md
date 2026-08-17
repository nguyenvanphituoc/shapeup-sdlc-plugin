# Spike — parsing & type-validation edge cases (riskiest area)

## Why this area is riskiest

The pitch and EXPECTED.md put the most exacting, easy-to-get-subtly-wrong behavior in two
places: (1) quote-stripping during line parsing (an unterminated quote must NOT be stripped),
and (2) the `int`/`bool`/`url` type-check semantics at their edges (`01`, `1.5`, `1e3`, empty
string; `http://` with no host; case-insensitive bool). Getting either wrong silently produces
wrong findings rather than a crash, so it would pass a shallow smoke test and only surface under
targeted edge-case tests — exactly the E1-E5 + "Type rules" + "Parsing rules" sections of
EXPECTED.md. This is the one place worth spending spike budget before any board exists.

## What was spiked (throwaway Node, not committed)

Ran ad-hoc snippets (via `node -e`) against the exact rules in EXPECTED.md:

**Type regexes**
- `int` regex `/^-?\d+$/`: confirmed `"01"` → true, `"1.5"` → false, `"1e3"` → false,
  `""` → false, `"-5"` → true — matches spec exactly.
- `bool` regex `/^(true|false|1|0)$/i`: confirmed case-insensitivity (`"FALSE"` → true) and
  rejects `"yes"`.
- `url` via `new URL(value)` then checking `.protocol` is `http:`/`https:`: confirmed
  `"http://a.com"` and `"https://a.com"` parse with the right protocol, `"ftp://a.com"` parses
  but has the wrong protocol (must be rejected by an explicit protocol check, not just
  try/catch), and `"not a url"` / `"http://"` both throw — so the rule needs both a try/catch
  AND a protocol allow-list check, not either alone.

**Quote-stripping**
- Line-parse regex `/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/` correctly
  separates `KEY`/`export KEY` from the raw value and trims outer whitespace.
- Confirmed the matching-pair-only rule from EXPECTED.md: `KEY="value"` (both quotes present,
  length >= 2) strips to `value`; `KEY="value` (only a leading quote) is left untouched as
  `"value` (leading quote kept) — matches "keeps the leading quote — it is not a matching pair"
  verbatim.
- Confirmed whitespace trimming around key and value works with the same regex
  (`"  SPACED  =  hi  "` → key `SPACED`, val `hi`).

## Conclusion / risk resolved

The regex-and-URL-based approach for parsing lines and validating types is sufficient to satisfy
every case enumerated in EXPECTED.md's "Type rules" and "Parsing rules" sections, including the
two trickiest ones (unterminated quotes, `url` protocol allow-listing). No architectural
surprises found; this de-risks the build — the coming task board can spec `lib/parse.*` and
`lib/rules.*` against these exact regex/URL behaviors without further exploratory spiking.

## Remaining unknowns (not spiked, left for the board / build round)

- Exact truncation behavior for E4's "line text truncated to 30 chars" (byte vs. char truncation,
  whether truncation adds an ellipsis) — EXPECTED.md doesn't specify, needs a task-level decision.
- `--json` output key order / whether `checked` counts only schema keys or all pairs — needs a
  fixture-driven task, not a spike.
- Multi-flag argv ordering (`--json` before/after `--schema`, envfile position) is unspecified by
  EXPECTED.md beyond the one example invocation shape — low risk, ordinary CLI arg parsing.
