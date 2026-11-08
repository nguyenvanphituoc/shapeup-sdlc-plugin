# The plugin before and after the engine removal

Two states of the same plugin: the tag `engine-measured` (the tree S3 measured, with the scripted engine) and `plan/single-loop` (the
engine removed). Counts are derived from the trees (`git ls-tree` and `wc -l` at the tag, `find` and `wc -l` now), not copied from prose.
Status and the open PO decision are in `execution-native-first-2026-11-08.md`, section "S4, restated".

## 1. Where the code is

| Group | Before: files / lines | After: files / lines | What happened |
|---|---|---|---|
| `kernel/compile.mjs` | 1 / 1,422 | — | deleted; `order open` replaces the one thing it did that nothing else could (publish the pointer the fence is armed by) |
| `kernel/reduce/` (`ingest`, `board`, `ship`, `hill`, `leftovers`) | 5 / 2,231 | — | deleted; the loop applies a result itself |
| `kernel/probe/` (ten verbs) | 10 / 3,559 | — | deleted; `digest.mjs` stays as a library (118) |
| `kernel/verify/` `spec`, `build`, `budget`, `dispatch` | 4 / 1,668 | — | deleted; `t0`, `envelope`, `skills`, `env`, `ratchet-tree` stay |
| `kernel/init/fit.mjs` | 1 / 203 | — | deleted; `init run` stays and shrinks 774 → 386 |
| `kernel/lib/` `breadboard`, `census`, `plan`, `ratchet`, `requirements`, `schedule` | 6 / 766 | — | deleted; `argv`, `contract`, `floor`, `paths` stay (`contract` 852 → 768, `paths` 553 → 509) |
| `kernel/order.mjs`, `hooks/lib/tier.mjs` | — | 2 / 163 | new |
| the 19 kept modules (`harness`, `gate`, `init run`, `verify` ×5, three hooks and `decision`, `argv`, `contract`, `floor`, `paths`, `digest`, installer, grant) | 19 / 6,692 | 19 / 6,111 | kept; net −581: `init run` −388, `contract` −84, `harness` −45, `paths` −44, `sandbox-guard` −23, `gate` +3 |
| **Kernel, hooks, installer** | **46 / 16,541** | **21 / 6,274** | −10,267 lines = 9,849 deleted whole files + 581 trimmed − 163 added |
| `tests/structural/` modules | 110 / 19,954 | 10 / 779 | 994 lines with the runner and two helpers; 208 checks |
| Kernel subcommands | 24 | 6 | `verify t0 \| envelope \| skills`, `gate`, `init run`, `order` |
| Hook registrations | 4 | 4 | the same four |
| Plugin worker agents | 4 | 4 | the same four |

Not removed: the four worker agents, the oracles, the installer and the skills tree apart from one skill (`skills/` holds 68 markdown files
at both ends). The `hill-chart` skill and the `/hill` command were removed with the only writer of their data.

## 2. Before — the scripted engine (tag `engine-measured`)

The loop skill drove a script layer: it called verbs to compile an order, run the worker, reduce the result onto the board, probe what
to do next, and verify the build. The scripts held the sequencing; the model followed it.

