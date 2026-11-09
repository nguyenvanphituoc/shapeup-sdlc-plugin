# Hill signal (facts only)

- parsing: open unknowns: quoted-value escape rules; inline `#` comments after values; duplicate key policy; CRLF. Pure and well understood.
- rules: open unknowns: schema JSON shape; accepted `int`/`bool` literals; `url` shape definition; keys not in schema; how findings carry line numbers (pairs must carry line).
- cli: open unknowns: exit-code map (findings vs usage vs I/O error); output format; interface contract between parse output and rules input; depends on both pieces.
- Spike: SPIKE-NOT-NEEDED. Nothing technically uphill; the unknowns are specification choices.
