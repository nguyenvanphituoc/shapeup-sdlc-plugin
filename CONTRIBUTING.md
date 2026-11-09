# Contributing

Thanks for looking. This project is early and solo-authored, which means two things: your
first PR will get read quickly, and there is a lot of low-hanging fruit.

- [Ways to help](#ways-to-help)
- [Getting set up](#getting-set-up)
- [The shape of the codebase](#the-shape-of-the-codebase)
- [Adding or changing a skill](#adding-or-changing-a-skill)
- [Adding a hook](#adding-a-hook)
- [Rules that are not negotiable](#rules-that-are-not-negotiable)
- [Pull requests](#pull-requests)

## Ways to help

**Easiest and most valuable: tell us where it confused you.** This harness has invented
vocabulary and ten gates. If you bounced off the README, or a gate denied something you
thought was reasonable, that is a bug report — open an issue with the
*Onboarding friction* template. We would rather fix the twentieth confusing sentence than add
the seventh skill.

Beyond that, the open items are listed as
[`good first issue`](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/issues?q=is%3Aopen+label%3A%22good+first+issue%22).
The [known rough edges](README.md#known-rough-edges) in the README are all real and all
unclaimed.

Questions, ideas, and "is this thing meant to do X" belong in
[Discussions](https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin/discussions).

## Getting set up

```bash
git clone https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin
cd shapeup-sdlc-plugin
npm test                             # structural tests — no install step needed
claude plugin validate . --strict    # the same check CI runs
claude --plugin-dir .                # load this working copy in a session, without installing
```

There is no build. Skills are markdown, hooks and scripts are plain `.mjs` with no
dependencies. If `npm test` and `claude plugin validate . --strict` both pass, CI will too.

To re-record the README demo after changing a gate:

```bash
npm run demo
```

That script runs the real hook and **fails** rather than render a demo that does not match
behaviour. Do not hand-edit `docs/assets/demo-gate.svg`.

## The shape of the codebase

```
skills/<name>/SKILL.md    one skill = one craft. Markdown. This is most of the project.
skills/building/         the loop: a skill that drives a run over the run's own files
skills/building/resources/  one file per activity, grouped by phase: intake/ plan/ build/ ship/ retro/
kernel/                   the deterministic half: t0, the gate resolver, the envelope check, init run, order
kernel/schemas/           domain.schema.json + the envelope schemas
hooks/                    three .mjs hooks and the envelope check; hooks.json wires them
tests/structural.mjs      the test entrypoint (eleven modules, each executing shipped code)
```

The one architectural thing worth knowing before you change anything: **the orchestrator owns
the pipeline and workers own craft.** A worker skill never learns where it sits in a run. It
receives a work order, does one job, and returns a result; the orchestrator applies it. If you
find yourself wanting a worker to write to the board, the design is pushing back on you — see
[Rules that are not negotiable](#rules-that-are-not-negotiable).

## Adding or changing a skill

Editing an existing skill is usually just editing its `SKILL.md`. Run `npm test` afterwards —
the structural tests assert quite a lot about skill shape.

Adding a **new worker** skill has one extra step, and it is the part of this project with the
highest friction today (we know; help welcome):

1. Write `skills/<name>/SKILL.md`. Craft only — no pipeline knowledge, no shared-state writes.
2. Declare the fields it needs in the central registry
   `kernel/schemas/domain.schema.json`. Every cross-boundary field is defined there
   **once**, annotated with its tier, location, writer and readers. No skill defines its own.
3. Add `agents/<name>.md` (its tools, its model, the skill it preloads), a row to the `building` skill's
   phase table, a line on the index that ends its `SKILL.md`, and its order to
   `skills/building/resources/orders.md`. Step 1 alone yields a skill the loop has no way to dispatch.

An activity the loop does itself (a planning substep, the census, the retro) has no agent and no schema
entry. It is one file under the phase folder that reads it, opening with the four-row contract that
`skills/building/resources/contract.md` describes, plus its line on the index and the phase row or
sub-command that reaches it. `npm test` reads the three against each other.

If step 2 or 3 is where you got stuck, please say so in the PR or an issue — reducing that cost
is an explicit goal, not a fact of life.

## Adding a hook

Hooks are the load-bearing part of this project, so they get the strictest rule:
**fail open, never closed, unless you can prove the bad state.**

`hooks/sandbox-guard.mjs` is the reference implementation and its header comment explains the
reasoning. It denies only when it can positively read a partial board; a missing board, an
unparseable payload, or an unrecognised invocation shape all defer to the normal permission
flow. A gate that breaks legitimate runs gets disabled by its users, and then it protects
nobody.

Every hook must also be readable end-to-end by a stranger doing a security review, and must
make no network requests.

## Rules that are not negotiable

These are the invariants the whole design rests on. A PR that breaks one will get a request for
changes, however good the rest of it is.

| Rule | Why |
|---|---|
| One judge — only `spec-evaluator` produces a verdict | QA discovering a bug is not a second opinion on ship-readiness |
| EVAL runs exactly once per round | The loop terminates because the judge is expensive and singular |
| Only the loop writes shared state | This is what makes parallel scopes safe |
| Progress is a T0 artifact the evaluator re-hashes, never a worker's account of itself | The entire honesty claim of the project |
| Workers never learn pipeline position | Keeps skills reusable and testable in isolation |
| No fabricated eval numbers, ever | See below |

**On that last one.** There is no behavioral eval layer in this repo any more — the Tier-1
activation datasets and the Day-1/Day-2 register were removed, and the CI test that failed on
fabricated results went with them. The rule it enforced still stands and is now on you: if you
measure something, publish what you got, including if it is unflattering. A mediocre real
number is worth more to this project than a great fake one. It is the same idea as the rest of
the harness, pointed at us instead of at the agent — the difference is that this one is no
longer mechanically enforced, so it depends on the reviewer noticing.

## Pull requests

- Branch from `main`, keep the diff focused, and say what failure the change prevents.
- Run `npm test` and `claude plugin validate . --strict`.
- Update `CHANGELOG.md` if the change is user-visible.
- If you changed a hook's behaviour, run `npm run demo` and commit the regenerated asset.

Small PRs get merged fast. If you are planning something large, open a Discussion first so you
do not spend a weekend on something that collides with the design.

By contributing you agree your work is licensed under the [MIT License](LICENSE).
