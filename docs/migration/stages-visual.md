# What each stage buys you — and what the harness becomes when they're all done

**Question:** What does each remaining stage buy, and what is the harness once they are all done?
**Scope:** Figures only. This is the companion to `docs/migration/remaining-stages-plan.md` (the
work, the acceptance rows, the guardrails) and `docs/migration/status-review-2026-08-10.md` (the
evidence and the position). The finding, the negative space, the recommendation and the falsifiers
live in those two — deliberately not restated here.
**Sources:** repo state at `c469a6c`, 2026-08-10; `npm test` green at 1168 checks.
**Confidence:** High — every figure redraws something verified in the review; no new measurement is
introduced. **Validity:** re-check any figure whose cited `file:line` has moved.

**Every figure states one claim.** Nothing here is a new measurement — the numbers are the ones
already on disk at `c469a6c`, cited where they appear.

---

## Where the migration actually stands

The execution contract has 23 acceptance rows. It reports 17 PASS. Two of those passes are
produced by text that predates the branch, so the honest figure is 15.

```mermaid
sankey-beta
Contract rows,Honest PASS,15
Contract rows,False PASS,2
Contract rows,RED,6
Honest PASS,S0 + S1 complete,9
Honest PASS,S2 + S3 partial,6
False PASS,Stage A fixes the gauge,2
RED,Stage A writes,4
RED,Stage B writes,1
RED,Stage C decides,1
```

**The claim:** six red rows, and **every one is a file that was never written — not a behaviour
that fails.** Four are closed by Stage A, one by Stage B, one is a decision. The two false passes
are the reason the run has been navigating by a gauge reading two rows high on exactly the stage it
had not started.

---

# Stage A — the gauge stops lying, and the one untested failure class gets tested

**Cost: ~2–3 h, $0 external.** Rows R1–R6.

## A.1 · Two contract rows cannot fail

```mermaid
flowchart LR
  subgraph asis["As-is — the row passes, the work does not exist"]
    direction LR
    RA["row:<br/>grep -qi pin<br/>CHANGELOG.md"] -->|"matches"| HIT1["CHANGELOG.md:65<br/>'**Pinned:**'"]
    HIT1 -->|"from the"| OLD["1.6.2 entry<br/>dated 2026-08-05"]
    OLD -.->|"proves nothing about"| WANT1["the cutover<br/>rollback statement"]
  end
  subgraph tobe["To-be — the row can only pass if the entry was written"]
    direction LR
    RB["row:<br/>grep -q<br/>'no in-tree prose lane'"] -->|"matches"| HIT2["the cutover entry<br/>or nothing"]
    HIT2 -->|"proves"| WANT2["the rollback<br/>was stated"]
  end

  classDef bad fill:#fde2e2,stroke:#c33,stroke-width:2px
  classDef good fill:#dff0d8,stroke:#3c763d,stroke-width:2px
  class HIT1,OLD bad
  class HIT2,WANT2 good
```

**The claim:** a row that matches pre-existing text scores work nobody did. The same defect sits in
`grep -rqli 'gate-zerowork' tests/` — it matches three test files that predate the branch — and in
`grep -qiE 'kill|resume'`, which **a sentence saying the probe was not run would satisfy.** Stage A
replaces all three. R3's replacement is a literal status line, `kill-resume-probe: PASS|FAIL|NOT-RUN`,
so "not run" gets *recorded* rather than inferred from absence.

## A.2 · The kill/resume probe — the failure path nobody has driven

This is the class the whole migration exists to retire, and it has never been tested.

