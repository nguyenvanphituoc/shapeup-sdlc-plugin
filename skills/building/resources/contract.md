# The contract every activity file opens with

An activity is one thing the loop does for one phase row, or for one sub-command: open the run, write the
wiring map, do the census. Each has one file under `resources/intake/`, `resources/plan/`, `resources/build/`,
`resources/ship/` or `resources/retro/`, and that file opens with the same four rows, directly under its title:

```markdown
| Contract | |
|---|---|
| Phase | `5` |
| Order | `plan` · `wire` |
| Gate | `L1a.5` |
| Done when | `<spec>wiring-map.md` exists and `<run>/results/plan-wire.json` names it |
```

| Row | What it holds | Where the value is copied from |
|---|---|---|
| Phase | the phase-table rows that run this activity; `step 0` for opening the run; `sub-command` for one reached only by a sub-command | the phase table and the Sub-commands section of `SKILL.md`. The index there says the same of this file |
| Order | the operation of the order the activity opens, and for `plan` the substep; `none` when it carries no order (opening the run, the language gate, the census, the ship report, the retro) | `resources/orders.md` |
| Gate | the gate crossed when the activity is done, by the id the ledgers carry; `none` when no gate follows it | the phase table, and `resources/gates.md` |
| Done when | the file whose existence says the activity is finished | the condition of the phase row, and the facts table of `SKILL.md` |

**A value is copied, never decided here.** The header gathers in one place what the phase table, the order
templates and the gate table already say about this activity. When one of them changes, the header changes with
it; when they disagree, the table that owns the value is right and the header is the defect.

**There is no "Writes" row.** What an activity with an order may write is its row in `resources/orders.md`,
which is what the write fence reads. A second copy here would be a second thing to keep true.

**Which files do not carry it.** The files every activity shares (`resources/orders.md`, `resources/gates.md`,
`resources/guidance.md`, this file), the files that explain how or why and run nothing themselves
(`resources/plan/substep.md`, `resources/build/round.md`, `resources/intake/preservation.md`), and the two
libraries under `resources/plan/references/` and `resources/plan/templates/`. The index in `SKILL.md` lists
those with `—` where an activity has its rows.

**Adding an activity** is one file with this header, one line on the index, and the phase row or sub-command
that reaches it. The structural suite reads the three against each other.
