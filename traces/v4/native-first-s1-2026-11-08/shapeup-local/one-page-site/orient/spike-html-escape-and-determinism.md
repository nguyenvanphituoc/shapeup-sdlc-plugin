# Spike - escaping, edge branches, determinism (riskiest area)

Risk: the pitch's edge behaviors are many small branches in one renderer. Escaping is easy to miss on attribute values (href, mailto), and a failed build must not write dist output.

Findings (reasoned from the pitch; no code exists to run):
- Escape `& < > " '` through one helper applied to every interpolated value, including href and mailto attributes. `<b>Rock & Roll</b>` must render as `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`.
- Validate fully (parse, `name` check) before any filesystem write; do not mkdir `OUT_DIR` first, so error paths leave no output.
- Missing or unparseable file, or missing `name`: one stderr line, exit code 1.
- Missing or empty `url`: plain-text title. No projects: "Projects are coming soon." and no `<ul>`.
- Determinism: no timestamps or randomness, stable ordering, explicit utf8 write.
- Never write `content.json`; no `<script>`; no network calls. Tests should assert no `<script` and exactly one `<h1>`.
- `<title>` is the escaped name.

Open question: behavior when `contact.email`, `tagline` or `about` is absent is unspecified.
