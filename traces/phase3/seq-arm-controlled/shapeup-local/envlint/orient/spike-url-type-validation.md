# Spike — `url` type validation via `new URL()`

## Why this is the riskiest area

Every other rule in EXPECTED.md is a simple, self-contained regex or exact-match check the
author can eyeball for correctness. The `url` type check is the one rule whose correctness
depends on a built-in's actual runtime behavior (`new URL()`'s parsing leniency), which is easy
to get subtly wrong — either by trusting `new URL()` too much (accepting strings a human would
call malformed) or by hand-rolling a regex that's wrong in a different way. Getting this wrong
fails a Test Surface row silently rather than throwing, so it is the highest-value thing to
verify before any board/tasks are written.

## What was spiked

Ran `new URL(v)` against a battery of inputs in a throwaway Node REPL snippet (no files touched
outside `.shapeup/envlint/orient/`), checking both success/failure and the resulting protocol:

```
"http://x.com"        -> http:                (valid, expected pass)
"https://x.com"        -> https:               (valid, expected pass)
"ftp://x.com"          -> ftp:                 (parses OK, but wrong protocol -- rule must also
                                                 gate on protocol, not just "does it parse")
"notaurl"              -> throws Invalid URL   (correctly rejected)
"http://"              -> throws Invalid URL   (correctly rejected, no host)
"https:// x.com"       -> throws Invalid URL   (embedded space rejected)
"http:/x.com"          -> parses as http:      (single slash still accepted -- WHATWG leniency;
                                                 must NOT be special-cased as invalid, spec text
                                                 only requires "parses with new URL() AND protocol
                                                 is http:/https:", so this is correctly a pass)
""                     -> throws Invalid URL   (empty value correctly rejected)
"   http://x.com  "    -> parses as http:      (new URL() trims ASCII whitespace itself; moot in
                                                 practice since the parser already trims value
                                                 whitespace outside quotes per EXPECTED.md)
```

## Finding

`new URL(v)` wrapped in try/catch, followed by a `protocol === 'http:' || protocol === 'https:'`
check, exactly matches EXPECTED.md's rule ("parses with `new URL()` **and** has protocol `http:`
or `https:`") with no extra logic needed. The two things a naive implementation could get wrong
are:

1. Forgetting the protocol gate and accepting any URL scheme (`ftp:`, `mailto:`, `data:`) that
   happens to parse — `new URL()` alone is not sufficient, confirmed above with `ftp://x.com`.
2. Trying to "improve" on `new URL()`'s leniency (e.g. rejecting `http:/x.com` because it "looks
   malformed") — this would silently over-reject inputs the spec's literal wording accepts. The
   implementation should trust `new URL()` as-is and only gate on protocol.

## Also spiked: `int`/`bool` regex and quote-stripping (secondary, lower risk)

Confirmed against EXPECTED.md's stated edge cases in the same session:
- `/^-?\d+$/` correctly accepts `01`, `-5`; correctly rejects `1.5`, `1e3`, `""`, `"5-"`, `"+5"`.
- `/^(true|false|1|0)$/i` correctly accepts `TRUE`, `False`, `1`, `0`; rejects `yes`, `2`.
- A plain first-char/last-char match (`v[0]==='"' && v[last]==='"'`, same for `'`) correctly
  strips `"value"` and `'value'`, and correctly leaves `"value` (no closing quote) and `value"`
  (no opening quote) untouched — matching EXPECTED.md's explicit "not a matching pair" case
  without needing a stateful tokenizer.

These carry less risk than the URL check because they are pure regex/string-slice logic with no
platform-behavior dependency, but confirming them here removes any ambiguity before scoping.

## Scope/task implication

No production code was written. This confirms the `url` type rule is a two-line check
(try/catch + protocol allow-list) rather than something needing a custom parser, and it should
be called out explicitly in the Rules engine's task/AC so the protocol-gate requirement isn't
dropped by an implementation that just does `try { new URL(v); return true } catch { return
false }`.
