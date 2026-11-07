# Proposal — from roles to activities: skills, hooks and agents for the single loop

| | |
|---|---|
| **Date** | 2026-11-07 |
| **Baseline** | 3.18.4 at `0081c38`; `npm test` green |
| **Follows** | `review-2026-11-07-single-loop.md` (the control-plane cut). This file is about the *skill layer*: which skills, hooks and sub-agents go, and what simpler thing takes each one's place |
| **Principles given** | simplify · focus · surgery just enough to make sure it works and does not break another · ask before assumption — confirm the default recommendation |
| **Status** | decided — the four defaults in §6 were put to the PO on 2026-11-07: three confirmed, one changed (intake stays as a resource). **Amended 2026-11-07** against `constraints-2026-11-07.md`: the smaller defaults no longer all stand (box below) |

> **Amended 2026-11-07.** Corrections, listed so they are not silent. Items marked *(default, to
> confirm)* come from the constraints report's §6 defaults, which the PO confirmed on 2026-11-07.
>
> | Was | Is |
> |---|---|
> | `gate-zerowork` shrinks to ~60 lines (§4.2) | re-keyed to `building` and `/ship`, about 200 lines; the dispatch detector stays because the predicate is "dispatched AND no receipt" |
> | `building` is "one loop, written as prose" (§4.1) | a thin skill over a kernel `probe next` verb, inside the 155-line ratchet *(confirmed by the PO)* |
> | Planning folds into the loop with no dispatch (§2, §4.3) | planning keeps a fence-only `plan` order so its writes stay under a substrate *(confirmed by the PO)* |
> | `Operation` 18 → 6 | 18 → 7 (`plan` stays as the fence-only operation) *(confirmed by the PO)* |
> | Hook files 7 → 5 | hook scripts 6 → 5, plus the shared decision library |
> | Surgery order of five steps (§5) | adds the ADR first and a 4.0.0 release with the release-candidate check last |
> | `--adversarial-verify` not carried over, `SessionStart` echo and `gate-intake` go | unchanged |

## 1. The pattern is already in the repo

`skills/shapeup/SKILL.md` is organised by **activity**, not by role: its sub-commands are the
things a person does (`shaping`, `spike`, `breadboarding`, `framing-doc`, `kickoff-doc`,
`breadboard-reflection`), each loads one resource file on demand, the whole run obeys three standing
rules, and every gate is a mandatory question with the recommendation shown first. The four
principles given for this proposal are those rules, almost word for word:

| Principle given | `shapeup`'s standing rule |
|---|---|
| ask before assumption — confirm the default | RULE 1 — ASK, DON'T ASSUME; the gate questions |
| simplify · focus | RULE 2 — SIMPLEST SOLUTION FIRST; "if an affordance can be removed without breaking coverage, remove it" |
| surgery just enough, break nothing else | RULE 3 — NON-REGRESSION; "scope only forward" |

The Building phase has none of this. It is eleven skills named after **roles** (analyst, two
architects, executor, evaluator, hunter, hammer, coach, translator, tech lead), each with its own
envelope boilerplate, dispatched by a 2,234-line script. The proposal is to give Building the shape
Shaping already has: one skill per *phase*, sub-commands per *activity*, craft in resources, the
three rules at the top, and a question at every gate.

## 2. Activity map

Shape Up's own chapter names are the activities. Every operation the schema enumerates lands on
exactly one row.

