# Discovered seed — one-page-site

- Open question: `javascript:` / unsafe URL schemes in project `url` (pitch silent).
- Open question: missing `contact` or `contact.email` behaviour (pitch silent).
- Open question: missing optional `tagline`/`about` (omit element vs empty).
- Invariant candidate: output contains exactly one `<h1>`; no `<script>` in the page.
- Invariant candidate: `content.json` is never modified by a build.
- Test note: failure tests need a fresh `$OUT_DIR` to prove nothing is written.
