---
feature: personal-site
---
# Discovery Ledger — personal-site

## Discovered — personal-site/site-build-r1-a1 (2026-11-07)
+ contact.email or any text field containing the literal string javascript: (e.g. about text) is escaped but still appears verbatim in the page; INV-01 only scopes url schemes, so the no-javascript: grep over the whole output could be tripped by plain text content
+ contact.email is not scheme-checked or validated as an address; any string becomes mailto:<escaped string>