| Activity | Shape Up | Today (skill: operations) | Under the loop | Runs in |
|---|---|---|---|---|
| **Shape** | Set Boundaries · Find the Elements · Risks and Rabbit Holes · Write the Pitch | `shapeup`: shaping, spike, breadboarding, framing-doc, kickoff-doc, breadboard-reflection | unchanged — it is the pattern | the session |
| **Bet** | The Betting Table | none (PO) | none | PO |
| **Orient** | Hand Over Responsibility | `orient`: orient | unchanged | sub-agent — reads far more than it returns |
| **Plan** | Map the Scopes | `ba-pitch-analyzer`: coverage, analyze, board, reconcile, retrofit-surface · `solution-architect`: wire · `scope-architect`: map-scopes | one activity, `plan`, four steps in one context, `verify spec` between them | the loop |
| **Build** | Get One Piece Done | `task-executor`: execute, fix, spike | unchanged | sub-agent — parallel, fresh write fence per order |
| **Evaluate** | (the harness's single judge) | `spec-evaluator`: evaluate | unchanged | sub-agent — must not see how the work was made |
| **Hunt** | "QA is for the edges" | `qa-edge-hunter`: hunt | unchanged | sub-agent — drives the running app |
| **Progress** | Show Progress | `hill-chart` | unchanged (decision 3) | the session |
| **Stop** | Decide When to Stop | `scope-hammer`: hammer | activity `stop`: three kernel probes (`owner`, `requirements`, `attempts`) + the baseline comparison + the cut list | the loop |
| **Ship** | Move On | `tech-lead` L4, `REPORT.md` | activity `ship` | the loop |
| **Retro** | (team learning) | `coach`: coach, scan, research | activity `retro`; GATE COACH-1 stays a question | the loop |
| **Intake** | — | `translator`: translate | activity `intake`: the same English copy and glossary, produced in the loop (decision 2) | the loop |
| **Run** | (the Building phase itself) | `tech-lead`: SKILL + `references/protocol.md` + `references/gates.md` + the run script | the `building` skill — the loop, in the `shapeup` shape | the session |

## 3. Target layout

```
skills/
  shapeup/            Phase 1 — unchanged
  building/           Phase 3 — the loop. Modelled on shapeup: sub-commands are activities,
    SKILL.md            resources load on demand, three standing rules, a question at every gate
    resources/
      orient.md         how the loop dispatches orient and reads its four artifacts (thin)
      plan.md           requirements → spec tree + board → wiring map → scope contracts
      plan/             the planning craft, moved: today's ba-pitch-analyzer references and
                        templates, solution-architect's seam rules, scope-architect's slicing
      build.md          per scope: compile → dispatch → ingest → verify t0; waves; the breaker
      evaluate.md       once per round; dimensions; sent-back-once
      hunt.md
      intake.md         non-English pitch → <name>.en.md + glossary, in the loop (from translator)
      stop.md           census → baseline → cut list   (from scope-hammer)
      ship.md           REPORT.md, L4, export, close
      retro.md          COACH-1, knowledge-base files  (from coach)
      gates.md          the gate blocks                (from tech-lead/references/gates.md)
      ledger.md         ledger format                  (from protocol.md Part 4)
  orient/             sub-agent worker — unchanged
  task-executor/      sub-agent worker — unchanged
  spec-evaluator/     sub-agent worker — unchanged
  qa-edge-hunter/     sub-agent worker — unchanged
  hill-chart/         unchanged (decision 3) — which keeps reduce hill and reduce graph
```

| | Today | Proposed | Note |
|---|---|---|---|
| Skills | 13 | 7 (6 without `hill-chart`) | six fold into `building/resources/` |
| `WorkerName` | 10 | 4 | the roster derives from the enum (`kernel/verify/skills.mjs`), so the receipt hook and the preflight follow with no edit |
| `Operation` | 18 | 7 — orient, execute, fix, spike, evaluate, hunt, and `plan` as a fence-only order *(amended; was 6; confirmed by the PO)* | 11 cases leave `kernel/compile.mjs` |
| Sub-agent kinds per run | 10 + the couriers | 4 | couriers: 51 call sites → 0 |
| Hook scripts | 6 | 5 | §4.2; plus the shared decision library, unchanged |
| `hooks.json` entries | 8 | 6 | §4.2 |
| Commands | 11 | 10 | `scopes` + `wire` → one `plan`; the rest keep their names |

## 4. What goes, and what simpler thing replaces it

### 4.1 Skills

| Skill | Lines | Goes because | Replaced by | Principle |
|---|---|---|---|---|
| `tech-lead` | 3,932 | the run script and the prose lane are two implementations of one loop; the role name hides that the skill *is* the phase | `building` — one loop, a thin skill over a kernel `probe next` verb *(amended; was: prose the model follows)*, with the kernel's exit codes as the only way forward | simplify |
| `ba-pitch-analyzer` | 3,822 | planning is one activity cut into three roles; its 29 files include a cross-context template set (4 files, 335 lines) that no archived run used — all 93 lens records in `traces/` say `standard` | `building/resources/plan.md` + `plan/`; the cross-context templates and the `full` lane are *focus* candidates, pruned only after confirming nobody shapes six-week bets with this plugin | focus |
| `solution-architect` | 158 | one operation, one artifact, chained on the planner's output | step 3 of `plan` | simplify |
| `scope-architect` | 174 | one operation, chained on the planner's output | step 4 of `plan` | simplify |
| `scope-hammer` | 231 | a prose layer over three kernel probes | `stop.md`; the probes are unchanged | simplify |
| `coach` | 397 | post-ship, converses with the PO — exactly what a sub-agent cannot do well | `retro.md`; COACH-1 asks, never assumes (unchanged) | ask |
| `translator` | 360 | a sub-agent for a step the loop performs by reading | `intake.md` — the English copy and the glossary are still written, so a PO who does not read English keeps a text to check against; only the dispatch goes (decision 2) | simplify |

What **stays**, and why each is left alone: `shapeup` (the pattern); `orient`, `task-executor`,
`spec-evaluator`, `qa-edge-hunter` (the four rows `analysis/02` marks with a kit criterion — and
each is already named for its activity in all but spelling; decision 1 is whether to touch the
spelling at all).

Two **unexercised** surfaces inside the kept skills, named so a later *focus* pass can measure them
rather than guess: `spec-evaluator` ships seven dimension references (580 lines) and the archived
verdicts grade two (`spec-conformance`, `test-surface-conformance`); `ba-pitch-analyzer`'s
`run-state`, `task-board`, `task-spike` and `assess-report` templates match nothing in any
archived committed spec (a stem match — weak evidence, enough to ask, not enough to cut).

### 4.2 Hooks

| Hook | Lines | Record (9 runs) | Verdict | Replaced by |
|---|---|---|---|---|
| `hooks/sandbox-guard.mjs` | 500 | 22 denials | keep | — |
| `hooks/tier-guard.mjs` | 162 | (added after the traces) | keep | — |
| `hooks/dispatch-receipt.mjs` | 198 | 260 receipts | keep | roster shrinks to 4 on its own |
| `hooks/safety-spine.mjs` | 333 | 0 / 5,268 | keep, as insurance | ablation candidate at the next model upgrade |
| `kernel/verify/envelope.mjs` as a hook | 288 | 3 denials | keep | — |
| `hooks/gate-intake.mjs` | 109 | 0 / 243 | **cut** | nothing — it exists to catch `Skill(tech-lead)` arriving with no pitch; the loop *is* the session that was handed the pitch, so an empty intake fails in view |
| `hooks/gate-zerowork.mjs` | 349 | 0 / 57 | **re-key**, about 200 lines *(amended; was: shrink to ~60)* | the one Stop check that still matters. Its predicate is "the session dispatched the orchestrator AND the run left no receipt", so the dispatch detector stays: keep the leading `/ship` and `Skill` arms, rename `tech-lead` to `building`, drop the `Workflow` and Bash-launch arms. Without the detector it blocks nothing it should |
| `SessionStart` echo in `hooks/hooks.json` | 1 line | — | **cut** | nothing; it prints the plugin root |

Hooks fire on tool names, not skill names, so none of the above moves with the layout; only the two
that hard-code `"tech-lead"` (`gate-intake`, `gate-zerowork`) are touched, and both for other reasons.

### 4.3 Agents

The plugin defines no agents; its sub-agents are the dispatches a run makes.

| Sub-agent | Today | Under the loop |
|---|---|---|
| couriers (`cmd`, `query`, `advisory` in the run script) | 51 call sites, sonnet, one shell command each | **gone** — the loop has a shell |
| the planning chain | 3 workers, 4–6 dispatches | **no sub-agent** — in the loop, under a fence-only `plan` order so its writes keep a substrate *(amended; confirmed by the PO)* |
| `scope-hammer`, `coach`, `translator` | 1 dispatch each | **gone** — in the loop |
| the `--adversarial-verify` skeptic | optional, off by default | **not carried over** unless asked for — a second reader of the judge's findings is the kind of component `analysis/01` says to add only with an ablation |
| the Preflight canary (`orient` dispatched once to prove the skill resolves) | 1 dispatch | **folded** into the first real orient dispatch: the receipt that dispatch leaves is the same evidence |
| `orient`, `task-executor`, `spec-evaluator`, `qa-edge-hunter` | 1, N×attempts, 1×rounds, 1 | **kept** |

### 4.4 Commands

`/shape`, `/ship`, `/orient`, `/build`, `/eval`, `/qa`, `/hammer`, `/retro`, `/hill` keep their
names and point at the activity instead of the role. `/scopes` and `/wire` — two commands for halves
of one activity — become one `plan` command. Command names are a user-facing contract; nine of eleven
are left exactly as they are.

## 5. Surgery — what must not change, and in what order

**Consumer-facing contracts this layout must not break:**

- `shapeup/knowledge-base/<skill>.md` files that teams have already committed, named after today's
  skills (`relKnowledgeBase` in `kernel/lib/paths.mjs`). The loop reads the old names for the folded
  skills (`ba-pitch-analyzer`, `scope-architect`, `solution-architect` → `plan`; `tech-lead` →
  `building`) and writes new rules under the activity name. Nothing a team wrote goes silent.
- The committed tier (`shapeup/<slug>/…`) — every file name and frontmatter field stays.
- The two kernel grant rules; `scripts/` URLs; the `WorkOrder`/`WorkResult` schemas for the four
  dispatches that remain.
- Command names (§4.4).

**Order, one reversible step at a time, `npm test` green after each:**

0. Write ADR-0004 and have the PO accept it. It supersedes the "one workflow launch" decision in `docs/design/03-system-design.md` §3.5 and is where the retirement of this folder's working record is promised, as ADR-0002 prescribes.
1. Create `building` beside `tech-lead` over a kernel `probe next`, resources moved not rewritten, inside the 155-line ratchet at its new path; `/ship` points at it;
   `tech-lead` stays until a real run has shipped on `building`. (Nothing breaks; two paths exist.)
2. Fold the planning chain into `plan` (decision 4 fixes how much); delete the three skills, their
   `OP_OWNER` rows and `WorkOrderPayload` fields; shrink `WorkerName` and `Operation`. The suite's
   roster and routing checks are what prove nothing dangles.
3. Fold `stop`, `retro`, intake; delete `scope-hammer`, `coach`, `translator`.
4. Hooks: delete `gate-intake`, re-key `gate-zerowork` (about 200 lines), drop the `SessionStart` echo; update
   `hooks.json`, `README.md`, `SECURITY.md`, `docs/design/03-system-design.md` in the same commit
   (the drift check requires all four to agree).
5. Delete `tech-lead` and the run script; the control-plane cut in the review follows from here.
6. Run the `harness-maintenance-audit` skill: it derives the counts and finds what the rename
   missed.
7. Release 4.0.0: both version files, changelog, the shipped `AGENTS.md` block and the counted docs, `claude plugin validate . --strict`, then `npm run verify:cross-dir` and one real nested session that must leave a row in `decisions.jsonl`.

Each step is a commit a reader can revert alone. None changes what a worker writes or where.

## 6. Decisions — the defaults, what each alternative costs, and what was chosen

| # | Decision | Default | Alternative | Cost of the alternative | Decided 2026-11-07 |
|---|---|---|---|---|---|
| 1 | **Names of the four kept workers** | keep `orient`, `task-executor`, `spec-evaluator`, `qa-edge-hunter` as they are | rename to activity verbs (`build`, `evaluate`, `hunt`) | consumer knowledge-base files, `WorkerName`, `OP_OWNER`, `COACHABLE`, 32 + 24 + 3 test files and ~60 doc mentions move — for spelling. Non-regression says no, for now | **default** — names stay |
| 2 | **Intake language** | drop `translator`; the loop reads the pitch in any language and writes every artifact in English, as today | keep a thin `intake.md` resource that still produces `<name>.en.md` copies and a glossary; or write artifacts in the pitch's language | the copy-and-glossary path keeps 360 lines for a step the loop performs by reading; artifacts in another language break the English-only assumption the judge and the lints hold | **alternative 1** — `intake.md` resource; English copy + glossary stay, the dispatch goes |
| 3 | **Hill chart** | keep `hill-chart` and `/hill` untouched, which keeps `reduce hill` *and* `reduce graph` (the dashboard renders the graph) — the review's "cut graph" then waits | cut `hill-chart`, `reduce hill`, `reduce graph` together | a product feature disappears; it is a promise to the PO, not a mechanism — the PO's call | **default** — kept untouched; `reduce graph` stays with it |
| 4 | **How much of planning folds now** | all four steps (`coverage`, `analyze`, `wire`, `map-scopes`) run in the loop as `plan` — one change, one measurement | only `coverage` + `analyze` fold (the `V4-REQ-2` narrowing); `wire` and `map-scopes` stay sub-agents until the handoff trace exists | two implementations of planning for one more release; but it is the measured-first path `analysis/02` argues for | **default** — all four steps |

Smaller defaults, listed so they are not silent: `--adversarial-verify` is not carried over; the
`SessionStart` echo goes; `gate-intake` goes; `gate-zerowork` is re-keyed, not gutted; the
`--tiny` lane becomes flags on the one loop rather than a prose lane of its own; the cross-context
template set is **kept until asked about**, not cut on this evidence. With decision 3, `reduce graph` stays
while `hill-chart` does, and the review's cut of it waits.

## 7. Evidence — re-run these

| Claim | Command | Result on 2026-11-07 |
|---|---|---|
| `shapeup` is activity-shaped | `grep -n "^## WORKFLOW\|^RULE\|^GATE" skills/shapeup/SKILL.md` | 7 workflows, 3 rules, 5 gates |
| 18 operations → owners | `grep -n -A 17 "OP_OWNER = " kernel/compile.mjs` | 12 of 18 belong to the six folded skills; `execute`/`fix`/`spike` are addressed by scope |
| Skill-name literals outside the compiler | `grep -rnE '"(tech-lead\|…)"' kernel hooks bin` | `compile.mjs` 26; everything else ≤ 2 per file; `"tech-lead"` in `gate-intake`, `gate-zerowork`, `init/run.mjs`, `probe/staged.mjs` |
| Knowledge-base files are named after skills | `grep -n relKnowledgeBase kernel/lib/paths.mjs` | `shapeup/knowledge-base/<skill>.md` |
| No archived run used a non-standard lens | `grep -rhoE "lens[\"']?: *[\"']?[a-z-]+" traces` | 93 records, all `standard` |
| Verdicts on record grade two dimensions | `grep -rhoE '"dimension": *"[a-z-]+"' traces` | `spec-conformance` 515, `test-surface-conformance` 97, nothing else |
| Hook entries | `node -p "…hooks.json…"` | SessionStart 1, PreToolUse 5, PostToolUse 1, Stop 1 |
| Hook denials | see the review, §3.3 | `sandbox-guard` 22; `gate-intake` 0; `gate-zerowork` 0 |
