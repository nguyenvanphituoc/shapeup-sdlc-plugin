# Hill signal — envlint (raw facts, not a report)

| Area | Open unknowns | Spike status |
|---|---|---|
| Parsing | pair shape (needs `line`); quoting, inline-comment and escape rules; duplicate keys; `=`-less lines | Resolved to a recommendation; spec must confirm |
| Rules | `int`/`bool`/`url` literal grammars; empty value vs `required`; unknown schema `type`; env keys not in schema | Resolved to a recommendation; spec must confirm |
| CLI | exit-code table; output line format; whether parse problems alone fail; zero-assignment handling | Not spiked; derivable from the pitch, needs wording |
| Parsing-to-Rules contract | the shared shape both sides build against concurrently | Spiked; the one point that can break a parallel build |
| Test layout | `node --test` discovery of `test/` (docs only, unverified) | Low risk |

Summary: no area involves an unproven external seam; every unknown is a specification decision. Greenfield, 0 existing files, small-batch appetite.
