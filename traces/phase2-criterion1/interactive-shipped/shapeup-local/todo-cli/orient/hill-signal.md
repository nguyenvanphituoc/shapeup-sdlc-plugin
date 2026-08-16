# Hill signal — todo-cli, post-orient

## Position: uphill side, near the top — figuring-out is essentially done

The single technical unknown that could have changed the shape of this feature — how to
resolve the store path (`$TODO_STORE` vs default) and how to fail sanely on a corrupted store
— has been spiked against the real, pinned interpreter (Python 3.10.16, stdlib only) with all
four named edge cases (fresh/empty, round-trip, invalid JSON, env override) plus one
discovered variant (wrong-shape JSON) exercised and passing. Rank 0: no remaining unknown would
change the technical approach.

## What's left is downhill (well-understood execution, not unresolved risk)

- Wiring `bin/todo`'s argparse dispatch to `add`/`list`/`done`/`rm` subcommands — standard
  stdlib `argparse` usage, no open questions.
- Deciding and documenting 1-based vs 0-based index semantics for `done <n>` / `rm <n>` (seeded
  as a discovered task — a product decision, not a technical risk).
- Writing the use cases and Test Surface (BA's job next) — the domain model here is trivial
  (a list of `{text, done}` records) with no hidden complexity the spike didn't already surface.

## Confidence for the next phases

BA can write use cases against a store module whose failure modes and path-resolution
behavior are now known quantities rather than assumptions. Solution-architect's wiring map has
exactly one integration seam to declare (`bin/todo` → store module → four command engines),
matching the entry point already fixed in `project-profile.md`. No spike-driven change to the
declared `library` archetype or `bin/todo` entry point is needed.