```mermaid
sequenceDiagram
  autonumber
  participant PO as Operator
  participant S1 as Session 1
  participant WF as shapeup-run.js
  participant D as Disk (.shapeup/)
  participant S2 as Session 2 (fresh)

  PO->>S1: launch Workflow
  S1->>WF: run
  WF->>D: receipt, orders/, results/, t0/trials.jsonl
  Note over WF,D: scope A green · scope B mid-attempt
  PO--xS1: kill mid-BUILD
  Note over S1: context gone — the prose lane<br/>lost the plan here (82–120 turn class)
  PO->>S2: relaunch, SAME args
  S2->>WF: run
  WF->>D: fast-forward reads phase from disk
  D-->>WF: scope A already green (T0 citation intact)
  Note over WF: assert: orders/ minus results/ is empty<br/>before proceeding
  WF->>D: resume scope B only
```

**The claim:** step 6 is where the prose orchestrator lost everything and the workflow lane is
supposed to lose nothing. Steps 9–11 are the assertion. **Never run.** If it fails, A3 is not green,
S2's ship gate was never met, and every Stage B item unwinds — which is why the plan makes this a
stop, not a warning.

## A.3 · The hook documents an arm it does not have

```mermaid
flowchart TB
  subgraph now["As-is — hooks/gate-zerowork.mjs at c469a6c"]
    direction TB
    N1["Stop event"] --> N2{"Skill(tech-lead)<br/>in this session?"}
    N2 -->|"no"| N3["defer — not a harness session"]
    N2 -->|"yes"| N4{"receipt on disk?"}
    N4 -->|"yes"| N5["allow"]
    N4 -->|"no"| N6["BLOCK — zero work"]
    N7["Workflow(shapeup-run)<br/>tool_use"] -.->|"not matched at :69-74<br/>not in WORK_TOOLS :66"| N2
  end
  subgraph after["To-be — Stage A.3, plus its fixture"]
    direction TB
    M1["Stop event"] --> M2{"Skill(tech-lead)<br/>OR Workflow(shapeup-*)?"}
    M2 -->|"no"| M3["defer — unchanged"]
    M2 -->|"yes"| M4{"receipt on disk?"}
    M4 -->|"yes"| M5["allow"]
    M4 -->|"no"| M6["BLOCK — zero work"]
  end

  classDef bad fill:#fde2e2,stroke:#c33,stroke-width:2px
  classDef good fill:#dff0d8,stroke:#3c763d,stroke-width:2px
  class N7 bad
  class M2 good
```

**The claim:** `SKILL.md:12-14` already tells operators the hook blocks a session leaving *"neither a
receipt NOR a `Workflow` tool_use naming `shapeup-run`"*. The dotted edge is the arm that does not
exist. Exposure is small — the receipt decides the block, and `init-run.mjs` writes it first — but
this is **an invariant living in a prompt**, which `AGENTS.md` says must never happen. Verified
against HEAD: `dispatchedOrchestrator(<Workflow event>)` returns `false` today.

---

# Stage B — one round loop instead of two, and a rollback story that is true

**Cost: ~2–3 h, $0.** Rows R7–R11.

## B.1 · The verified implementation is the one that does not run

```mermaid
flowchart LR
  subgraph b_now["As-is — two loops, one reachable"]
    direction LR
    SK1["SKILL.md"] -->|"launches"| RUN1["shapeup-run.js<br/>694 ln · round loop INLINED"]
    BR1["shapeup-build-round.js<br/>418 ln · round loop"] -.->|"nothing launches it"| RUN1
    T1["structural #16:65-68"] -->|"asserts file EXISTS"| BR1
    P1["Stage 1 negative probe<br/>breaker: inner"] -->|"verified"| BR1
  end
  subgraph b_next["To-be — one loop, and the probe points at it"]
    direction LR
    SK2["SKILL.md"] -->|"launches"| RUN2["shapeup-run.js<br/>the only round loop"]
    T2["structural #16<br/>D5 floor + path discipline"] -->|"asserts behaviour"| RUN2
    P2["negative probe<br/>re-pointed"] -->|"verifies"| RUN2
  end

  classDef bad fill:#fde2e2,stroke:#c33,stroke-width:2px
  classDef good fill:#dff0d8,stroke:#3c763d,stroke-width:2px
  class BR1,T1,P1 bad
  class RUN2,P2 good
```