```mermaid
flowchart TD
    PO(["PO"]) --> SHIP["/ship  ·  building skill"]
    SHIP --> H["kernel/harness.mjs<br/>24 subcommands"]

    subgraph ENGINE["Script engine — deleted"]
        direction TB
        COMPILE["compile<br/>1,422 lines"]
        PROBE["probe ×9<br/>next, resume, eval, leg …<br/>3,559 lines"]
        REDUCE["reduce ×4 + leftovers<br/>ingest, board, ship, hill<br/>2,231 lines"]
        VSPEC["verify spec · build · budget · dispatch<br/>1,668 lines"]
        FIT["init fit · lib: plan, census,<br/>schedule, requirements …<br/>969 lines"]
    end

    subgraph KEPT["Kept"]
        direction TB
        RUN["init run<br/>receipt + launch record"]
        GATE["gate<br/>resolver, exit 0/4/5"]
        T0["verify t0<br/>ratchet witness"]
        ENV["verify envelope<br/>schema check"]
        SK["verify skills"]
    end

    H --> ENGINE
    H --> KEPT
    COMPILE -->|"writes order +<br/>arms the pointer"| FENCE
    REDUCE -->|"applies result<br/>to board"| BOARD[(".shapeup/ board")]
    PROBE -->|"tells the loop<br/>the next step"| SHIP

    subgraph HOOKS["Hooks — 4 registrations"]
        direction TB
        FENCE["sandbox-guard<br/>write fence"]
        SPINE["safety-spine"]
        RCPT["dispatch-receipt"]
        ENVH["verify envelope<br/>as a hook"]
    end

    SHIP --> W["4 worker agents<br/>orient · task-executor ·<br/>spec-evaluator · qa-edge-hunter"]
    FENCE -. "refuses writes outside<br/>the live order" .-> W
    W --> RCPT

    classDef gone fill:#fbeaea,stroke:#a32d2d,color:#501313;
    classDef kept fill:#e1f5ee,stroke:#0f6e56,color:#04342c;
    class COMPILE,PROBE,REDUCE,VSPEC,FIT gone;
    class RUN,GATE,T0,ENV,SK,FENCE,SPINE,RCPT,ENVH kept;
```

## 3. After — one loop, five mechanisms (`plan/single-loop`)

The loop skill sequences the phases itself, in the session. The kernel keeps only what a prompt cannot be trusted to do: the receipt, the
gate answer, the T0 witness, the fence and the dispatch receipt.

```mermaid
flowchart TD
    PO(["PO"]) --> SHIP["/ship  ·  building skill<br/>phase table 0–15 + resources/orders.md"]
    SHIP --> H["kernel/harness.mjs<br/>6 subcommands"]

    subgraph K["Five runtime mechanisms"]
        direction TB
        M1["1 · Receipt<br/>init run"]
        M2["2 · Gate resolver<br/>gate"]
        M3["3 · T0 witness<br/>verify t0"]
        M4["4 · Write fence<br/>order open · close<br/>+ sandbox-guard"]
        M5["5 · Dispatch receipts<br/>dispatch-receipt hook"]
    end
    H --> M1 & M2 & M3 & M4
    SHIP -->|"1 · write the order"| M4
    M4 -->|"2 · spawn the agent"| W["worker agent<br/>(plugin agent, preloaded skill)"]
    W -->|"3 · result file"| ENV["verify envelope<br/>send back once"]
    ENV -->|"4 · loop applies it:<br/>board · ledger · verdict"| SHIP
    W --> M5
    SHIP --> M2
    SHIP --> M3

    classDef loop fill:#eeedfe,stroke:#534ab7,color:#26215c;
    classDef kept fill:#e1f5ee,stroke:#0f6e56,color:#04342c;
    class SHIP,PO loop;
    class M1,M2,M3,M4,M5,ENV kept;
```

## 4. What moved from a script to the loop

| Step | Before (script) | After (the loop, in its own session) | Still checked mechanically? |
|---|---|---|---|
| open a run | `init run` | `init run` | yes — receipt, floor and roster refusals |
| write and arm an order | `compile` | write from the template, then `order open` | yes — schema check, time stamp, pointer read back |
| decide the next step | `probe next`, `probe resume` | the phase table in the skill | no |
| apply a worker's result to the board | `reduce ingest`, `reduce board` | the loop edits the board | no — result shape only, via `verify envelope` |
| lint the spec | `verify spec` | the loop reads the plan back | no |
| count attempts against a budget | `verify budget`, `probe attempts` | the loop | no |
| build and launch before EVAL | `verify build` | the loop runs the profile's commands | no |
| census and ship report | `reduce ship` | the loop, in `stop.md` | the L4 gate reads the census file |
| T0 per scope | `verify t0` | `verify t0` | yes — ratchet, artifact hash |
| gates | `gate` | `gate` | yes |
| end a run | `reduce ship` | `order close` (writes `close.json`, retires the pointer) | yes |

The right-hand column is the cost of the removal in one line: seven rows moved from "script" to "loop's discipline, checked by the PO and
the evaluator". The one real run on the new tree shipped, at $18.2 against $5.4 for the engine's runs, with QA skipped by the loop's own
call (one repetition; not a rate).
