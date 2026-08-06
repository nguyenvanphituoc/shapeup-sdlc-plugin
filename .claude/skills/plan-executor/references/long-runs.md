# Running long — budgets, usage limits, and picking the run back up

A plan of this size does not fit in one uninterrupted sitting. The run has to survive three
different kinds of stop, and the difference between them decides what you do next.

| Stop | What it looks like | What it means |
|---|---|---|
| **Success** | every stage green | Stop. Success is a stop condition, not just budget exhaustion. |
| **Token target** | `outcome: budget-exhausted` | The `+500k`-style target is a hard ceiling. Write the handoff and stop. |
| **Usage limit** | agents return nothing, several in a row → `outcome: interrupted` | Nothing is wrong with the plan. Park, wait for the window, resume. |
| **No progress** | a stage blocked after identical failures | The loop is spending money to learn nothing. That stage stops; the others continue. |

## Why resuming is cheap

Progress is derived, never remembered. The preflight runs every acceptance command in a clean
room and finds out what is already true — so a run resumed hours later, in a different session
with no context at all, spends one cheap agent to skip every finished stage.

This is what makes the workspace's location matter. Put it in `.plan-runs/<slug>/` inside the
repository, gitignored. The scratchpad is session-scoped and a resumed run is often a new session,
which would leave the frozen evidence stranded on a path nobody can name.

Nothing else survives a resume, and nothing else needs to. A prior run's claim that a stage is
done is not evidence, and it is not consulted.

## Waiting for a usage window

There is no way to query Claude Code's limit state — no API, no file. The reset time comes from
the message you were shown. Pick the route that fits how the session is running:

**Under `/loop`** — `ScheduleWakeup` with `delaySeconds` set to the seconds until reset (clamped
to an hour, so re-schedule if the window is longer), and pass the same `/loop` prompt back so the
run re-enters here on wake.

**Otherwise** — a backgrounded sleep. When a backgrounded command exits, the harness re-invokes
you, so the exit *is* the resume trigger:

```bash
# Bash tool, run_in_background: true — chain if the window is longer than the timeout allows
sleep 600
```

Before parking, write `<workdir>/RESUME.md` so a session that wakes with an empty context knows
what it is holding:

```markdown
# Parked — waiting for a usage window

- **workdir:** .plan-runs/day2
- **contract:** .plan-runs/day2/contract.md
- **branch:** plan/day2-tool-efficacy
- **parked at:** <time>  ·  **expected reset:** <time>
- **green when parked:** S1, S2   ← re-derived by preflight on resume; do not trust this line
- **still red:** S3

On resume: run the acceptance commands for every stage first. That costs nothing and tells you
what is actually done. Then restart the workflow against the stages that are still red.
```

The "green when parked" line is a convenience for a human reading the file, not an input to the
run. Marking it as untrustworthy in the file itself is deliberate: it is exactly the kind of note
that gets believed six hours later.

**Do not** wait through a window by burning cheap tokens to stay alive, and do not schedule
wake-ups more often than the thing you are waiting for changes. A parked run costs nothing.

## Scaling the depth to the budget

With a `+500k`-style target set, `budget.remaining()` is real and the workflow holds back a
reserve so it can always write its handoff. Without one, `budget.total` is null, the token gate is
inert, and the real limits are `attempt_budget` and `no_progress_rounds`. Two consequences:

- On a long unattended run, **set a token target**. It is the only ceiling that scales with what
  the work actually costs.
- Raise `attempt_budget` above 3 only when the freezes show attempts converging — different
  failures each time. Identical failures mean more attempts buy nothing, which is what the
  no-progress breaker is for.

## When the run stops incomplete

An incomplete run that shipped four green stages out of six is a good outcome, and it should be
reported as one. Compare against where the repository was when the run started, not against the
plan's ideal — a run killed from outside ships nothing, a run that stops on its own ships what is
green.

For each unfinished stage the handoff needs: its status, the last failure, the freeze directory,
and — for an escalated stage — the fix that was refused and why. An escalation is the run telling
you it found a fix it was not willing to make, usually because the only way through was to weaken
the check. That is a finding worth reading, not a failure to route around.
