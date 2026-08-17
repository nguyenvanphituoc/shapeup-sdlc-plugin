# Hill signal — envlint (post-orient)

## Signal

**Uphill, at the very start of the climb — figuring out, not yet executing.**

- No production code exists. `bin/envlint.mjs` (composition root), and the Parsing/Rules
  engines are all unbuilt.
- No spec tree (`shapeup/envlint/spec/*` use-cases, scope contracts) exists yet — orient is the
  first worker to touch this feature after intake, per the harness sequencing (`ba` runs next
  and needs orient's recon).
- The one genuine unknown identified by risk scan — whether `new URL()`'s leniency matches the
  spec's literal `url` rule wording, and whether a naive implementation could drop the
  protocol gate — is now resolved (see `spike-url-type-validation.md`). That was the only piece
  of this feature where "figuring out" required running real code rather than reading the pitch;
  the rest of the pitch (regex rules, quote-stripping, exit codes) is unambiguous from
  EXPECTED.md alone and needs no further spiking.

## Basis (mechanical, not self-reported)

- Board: does not exist yet (pre-scoping). 0 scopes, 0 tasks defined.
- T0 artifacts: none — nothing has been built or run against fixtures yet.
- Spike artifact: `spike-url-type-validation.md`, produced this run, re-runnable (plain Node
  one-liners against `new URL()`, no files outside the substrate).

## What moves the hill next

1. `ba-pitch-analyzer` builds the spec tree (use cases, Test Surface) from `idea.md` +
   `EXPECTED.md`, incorporating the discovered-seed gaps above as candidate Test Surface rows.
2. `solution-architect` writes the wiring map (trivial here — single entry point, two engines).
3. `scope-architect` slices Parsing / Rules / CLI into the three independently-buildable scope
   contracts the pitch itself already names.
4. First `task-executor` dispatch is genuine "climbing" — until then, this feature has not left
   the uphill side.
