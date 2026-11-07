# Hill signal — envlint

- parsing: open unknowns — quote/escape edge semantics (`#` inside quotes, inline trailing comments, empty value); pair shape carrying `line`. Approach otherwise known; no spike.
- rules: open unknowns — whether schema keys beyond required/type/enum are rejected; accepted lexical forms for int/bool; line attribution for missing keys.
- cli: open unknowns — exit-code contract (findings vs IO/usage error); findings output format; both depend on the parse/rules data shape.

Spike: not needed (rank 0). No area is blocked on a code unknown.
