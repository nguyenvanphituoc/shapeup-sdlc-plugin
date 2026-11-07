# Spike — escaping, failure paths, determinism (desk-checked; the sandbox refused running a throwaway script)

Riskiest area: the edge behaviours the pitch makes binding.

1. Escape `& < > " '` through one helper, `&` first, on every interpolated string including attribute values (`href`, `mailto:`). `<b>Rock & Roll</b>` becomes `&lt;b&gt;Rock &amp; Roll&lt;/b&gt;`.
2. `url` is escaped but not scheme-filtered by the pitch; a `javascript:` URL would render as a link. Out of pitch scope; flagged in the seed.
3. Failure paths: JSON.parse throws on bad content; ENOENT on missing. Valid JSON that is not an object (`[]`, `null`, `"x"`) and a non-string or blank `name` must also exit 1. Validate fully before any mkdir/write so nothing is written. Stderr must be one line: collapse newlines in parser messages.
4. Determinism: no timestamps, no key-order dependence; iterate arrays only; fixed trailing newline.
5. Optional fields (`tagline`, `about`, `contact`, project `summary`) are unspecified when absent; never print `undefined`. Absent `projects` equals empty (coming-soon sentence). Empty-string `url` counts as no url.
6. `$OUT_DIR` may not exist: mkdir recursive. Exactly one `<h1>`; project titles must not be h1.

Verdict: low technical risk; the work is spec precision. No blocking unknowns.
