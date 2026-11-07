# Discovered seed

- D1 Non-object JSON (`[]`, `null`) and blank or non-string `name` are treated as missing field: exit 1, one stderr line, no dist.
- D2 Absent `projects` is zero projects; empty-string `url` is no url.
- D3 Absent optional fields (tagline, about, contact) must not render "undefined" or empty links; the pitch is silent.
- D4 Parser error messages can be multi-line: collapse to one stderr line.
- D5 Unsafe URL schemes (`javascript:`) in `url` are not addressed by the pitch (PO decision or candidate cut).
- D6 `dist/` should be gitignored; a valid `content.json` must exist for the build probe.
- D7 Byte-identical output: the test should run twice and compare buffers.
