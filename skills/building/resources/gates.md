# Putting a gate to the gate agent

A run is unattended: every gate is answered by the gate agent (`shapeup-sdlc-plugin:gate-agent`), never by you
and never by a person. Start it anew at each gate with **the gate id and plain name, the round and verdict where
the gate has them, the kernel's `block` verbatim, and the paths below**. Do not send your own opinion of the
answer. **Give it the absolute kernel path**, `node "<absolute plugin root>/kernel/harness.mjs"`: a command that spells it through a variable is refused in a headless session before any permission rule is read, and the agent takes no order that would carry it. It reads the decision log first, then these paths, decides, writes its entry and records the answer.
What each gate decides, and the answers it may give, are in the gate agent's skill.

| Gate | Send the paths |
|---|---|
| `L0` Intake & Config | `<run>/run-args.json`, `<run>/intake.md`, `<spec>project-profile.md` |
| `L1a` Orient Review | `<run>/orient/` (the code-surface map, `hill-signal.md`, the spike result), the breadboard source |
| `L1a.5` Wiring Review | `<spec>wiring-map.md`, `<spec>spec/usecases/_index.md` |
| `L1b` Board Review | the pitch, the breadboard, `<spec>requirements.md`, `<spec>scopes/*.md`, `<spec>spec/usecases/_index.md`, `ux-behavior.md`'s Deferred Places, and the REQ → AC table (one row per requirement: the criterion that grades it, the scope that claims it, or `CUT (PO-approved)`; omitted when the run has no registry). A breadboard Place with UI affordances is a screen: a run defers nothing |
| `L2` Round Close | the block (`green_scopes`, `hammer_proposals`, the build gate: `green`, `red — <step>` or `undeclared`), `<run>/t0/verdicts/`. A board with no tasks at all forces a stop whatever the answer |
| `L3` Verdict | `<run>/results/evaluate-rR.json`, the verdict file, the rounds used and left; progress by hill position per scope, never "N of M tasks" |
| `QA` QA Edge Hunt | the verdict's coverage, the Test Surface |
| `H` Cut-List Review | `<run>/reports/hammer-census.json`, `<run>/discovery/ledger.md` (see `resources/ship/census.md`) |
| `L4` Ship Sign-off | the census, the run's QA record, the ship report, and the status line the block carries: the feature as `SHIPPED (deployed)` or `BUILT & VERIFIED — deploy pending`, the dimensions evaluated **and** not evaluated, the QA findings, and the `Requirements:` line transcribed from the report's table. The loop never deploys |
| `COACH-1` Retro Ownership | nothing: a run has no PO feedback to categorise |

## Findings and endings

- **Findings come back** naming files: a file in two scopes' substrate without both declaring it shared, a scope aligned with a
  directory, a scope whose use case does not resolve, a `depends_on` naming a scope that is not there, a requirement no criterion grades
  and no scope claims, a Place with UI affordances folded into another screen. Repair them in the activity that produced them
  (planning's to fix: add the screen, never fold it) and start the gate agent again. A second return at the same gate closes the run `escalated`.
- **A kernel refusal** (`K gate --resolve` exits 4 with `refused`: `ship` over a census that did not clear, `proceed` over an empty board) closes the run `escalated`; write the ship report first if the census exists.
- **`hold`** closes `escalated`; **`abort`** closes `aborted`. The agent's reason is in the decision log either way.
- **Scopes are released in dependency order**: a scope opens the moment the scopes it declares in `depends_on` have settled, up to `maxParallelScopes`; contracts declaring none are one wave.
- **A kept guidance rule** (knowledge base) may add a question or a check to what you send; it never answers, skips or widens a gate.
