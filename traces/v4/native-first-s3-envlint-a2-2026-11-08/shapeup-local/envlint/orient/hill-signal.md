# Hill signal — open unknowns per area (raw facts, not a report)

| Area | Open unknowns | Spike status |
|------|---------------|--------------|
| parsing | Inline trailing `# comment`; escapes in double quotes; duplicate keys; whitespace around `=`; what counts as "cannot parse" (no `=`, empty key, bad key chars, unterminated quote); multiline values in or out | not spiked; no code exists; unknowns are spec decisions |
| rules | `url` definition (RESOLVED: needs explicit `scheme://host`; accepted schemes TBD); bool spellings; int syntax; empty value vs missing for `required`; keys not in schema; findings shape; unknown `type` name in schema | url resolved, rest spec decisions |
| cli | Exit-code scheme; output format (no color); stdout vs stderr for usage errors; unreadable vs invalid-JSON schema handling | arg parsing behaviour proven; rest spec decisions |
| shared contract | `pairs` shape passed from parse to rules (neither imports the other) | open, must be fixed in the spec |

Summary: no uphill technical risk; three independent greenfield areas, spike at crest. Remaining unknowns are specification choices for ba.