**The claim:** `stage1-evidence.md`'s breaker probe exercised `shapeup-build-round.js:351`;
production takes `shapeup-run.js:593`. **The Stage-1-verified implementation is not the one that
runs**, and the only thing keeping the dead file alive is a test asserting it exists. That is
`fd5ad3d`'s class — *"board-derive's entry point was dead, and testing its parts could not see it"* —
recurring one layer up.

**The honest cost is the arrow, not the deletion.** Re-pointing the probe means driving a run
through ORIENT → WIRE → MAP SCOPES to reach BUILD. Budget that, not the `git rm`.

## B.4 · What "pin the previous release" actually reverts

```mermaid
flowchart LR
  PIN(["user pins<br/>the previous release"]) --> R1["scoped lane<br/>reverts to prose"]
  PIN --> R2["--tiny lane<br/>UNCHANGED — prose by design"]
  PIN --> R3["day2 ratchet work<br/>af99937 · 24 of 46 files"]
  R3 -->|"unanticipated by Rev A"| WARN["a user pinning to fix a<br/>workflow bug loses the<br/>ratchet changes too"]

  classDef warn fill:#fcf8e3,stroke:#8a6d3b,stroke-width:2px
  class R3,WARN warn
```

**The claim:** the CHANGELOG cannot say "there is no in-tree prose lane" — that is false for
`--tiny` and pre-scope-contract specs — and it cannot describe the rollback as migration-scoped,
because `af99937` merged unrelated work onto the branch. Both corrections ship in B.4, alongside
the `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` hazard, which is documented nowhere today and turns a
truncated headless run into an exit-0 success.

---

# Stage C — the fork, recorded either way

**Cost: $0 on C1 · $40–60 on C2.** Row R12.

```mermaid
flowchart TB
  START(["Stage B green"]) --> PROBE["node .plan-runs/day2-rev5/<br/>s3-feasibility.mjs"]
  PROBE -->|"exit 3 — C1,C2,C3 NO<br/>(state at 2026-08-10)"| C1["C1 · ship, defer A7"]
  PROBE -->|"exit 0 — bench reachable"| C2["C2 · run both arms<br/>n=3 Sonnet-matched"]
  C1 --> REC1["stage3-evidence.md:<br/>A7: DEFERRED + blocker codes"]
  C2 --> REC2["stage3-evidence.md:<br/>A7: PASS or FAIL + both run logs"]
  REC1 --> MERGE(["PO merges the cutover"])
  REC2 -->|"candidate below control"| HOLD["merge waits —<br/>re-open the §7 falsifier"]
  REC2 -->|"candidate at or above"| MERGE

  classDef good fill:#dff0d8,stroke:#3c763d,stroke-width:2px
  classDef warn fill:#fcf8e3,stroke:#8a6d3b,stroke-width:2px
  class C1,REC1 good
  class HOLD warn
```

**The claim:** the recommended path is C1, and its whole content is that **"A7 passed" must not be
reachable by grep.** The precedent is on record: day2's S3 hit this exact blocker and its
`RESUME.md` reads *"No number was invented in the meantime."* The one condition is that Stage A.2
actually ran — deferring the cost question while also skipping the correctness probe rests the
cutover on two unrun tests.

---

# Stage D — Phase 2: the invariants move down a layer

**Not part of the cutover.** A separate release, listed so the arc is visible.

## D.1 · The enforcement ladder — where each invariant lives

> **Corrected 2026-08-10.** An earlier revision of this figure claimed declared `agents/*.md` would
> convert four invariants from prose to runtime. **Two of the four do not survive inspection** —
> `Agent(plugin:name)` whitelists restrict delegation that never happens (the workers are leaves),
> and `tools:` restricts tool *names*, not paths, so it cannot remove board reach. The agents spike
> was proposed and **rejected**. What follows is the finding that replaced it.

