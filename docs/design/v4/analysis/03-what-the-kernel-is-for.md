# 03 — Which parts of the kernel does a model make unnecessary, and which parts exist because a model cannot be its own witness?

| | |
|---|---|
| **Date** | 2026-11-07 |
| **Baseline** | 4.0.0 at `63478f6` (branch `plan/single-loop`) |
| **Status** | draft — every figure below is derived from the tree or from an archived ledger; no new run was made |
| **Origin** | The maintainer's challenge after the single-loop fold: *"the plugin is too complex — it depends on many scripts; if the WorkResult in/out is just a JSON parse, today's agents are smart enough to handle it."* Answers the first open question `01` left: which parts sit in the "rent" column. |

## Question

Of the shipped kernel, which lines do work a model could do as well in its own window, and which
lines produce something a model cannot produce about itself — a measurement, a witness, a fence?

## Evidence

### Size, by what the code answers

| Claim | Command | Result |
|---|---|---|
| Shipped executable code | `find kernel hooks bin -name '*.mjs' \| xargs wc -l` | 52 files, **18,736** lines |
| Structural tests | `cat tests/structural/*.mjs \| wc -l` | 115 files, **21,872** lines (ratio 1.17 : 1) |
| The loop's own instructions | `wc -l skills/building/SKILL.md` | 112 lines, plus 7 `resources/*.md` |
| The envelope — the "JSON parse" | `wc -l kernel/verify/envelope.mjs kernel/schemas/work-{order,result}.schema.json` | 288 + 65 + 78 = **431 lines, 2.3 %** of the executable set |

Kernel lines by verb (`for d in verify reduce probe init report lib; do cat kernel/$d/*.mjs \| wc -l; done`):

| Verb | Lines | Largest modules |
|---|---|---|
| `probe` | 3,923 | `resume` 1,207 · `next` 810 · `eval` 403 · `requirements` 328 |
| `verify` | 3,732 | `spec` 975 · `t0` 714 · `trace` 604 · `build` 428 · `envelope` 288 |
| `reduce` | 2,708 | `ingest` 866 · `ship` 529 · `graph` 482 · `board` 350 · `hill` 322 |
| `lib` | 2,437 | `contract` 852 (Markdown ⇄ JSON for scope contracts) · `paths` 571 |
| `compile` | 1,422 | order assembly: substrate templates, trial history, bugs from verdicts, T0 list, dimensions |
| `init` | 978 | `run` 775 |
| `report` | 619 | `export` 384 |
| `gate` | 555 | |
| hooks | 1,509 | `sandbox-guard` 500 · `safety-spine` 333 · `gate-zerowork` 316 |

### What the enforcement layer has ever refused

Every `decisions.jsonl` under `traces/` and the live consumer run, 2026-11-07
(`find traces -name decisions.jsonl -exec grep -h '"deny"' {} +`, tallied by `hook / rule`):

| Rows written | Denies | By rule |
|---|---|---|
| 6,861 (archived) + 258 (consumer) | 25 + 1 | `sandbox-guard / outside-substrate` 22 + 1 · `validate-envelope / order-missing` 3 |

`tier-guard`, `safety-spine` and the Stop hook have **no deny or block on any ledger** on file. The
single deny of the last real run was the loop writing a scratch script outside the live order's
substrate — the fence working, on the orchestrator, not on a worker.

### The three classes, by who the code protects against

Derived by reading each module's header and the hook it serves, then asking what a model in the
loop's window could not have produced honestly. Line counts are the module totals above.

| Class | Protects against | Modules | Lines | Could a smarter model replace it? |
|---|---|---|---|---|
| **A — witness** | the model reporting on itself | `verify t0` (runs fixtures, sha256 of artifacts), `dispatch-receipt`, `sandbox-guard`, `gate` (answer file, source ledgered), the leg row in `ingest`, `verify envelope`, `probe attempts` | ≈ 2,900 | **No.** Trust-limited, not intelligence-limited. A stronger model is still the party being measured. `01` and `02` both keep the separate judge for this reason. |
| **B — memory and sequencing** | the model forgetting across a kill, or advancing on its own account | `probe next`, `probe resume`, `init run`, `reduce board`, the rest of `ingest`, `compile` | ≈ 5,400 | **Partly.** The *data* (orders, results, receipts, ledgers on disk) is what survives a kill and must stay. The *decision engine* over it — 2,000 lines in `next` + `resume` that read those files and say "the next step is X" — encodes a procedure in code. The kit's rule puts procedure in skills and hard limits in tools; this is procedure in a tool. It buys determinism (V4-REQ-7) at the price of a state machine the model must be taught (`building` + 7 resource files). |
| **C — projection and format tax** | the model formatting inconsistently; a reader wanting a view | `reduce graph`, `reduce hill`, `report export` + `facts`, `probe digest`, `probe stats`, `probe requirements`, `verify trace`, `lib/contract` (Markdown ⇄ JSON), most of `lib/paths` | ≈ 4,600 | **Yes, or drop.** None of these gates anything; AGENTS.md calls the matrix "a projection, never a verdict" and the graph "derived, can be deleted and rebuilt". `contract.mjs` exists only because contracts are Markdown on disk and JSON on the wire. No ablation of any of them is on record. |
| **D — the plugin's own lint** | drift between prose and code | `verify spec` (975), `verify skills`, `verify build` | ≈ 1,600 | **Mixed.** `spec` is a spec-lint that stops L1b on a missing screen or an unglossed id; it has caught real defects (execution record, "No-gos registered as requirements"). `build` runs the profile's probes — class A in effect. |

