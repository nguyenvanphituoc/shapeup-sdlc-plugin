# Retro — scan: seed the knowledge base from the project

`/retro --scan` runs before the first feature, or again after the project's toolchain changes. It replaces the
feedback source with the repository itself; every other step is `resources/retro/retro.md`'s, **including GATE
COACH-1**. The point is to reach the first run with the platform's habits already in the readers' files instead
of learning them across three rounds.

```
S1  READ    what the project says about itself, in this order and no further:
            build/toolchain files (package.json, pyproject.toml, build-profile.json5, *.gradle,
            Package.swift, Cargo.toml, go.mod, …), CI config, the project's CLAUDE.md / AGENTS.md /
            README, an existing project-profile.md, the test runner's config, and the language of
            the entry point. Do not read the feature code: the scan seeds habits, it does not
            review work.
S2  DRAFT   candidate rules, each with the evidence line (`file:line` or the command you ran) that
            produced it. Draft against the categories, never against a wish list:
              task-executor      the real build/check command; idioms this language rejects that its
                                 nearest popular relative allows; what "done" must run before a
                                 result is reported
              plan               test APIs the toolchain lacks or forbids; invariants that a platform
                                 API silently contradicts (self-persisting settings); config files
                                 that wire code in (a route map, a module manifest, package.json's
                                 bin/exports) and must have one owner; where the entry point really
                                 is when the template lies
              qa-edge-hunter     cold-start, reinstall, offline or permission edges the platform
                                 makes likely
              orient             constraints worth a spike before any spec exists
              building           Suggested run config: archetype, entry_point, run_cmd, build_probe,
                                 launch_probe, stack hint — each with evidence
            Cap the draft at 15 per category before the gate; fewer, sharper rules survive.
S3  GATE    ⏸ GATE COACH-1 exactly as for feedback. Every scanned rule is a claim the model made by
            reading files, so the PO confirms each one; nothing is filed on a scan's authority
            alone. In an `auto` or `unattended` run the scan writes NOTHING: it lists the draft for
            the PO at GATE L0.
S4  WRITE   Steps 3 and 3b of `resources/retro/retro.md`, with provenance `from project-scan @ <short sha>`. A rescan
            replaces only the rules that carry scan provenance and leaves every feedback and
            research rule in place — the lineages never overwrite each other. The one exception is
            deliberate and one-directional: a scan rule that says the same thing as a research rule,
            with disk evidence, supersedes it — the research rule is retired and the merge noted,
            because evidence from the project's own files outranks evidence from a document about
            the platform.
S5  REPORT  Step 4 of `resources/retro/retro.md`, plus: which Suggested run config lines are new, so they can be pinned
            at the next GATE L0 (you confirm and write the profile; the scan does not).
```

What the scan is not: it is not a gate and cannot make one pass. A project whose scan says "the build is
`hvigorw assembleHap`" still has to declare it as `run_cmd` at L0 for the round build gate to run it — the scan
proposes, the PO pins at L0, the kernel runs. A rule the model wrote by reading a file is not evidence the
command works.