**No hook enforces single-writer.** `hooks/sandbox-guard.mjs:17-18` says `.shapeup/<slug>/` writes
are *"always allowed … the doer is REQUIRED to write"* — and `safety-spine` guards the machine and
the git remote, not the board. So any worker can write the board, the ledger and the verdicts today.

```mermaid
flowchart LR
  subgraph j_now["As-is — D6 is true by prose, not by mechanism"]
    direction LR
    A1["any worker<br/>Write / Edit available"] -->|"writes product code"| A2["substrate"]
    A1 -->|"could also write"| A3[(".shapeup/&lt;slug&gt;/<br/>board · ledger · verdicts")]
    GUARD["sandbox-guard:17<br/>'always allowed'"] -.->|"declines to stop it"| A3
  end
  subgraph j_next["To-be — narrow the exemption"]
    direction LR
    B1["any worker"] -->|"writes product code"| B2["substrate"]
    B1 -.->|"Write / Edit DENIED"| B3[(".shapeup/&lt;slug&gt;/<br/>board · ledger · verdicts")]
    ING["ingest-result.mjs<br/>writes via node fs"] -->|"not a Write tool call<br/>passes through"| B3
  end

  classDef bad fill:#fde2e2,stroke:#c33,stroke-width:2px
  classDef good fill:#dff0d8,stroke:#3c763d,stroke-width:2px
  class GUARD,A3 bad
  class ING,B3 good
```

**The claim:** `AGENTS.md` states *"D6 closed: single-writer is mechanically true."* It is true by
the envelope port and worker prose — the hook explicitly declines to enforce it. And the exemption's
own rationale is **stale**: it cites "task-executor P3 status/AC ticks + `tasks/_index.md`," exactly
the writes `ingest-result.mjs` took over at v1.0. Narrowing it is one hook arm plus a fixture — the
same shape as Stage A.3, in the layer already trusted for this class, and it covers `task-executor`
too, which `tools:` never could because it legitimately needs `Write` for product code.

## D.3 · The serialization point that blocks parallel scopes

```mermaid
flowchart TB
  subgraph p_now["As-is — shapeup-build-round.js:270, for (const scope of args.scopes)"]
    direction LR
    S_A["scope A<br/>attempts 1..n"] --> S_B["scope B<br/>attempts 1..n"] --> S_C["scope C<br/>attempts 1..n"]
    LOCK1["git checkout per scope"] -.->|"one working tree"| S_A
    LOCK2[".shapeup/active-scope<br/>SINGLETON"] -.->|"sandbox-guard:102<br/>reads one pointer"| S_A
  end
  subgraph p_next["To-be — fan out, substrates already disjoint"]
    direction LR
    FAN{{"pipeline over scopes"}} --> T_A["scope A"]
    FAN --> T_B["scope B"]
    FAN --> T_C["scope C"]
    FIX1["isolation: 'worktree'<br/>per agent() call"] -->|"solves the tree"| FAN
    FIX2["per-scope pointer<br/>YOUR change"] -->|"solves the singleton"| FAN
  end

  classDef bad fill:#fde2e2,stroke:#c33,stroke-width:2px
  classDef good fill:#dff0d8,stroke:#3c763d,stroke-width:2px
  class LOCK2 bad
  class FIX1,FIX2 good
```

**The claim:** design doc **[D3]** named two blockers and they are no longer equal. *"Branch-per-scope
assumes one tree"* is now a parameter the runtime offers. *"`active-scope` is a singleton"* is
yours, at `hooks/sandbox-guard.mjs:102`, and it is the real one. Both scripts contain **zero**
`parallel()` and **zero** `pipeline()` today.

Why it matters beyond speed: invariant #3 — per-scope write-whitelists, hook-enforced — is capacity
you built and have never spent, and **parallel scopes are the only place the workflow lane can win
A7's comparative bar** (`candidate ≤ control on wall clock`), which it is not allowed to lose. The
one cost number on record runs the other way: candidate **$2.010** vs control **$1.461**, Sonnet
both arms (`stage1-evidence.md`).

---

# The high-level design — what the harness is when all stages are done

