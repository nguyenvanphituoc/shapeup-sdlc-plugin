# Plan — the wiring map

**Design the seam, or the engine ships orphaned.** A sizeable engine module can be built, fully tested, and
still have zero call sites in the application's composition root: green, and unreachable from the running
app. This substep closes that hole at the front. Before the scopes are sliced it writes a committed wiring
map, `shapeup/<slug>/wiring-map.md`, naming for every use case the chain from the engine module to a
user-visible affordance — including how and where the engine attaches to the application's entry point.

You work at design time (GATE L1a.5), before any code exists. Your output is *intended* architecture: the
seam the build must create, not a description of code already written. You do not verify reachability and
you run no oracle; that is a build-time fact `verify trace` proves against real code at the board review.
Your job is to make the seam explicit and buildable. Two payoffs from one artifact: reachability becomes
checkable later (you supply the two anchors — each use case's `engine`, a real repo-relative module path,
and the profile's `entry_point` — and the oracle does the proving), and the slicer gets its integration
seam up front.

This substep writes `wiring-map.md` and nothing else; the spec core, the scopes and the profile are frozen.

## Inputs

The step's `inputs` and files: every use case under `spec/usecases/` (each names the engine it needs;
`domain-model.md` and `synthesis.md` give the module surface); the breadboard, when present (name each
use case's `affordance` by its U# and Place); the guidance files; and the SHARED `project-profile.md`,
whose `entry_point` is the composition root every engine attaches to — **archetype-specific** (a
client-only game's `main.js` is not a web service's `src/server.ts`). Read the profile; never guess the
entry point. **A missing profile is a `need` the loop stops on — do not invent an entry point:** the whole
point is that the seam resolves against a *declared* composition root, and a guessed `main.js` would make
the later oracle certify nothing. A guideline that disagrees with the profile's `entry_point` is told to
the PO, not applied.

## Process

1. **Read** the guidance, then the profile (`entry_point` + `archetype`), then every use case. For each,
   identify the engine module that carries its core logic — the file that WILL exist, named from the
   domain model or synthesis surface, not a guess at a folder.
2. **Design**, per use case, from the entry point inward:

   | Field | Meaning |
   |---|---|
   | `engine` | the module implementing the use case — a repo-relative path, the ONE field the reachability oracle resolves; name the real path |
   | `wiring_seam` | HOW it attaches — the mechanism: an event handler, a route registration, an init hook, a subscription, a DI registration, a CLI command, a cron trigger (prose the slicer reads) |
   | `entry_call_site` | WHERE it attaches — the composition root it registers into, named from the profile's entry point as design intent, e.g. `src/server.ts — POST /checkout route`. The seam the build will CREATE, symbolic, not an existing coordinate. Never invent a line number; the concrete file:line is a build-time fact |
   | `affordance` | what a user can DO once it is wired, not an internal call; with a breadboard, by U# and Place — `U1 Pay (P1) → P2 Payment Sheet` |

3. **Write** `shapeup/<slug>/wiring-map.md`: frontmatter for `schema_version`, `feature` and `entry_point`
   (an echo of the profile), then ONE markdown table under a `## Wiring` heading — this exact shape,
   because it is the only one the reader parses:

   ```
   ## Wiring

   | use_case | engine | wiring_seam | entry_call_site | affordance |
   |---|---|---|---|---|
   | UC-01 | src/parsing.mjs | argv dispatch calls parseEnv | bin/envlint.mjs | envlint <file> |
   ```

   One ROW per use case + engine pair: a use case carried by two engines gets two rows, never one cell
   naming both. `engine` is a bare repo-relative path and nothing else — the oracle resolves that cell
   against disk, and a cell like "`a.mjs` and `b.mjs` — two pure modules" resolves to no file and is
   reported unverifiable. Put explanation in a `## Deviations` section, never in the cell.

   A use case whose engine has no attachment path is exactly the gap this artifact exists to surface:
   write the entry with the seam you INTEND and tell the PO, so the build knows the wiring it must close.

**No use case is exempt.** If an engine genuinely has no player-facing seam (a pure background job), say so
in `wiring_seam` and name the boot, cron or init attachment that starts it. "It's internal" is how an
engine stays orphaned: there is always an attachment to the entry point, or the code never runs.

## Reasons not to cut a corner

| Excuse | Reality |
|---|---|
| "The engine is imported somewhere, that's enough" | Reachability is from the *entry point*, transitively. Imported by a sibling that nothing runs is still orphaned. Design the attachment to the composition root. |
| "I'll guess the entry point is main.js" | The profile declares it. Read it or stop. |
| "I'll write the call site as main.js:42" | That code does not exist yet; a line number is a fabrication no oracle reads. Name the composition root and the mechanism as intent. |
| "This use case has no visible affordance, skip it" | Then name its boot/cron/init attachment. A use case with no entry point never runs. |
| "I'll run the oracle to check my map" | Before the build there is no code to trace; running it proves nothing. It is an advisory check on the step, and the real one runs at the board review. |

Verify before `close`: every use case under `usecases/` has an entry; every entry names a real
repo-relative `engine` and a `wiring_seam` (a player-facing use case also an `affordance`); `entry_call_site`
resolves against the profile's `entry_point`, with no invented line number; `entry_point` echoes the
profile; every use case whose engine has no attachment path was raised with the PO, never silently dropped.
