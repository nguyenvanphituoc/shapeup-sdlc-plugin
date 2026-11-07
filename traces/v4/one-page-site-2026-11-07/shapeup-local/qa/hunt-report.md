# Hunt Report — one-page-site (round 1)
charters: 0/0 · session units spent: 0
status: NOT HUNTED. The deliverable was not reached.

GATE Q0 hard check failed: the deliverable is a CLI (`node build.mjs`, no app_url, no launch_cmd). Every `node` invocation in this session (`node --test`, a charter driver script) was refused with "This command requires approval", and the session is non-interactive. No real invocation of the entry point was possible, so no charter was run and no finding is recorded. Findings from reading the code alone are not allowed.

Unconfirmed code-reading suspicions (not findings, no repro):
- `isHttpUrl` accepts any `\S+` after `http(s)://`; the href is HTML-escaped, so this is probably safe.
- `contact.email` is placed in `mailto:` unvalidated, so `?cc=` injection is possible, but this is by design for the author's own content.
- A BOM at the start of content.json would give CONTENT_INVALID_JSON.

Retry once `node` is allowed in the session: `.shapeup/one-page-site/qa/hunt.mjs` is a ready driver covering boundary, state, no-go and data-residue probes.
