---
description: Write the wiring map — engine → seam → entry-point call site, per use case
---
Use the **solution-architect** skill (operation `wire`) on $ARGUMENTS.

This is gate L1a.5 — it front-loads the integration seam so no engine ships orphaned. The skill
is the sole writer of the committed `wiring-map.md`, resolved against `project-profile.md`'s
`entry_point`; `harness verify trace` later checks reachability against it.

It needs the spec folder (for the use cases) and the project profile. If either is missing, say
which one rather than inventing it.