### What the maintainer's premise gets right and wrong

| Premise | Holds? | Evidence |
|---|---|---|
| "WorkResult in/out is just a JSON parse" | Yes, for the envelope | 431 lines, 2.3 % of the set; the last run's eight results validated first time |
| "so agents can handle it" | Yes, the parse | The model already writes every result; `verify envelope` only refuses a malformed one (3 refusals in 7,119 rows) |
| "so the scripts are unnecessary" | No, for class A | T0 hashes artifacts the judge must re-hash; a receipt is written by a hook the worker cannot reach; the fence denied 23 writes. None of those is a parse |
| "the plugin is too complex" | Yes, for classes B-engine and C | ≈ 6,600 lines (35 %) that decide nothing and have no with/without on file; plus a test suite larger than the code it pins |

### Cost of the kernel at run time, for scale

| Claim | Source | Result |
|---|---|---|
| A shipped run's cost and length | `execution-2026-11-07.md`, A8 (`envlint`, one run, model as the host reported) | $8.03, 15.9 min, 11 legs |
| Kernel calls per leg | `skills/building/SKILL.md` "The loop" | `probe next` → `pre`* → `compile` → dispatch → `ingest` → `then`*: about 5–8 `node` invocations, each sub-second |

The kernel is not where a run's money goes. Its cost is maintenance: 18.7 k lines nobody retires at a
model upgrade, and a fail-OPEN posture (`CLAUDE.md`, "an enforcement layer that fails to load fails
OPEN and silently") whose silent-failure surface grows with every module.

## Finding

The premise is right about the parse and wrong about what the kernel is for. About 2 % of the
executable set parses JSON; a model does that today and did it on every result of the last run.
About 15 % (class A) produces evidence the model cannot produce about itself — a hash of a fixture
run, a receipt a worker cannot forge, a write the worker did not make — and no model upgrade
retires that, because it is a trust boundary, not a capability gap. The complexity that is real
sits in the remaining two thirds: a decision engine (`probe next` + `resume`, ≈ 2,000 lines) that
encodes procedure in code the kit would put in a skill, and ≈ 4,600 lines of projections and
Markdown-to-JSON conversion that gate nothing, serve no hook, and have never been ablated.

Three consequences for v4:

1. **Keep class A as code and keep it small.** It is the "own" column of `01`, measured. Its
   ablation evidence is the deny ledger: `sandbox-guard` earns its lines (23 denies); `tier-guard`,
   `safety-spine` and the Stop hook have zero denies on any ledger and are the first ablation
   candidates V4-REQ-10 asks for.
2. **Reclassify class B into data and procedure.** The files on disk are the resume point
   (V4-REQ-7) and stay. Whether the *next step* must be computed by 2,000 lines of code or can be
   read by the loop from a one-page "what exists, what is open" listing is the with/without `01`
   and `02` both ask for and nobody has run. The risk of moving it to the skill is the one the
   `building` skill names — "never advance on your own account" — and the gates exist to catch
   exactly that class of error.
3. **Class C is not owed to anyone.** Drop or defer until a reader asks: the graph, the hill reducer,
   the export, the digest, the trace oracle. Switch the scope contract to one format so `contract.mjs`
   goes. Each removal is a `verify` the structural suite loses, which is the point: the suite is
   pinning the shape of code whose value is unmeasured.

## Candidate requirements

- `V4-REQ-1`: Every kernel module is classified in its header as witness, memory, or projection,
  and the classification is checked by the structural suite against a list, so a module whose
  class is unknown cannot ship.
- `V4-REQ-12`: A projection module (class C) ships only with a named consumer in a skill or a
  command; one with none is removed in the release that finds it. *(Narrows V4-REQ-6 from
  "has a caller" to "has a reader".)*
- `V4-REQ-13`: A with/without run of the decision engine — `probe next` replaced by a listing of
  open and closed artifacts that the loop reads — on one pitch, one model, one date, two reps,
  held to the kit's "holds" rule (at least as many scopes green, none worse, same gate rows).

## What would change this answer

- A deny from `tier-guard`, `safety-spine` or the Stop hook on a real run. One row moves that hook
  from ablation candidate to class A with evidence.
- The V4-REQ-13 run showing the loop, without `probe next`, skipping a gate, re-dispatching a phase
  that left its artifact, or spending an attempt the census denies. Any one of those keeps the
  engine in code.
- A reader of the graph, the hill, or the export who is not this repo's own test suite.
- A model that can sign its own fixture run. There is none; that is the whole of class A.

## Sources

- The tree at `63478f6`, read with the commands in the tables.
- `traces/**/decisions.jsonl` and the consumer project's `.shapeup/decisions.jsonl`, 2026-11-07.
- [`01-rent-or-own-the-harness.md`](01-rent-or-own-the-harness.md), [`02-single-agent-loop.md`](02-single-agent-loop.md), [`../execution-2026-11-07.md`](../execution-2026-11-07.md).
