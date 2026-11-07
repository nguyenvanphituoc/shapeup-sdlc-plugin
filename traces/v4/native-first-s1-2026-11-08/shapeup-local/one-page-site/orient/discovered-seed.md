# Discovered seed

- D-1: The pitch is silent when `contact`/`contact.email`, `tagline` or `about` is absent (only `name` is required). Decide: omit the element, never print "undefined".
- D-2: A non-array `projects` or a project without `title` is unspecified; treat non-array as empty.
- D-3: Escape attribute values (url, email) as well as text; no URL scheme filtering is specified.
- D-4: Tests need temp dirs via `CONTENT_FILE`/`OUT_DIR`; `node --test` discovers any `*.test.mjs` at the root.
