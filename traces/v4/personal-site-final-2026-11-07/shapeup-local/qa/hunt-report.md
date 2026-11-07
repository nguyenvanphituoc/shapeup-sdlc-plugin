# Hunt Report — personal-site (round 1, 2026-11-07)
charters: 0/0 · session units spent: 0
status: NOT HUNTED (deliverable not reached)

The deliverable is the entry point `node build.mjs`. Every attempt to execute it in this session
(the profile build_probe `node build.mjs`, and a driver script running it under CONTENT_FILE/OUT_DIR
overrides) was refused with "This command requires approval" in a non-interactive session.
No invocation reached the deliverable, so no charter was run and no finding is recorded
(every finding needs a live repro). The build gate artifact (build/r1-t1.json, green, exit 0) is the
round gate's evidence, not this hunt's.

Candidate scents for a future hunt (unconfirmed, from code reading only, NOT findings):
- url with a `javascript:` scheme is escaped but not scheme-filtered (lens 1/5)
- `projects` non-array or null entries, `contact` as a string, whitespace-only name (lens 1)
- OUT_DIR / CONTENT_FILE pointing at a directory or a file (lens 3)

## Findings by lens
none (not hunted)
