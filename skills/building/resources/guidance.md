# The knowledge base — one rule per file, chosen by the kernel

`shapeup/knowledge-base/rules/<reader>/<id>.<slug>.md` holds the rules the team has filed, **one rule per file**. A rule steers
craft: **it may add a question or a check to a gate block, never an answer, a skip, a reorder or a wider substrate.** A rule that
disagrees with the spec, a contract, a gate or a kernel check loses, and the conflict is told to the PO.

**The kernel chooses, not you.** When an order opens (`K order open`) the kernel reads the order, applies each rule's `when`,
stays inside a token budget, writes the chosen rules to one compiled file, and puts that file's path in the order
(`payload.kb_rules_path`, or `kb_rules_paths` for a `plan` step) with the revisions it chose (`payload.kb_load_set`). **Leave both fields out of the
order you write** — the kernel sets them, and the dispatch receipt copies the set, so which rules a worker had is a record and not a recollection.
`K kb select --reader <reader> …` shows what an order would load; it writes nothing.

| Reader | Loaded when | By |
|---|---|---|
| `task-executor`, `orient`, `qa-edge-hunter` | their order opens | the worker reads `payload.kb_rules_path` |
| `plan` | each planning step's order opens (`worker: "building"`, with a `step`) | you read the one file `payload.kb_rules_paths` names |
| `building` | the run opens: the loop's own rules are compiled by section — a general one and one per gate — into the launch record (`kb.path`) | you read the general section at Intake & Config; the gate agent reads the section of the gate it answers |

A rule's `when` names any of `operation`, `step`, `archetype`, `topology_type`, `gate` and `signal` — the failure classes the
kernel derives for an order (a fix after a T0 regression, a second round, a previous verdict's failed dimension). A rule with no `when`
applies to every order of its reader. A rule is `active`, `probation` (filed by a run, not yet shown to work), `retired` or `expired`; the
kernel loads the first two. A rule of kind `check` names a closed check the kernel runs with T0 over the scope's fixtures and reports as findings, never as a verdict.

**Never read:** a rule for `spec-evaluator` (the judge is not coachable — a coached judge is a second grader) or for the stop
step's census (its ownership, exhaustion and requirement claims come from files, not from guidance). `K kb lint` refuses both.

**Before a project has a rule table**, a reader's old whole-file (`shapeup/knowledge-base/task-executor.md`, `plan.md` and the older
planning names, `building.md`, `tech-lead.md`) is read as before — the kernel leaves the order alone and says so in one line. `K kb migrate`
splits those files into rules without touching them; run it once, then the kernel chooses.

**Filing a rule.** Inside a run, a lesson reaches the table through the reflect activity (`resources/retro/reflect.md`), on evidence the kernel checks.
Outside one, `/retro` files what a person decided (`resources/retro/retro.md`). Neither writes a rule by hand.
