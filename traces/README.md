# `traces/` — archived run traces

Committed evidence from runs of the harness against a real feature. Each subdirectory is one run:
the LOCAL run trace (`shapeup-local/`), the committed contracts it produced (`shapeup-committed/`),
the deliverable the workers actually wrote (`deliverable/`), and a machine-readable `SUMMARY.json`.

**Why these are not under `docs/`.** The doc-drift check reads every `.md` under `docs/` and fails on
any cited path that is not on disk. That is right for living documentation and wrong for a trace: a
trace records what was true during one run of a *different* project, so the paths it names — that
run's own spec tree, the source files it built — are supposed to be absent from this repo. The suite
already carves out this category for changelogs, with the same reasoning: they record what was true
at a point in time, so a path they name is *supposed* to stop existing.

**These are records, not documentation.** Nothing here is maintained. A trace is never edited to stay
current; if it stops matching the repo, that is the trace doing its job.

**No derived artifact lives here any more.** This folder used to carry one: a frozen
`CONCURRENCY-BASELINE.json`, the output of `harness probe concurrency` over each trace, which the
structural suite re-derived and failed on any difference. The probe that produced it is deleted, so
the artifact is retired with it rather than left as a projection nothing can verify — a stale
baseline that still reads as measured is worse than none. Its `d3` slot was empty by design (no
archived run was executed sequentially), so no comparison number is lost. A later fan-out measurement
starts from the archived `legs.jsonl` and `receipts/dispatch.jsonl` of these traces, which stay.

**They do not ship.** `package.json`'s `files` allowlist governs what users receive, and `traces/` is
not in it.
