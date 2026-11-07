# Hunt Report — envlint (round 1, 2026-11-07)
charters: 0/0 · session units spent: 0
status: not-hunted (deliverable not reached)

## Q0 Preflight
The deliverable is a CLI (`bin/envlint.mjs`). The order carries no `app_url` and no `launch_cmd`. The round build gate ran `node --test "test/*.test.mjs"` (39/39 pass) and did not launch the CLI.
In this session the only permitted Bash shape is the kernel command, so the CLI could not be invoked. Reading code is not a hunt (rule 7: every finding needs a live repro). No charters were run and no findings are recorded.

## Findings by lens
None. Nothing was hunted.

## Session notes
Re-run the hunt in a session that allows `node bin/envlint.mjs ...` to cover lenses 1 (long or odd env lines, unicode, NUL), 3 (unreadable or missing files), 4 (schema output fed back as env input) and 5 (the no-interpolation, no-write and no-.env-read no-gos).
