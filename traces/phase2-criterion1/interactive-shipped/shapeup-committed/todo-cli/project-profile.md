---
schema_version: 1
archetype: library
entry_point: bin/todo
note: Python 3 stdlib-only CLI. `library` is the closest archetype in the enum (a local package plus a bin entry — not a server, game, mobile app, or pipeline). Reachability's import-graph arm is JS/TS-only, so its orphan findings are noise on this run — see below.
---

# Project profile — todo-cli

Written by `tech-lead` at GATE L0. This is the entry-point/archetype declaration that
`harness verify trace`'s reachability arm and `solution-architect` (WIRE) resolve engines
against. It is SHARED (committed) because a declaration that must survive `rm -rf .shapeup/`
plus a clone cannot live in the gitignored run-trace.

## Archetype

`library`. The deliverable is a zero-config command-line binary, and the enum
(`client-only-game | web-service | mobile | library | data-pipeline`) has no `cli` member.
`library` is the least-wrong of the five: a CLI is a local package with a `bin` entry, and
nothing about it is a server seam, a game loop, a mobile shell, or a batch pipeline. The
choice was made explicitly rather than by defaulting, so a later reader knows it was a
mapping and not a typo.

## Entry point

`bin/todo` — the argparse dispatcher. This is the reachability seam: every use-case engine
under `todo/` must be reached from it, which is exactly the property the pitch's no-gos
imply (there is no second way into this program — no server, no daemon, no TUI).

Stack, pinned at L0.4 by the PO: **Python 3, standard library only** (`json` + `argparse`;
`python3` on this machine is 3.10.16). No install step, no dependency resolution — the
harness drives the binary directly:

```
TODO_STORE=/tmp/probe.json python3 bin/todo add "ship it"
```

## Known limitation of the reachability arm on this run

`kernel/verify/trace.mjs` walks the import graph with `SOURCE_EXTS = [.js .mjs .cjs .jsx
.ts .tsx]` and an ES/CJS import regex. Neither matches Python: `from todo.store import ...`
carries no quoted specifier, and `todo/store.py` is not a recognised source extension.

Consequence, stated up front so it is not misread at GATE L1a.5 / L1b: once `bin/todo`
exists on disk it will *resolve* (the resolver accepts an extensionless file that exists),
the BFS will then find zero imports, and every engine declared in `wiring-map.md` will be
reported as `never imported from entry_point`. **Those findings are an artifact of the
language mismatch, not evidence of an orphaned module.** The arm is advisory at L1b
(AGENTS.md — the traceability oracle stays advisory until `covers:` is populated), so it
warns and permits.

What still holds this run: WIRE's per-use-case declaration (engine → seam → call site →
affordance) is written and reviewed by a human at GATE L1a.5, and the T0 fixtures drive the
real binary. Reachability is the arm that is blind here; the seam declaration and the
execution evidence are not.
