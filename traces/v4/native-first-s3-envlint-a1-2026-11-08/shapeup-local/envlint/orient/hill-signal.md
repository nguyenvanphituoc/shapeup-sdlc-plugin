# Hill signal (raw facts)

| Area | Open unknowns |
|---|---|
| parsing | Escape handling inside quotes; inline `#` comment after a value; duplicate keys; problem object shape. |
| rules | `url` protocol policy (`a:b`, `mailto:` accepted by `new URL`); accepted `bool`/`int` spellings; finding object shape. |
| CLI | Exit-code values (findings vs. usage vs. IO error); output line format; arg-error behaviour. |

No spike run (SPIKE-NOT-NEEDED): no area has an unproven seam; the `url` probe is resolved. All unknowns are spec decisions, not technical risk.
