# `traces/` — archived run traces

Committed evidence from the v4 runs, one subdirectory per run under `v4/`: the run trace
(`shapeup-local/`), the committed contracts it produced (`shapeup-committed/`), the deliverable the
workers wrote (`deliverable/`) and a machine-readable `SUMMARY.json`.

`phase3/fanout-arm-shipped/idea.md` is the one file kept from the earlier runs: it is the `envlint`
pitch every measured v4 run was given, so a second run starts from it. The other traces of earlier
versions were removed; they stay in git history (`git log --stat -- traces/phase3 traces/phase2-criterion1`).

**Why these are not under `docs/`.** The doc-drift check reads every `.md` under `docs/` and fails on
any cited path that is not on disk. A trace records what was true during one run of a *different*
project, so the paths it names are supposed to be absent from this repo.

**These are records, not documentation.** Nothing here is maintained. A trace is never edited to stay
current; if it stops matching the repo, that is the trace doing its job.

**They do not ship.** `package.json`'s `files` allowlist governs what users receive, and `traces/` is
not in it.
