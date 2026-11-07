# Hill signal — personal-site (raw open unknowns per area)

## Build CLI (input → validate → write)
- Do `$CONTENT_FILE` / `$OUT_DIR` resolve against cwd or against the script's directory? The pitch does not say.
- Should a missing `$OUT_DIR` be created? The default `dist/` has to be created, since it is absent on checkout.
- On an error run, is a stale `dist/index.html` from an earlier successful run left alone or removed? "Does not write" is clear; "removes" is not stated.
- Which fields are required beyond `name`? Is an empty-string or whitespace `name` "missing"? What happens on non-object JSON (array, null)?
- What exactly is the "one error line" format? Only "names the problem" is specified.

## Page rendering
- Does a `javascript:` URL in a project `url` violate "the generated page contains no JavaScript"? Should non-http(s) schemes be rejected or rendered as plain text?
- Escaping inside attribute values (`href`, `mailto:`) as well as text nodes. Is an email containing special characters URL-encoded or only HTML-escaped?
- `projects` absent, not an array, or an item missing `title`/`summary` is undefined behaviour.
- `contact` / `contact.email` absent: omit the Contact section, or treat it as an error?
- An empty-string `url` counts as "no url"? Probably yes, per "never an empty href", but that is unconfirmed.

## Verification suite
- Spike resolved: the discovery rules are known (dot-dirs skipped, `test/**/*.mjs` all run, zero tests = exit 0).
- Open: the gate cannot tell "no tests" from "tests pass". Planning has to decide between an explicit test path and a test-count check.