## The run, end to end

```mermaid
flowchart TB
  PO(["PO"]) -->|"intake"| SKILL["tech-lead SKILL.md<br/>~121 lines · L0 + pause + L4 only"]
  SKILL -->|"init-run.mjs"| RCPT[("receipt.json<br/>the run's first fact")]
  SKILL -->|"Workflow(scriptPath, RunArgs)"| WF["shapeup-run.js<br/>ORIENT to GATE H"]

  WF -->|"agent(): fresh context,<br/>model from RunArgs"| AG["stateless worker agent<br/>spawned per phase"]
  AG -->|"Skill(worker) --order"| WORK["worker skills<br/>craft only"]
  WORK -->|"WorkResult"| ING["ingest-result.mjs<br/>the ONLY writer"]
  ING --> STATE[("board · ledger · verdicts")]
  STATE -->|"fast-forward reads"| WF

  WF -->|"gate-answers.mjs exit code"| GATE{"0 cross<br/>4 pause · 5 abort"}
  GATE -->|"paused + block"| SKILL
  WF -->|"RunReturn union"| SKILL
  SKILL --> L4["GATE L4 + coach"]

  HOOKS["hooks: sandbox-guard ·<br/>validate-envelope · gate-zerowork ·<br/>gate-deadline"] -.->|"deny at the tool boundary"| WORK
  HOOKS -.->|"deny"| ING

  classDef good fill:#dff0d8,stroke:#3c763d,stroke-width:2px
  classDef key fill:#e8e4f3,stroke:#5b4b8a,stroke-width:2px
  class AG,HOOKS good
  class WF,ING key
```

**The claim:** the skill shrinks to three jobs — open the run, relay gate blocks verbatim, close at
L4. Everything between ORIENT and GATE H is a JS control plane. Workers hold craft and nothing else.
**One writer** touches shared state. Hooks deny at the tool boundary, below every prompt. The two
purple nodes are the invariants the migration bought: control flow in code, and a single writer.

## The pause protocol — how a gate actually crosses

```mermaid
sequenceDiagram
  autonumber
  participant PO as PO
  participant SK as tech-lead skill
  participant WF as shapeup-run.js
  participant GA as gate-answers.mjs
  participant D as .shapeup/

  SK->>WF: Workflow(RunArgs)
  WF->>GA: resolve L1b
  GA-->>WF: exit 4 — ask
  WF-->>SK: {status:"paused", paused_at:"L1b", block}
  SK->>PO: emit block VERBATIM
  PO-->>SK: decision
  SK->>D: write gate-answers.json
  SK->>WF: relaunch, SAME args
  WF->>D: fast-forward — orders minus results is empty
  WF->>GA: resolve L1b
  GA-->>WF: exit 0 — cross
  Note over WF: proceeds; nothing already done is re-dispatched
```

**The claim:** the gate decision is an **exit code**, not a paragraph a model interprets, and the
block text reaches the PO unparaphrased. Step 9 is the property four relaunches already
demonstrated at run 3 — and the one the kill/resume probe still has to prove survives an *ungraceful*
death, not just a clean pause.

## What each stage contributes to that picture

| Stage | What the diagram above gains |
|---|---|
| **A** | The `Workflow(shapeup-*)` arm on `gate-zerowork`; the fast-forward proven against an ungraceful kill; a contract whose rows can fail |
| **B** | One round loop instead of two; a rollback statement that matches what pinning actually reverts |
| **C** | A7 recorded as `DEFERRED` with its blocker codes — or measured |
| **D** | `sandbox-guard`'s stale always-allow narrowed, so D6's single-writer claim becomes mechanical; a token breaker beside the other three; `pipeline()` over scopes once the pointer stops being a singleton |

**Read the arrows that are dotted.** `HOOKS -.-> WORK` and `HOOKS -.-> ING` are the only edges in
the finished design that no prompt can talk its way past. Every stage above is, in the end, about
moving one more claim onto a dotted arrow.
