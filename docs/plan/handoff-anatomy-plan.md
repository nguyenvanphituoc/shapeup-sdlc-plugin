# The anatomy of a recoverable handoff — high-level design

- **Item:** stop asking *which tool wins* and ask **what property of state on disk lets a fresh agent
  finish someone else's work.**
- **Predecessor:** `docs/plan/benchmark-p4-crossover-curve-plan.md` (complete; branches B and E
  fired, F-17/F-18/F-19 published). Everything below is derived from its measured record, not from
  a fresh hypothesis.
- **Status:** design. Nothing built, nothing spent.

---

## 0. What the predecessor established, and why it forces a new design

Six results, all measured, that this project is the consequence of:

| # | Finding | Design consequence |
|---|---|---|
| 1 | **Uninterrupted tasks are saturated** — 35/40 runs scored 100%, all arms | Difficulty is not a usable axis. Stop trying to build a harder feature. |
| 2 | **All variance comes from the interruption** — 42 of 47 failing rows are interrupted halves | The interruption is the instrument. Keep it; make it controlled. |
| 3 | **The arm is a probabilistic trigger, not a mechanism** — fires 3/3 on Haiku, 3/8 on Sonnet | Comparing *products* measures mechanism × trigger-rate. Fatal confound. **Must be removed by construction.** |
| 4 | **Conditioned on the write, the effect is near-deterministic** — 100% ×6 vs exactly 19% ×6, p = 0.004 | The outcome variable has enormous dynamic range. n=3 buys real power *if* the noise is removed. |
| 5 | **The richer artifact did worse** — 3.5 KB verbatim → ~100%; 8.9 KB structured spec → 0/3 | The obvious hypothesis "more state is better state" is contradicted by the only data we have. Confounded, and that confound is the brief. |
| 6 | **Real compaction is unreachable** (branch E, $14.74) | Do not design around compaction. Use an interruption that exists. |

**The single most important consequence is #3 and #5 together.** P4 could not tell whether the 8.9 KB
artifact was worse *because it was 8.9 KB* or because the tool that produced it also spent its
window on gates. That question cannot be answered by observing tools. It can only be answered by
**constructing the artifact and holding everything else fixed**.

---

## 1. The design move

> **Phase A stops being an agent session and becomes a fixture.**

P4 measured `agent → artifact → agent`. Every property of the artifact was an *outcome* of the first
agent, so nothing about it could be varied independently, and the first agent's behaviour
contaminated the second's starting conditions.

This project measures `fixture → agent`:

1. **Freeze one real interruption state.** Run session A *once* per scenario, for real, and freeze
   the resulting workspace (partial code, partial tests, whatever the agent actually left). It is
   realistic *because* it is real, and controlled *because* it is frozen and content-addressed.
2. **Inject a constructed artifact** into that frozen state — content, size, format, filename and
   location all chosen by us, generated from one source-of-truth requirement.
3. **Run the recovery session** and score with the existing oracle.

What this buys, in order of importance:

- **The trigger confound disappears.** The artifact is present with probability 1. Finding #3 stops
  being a confound and becomes something we could *test* later, separately.
- **Content becomes an independent variable.** Finding #5 becomes answerable.
- **The starting state is identical across every arm.** P4's arms started from different partial
  code because different agents wrote it. That is gone.
- **Cost roughly halves.** No paid session A per rep — one frozen fixture amortises across every
  cell. Measured control cost was $0.79–0.97 *per pair*; here we pay for session B only.
- **n=3 actually buys something,** because the dominant noise source has been removed by
  construction rather than averaged over.

**The cost of the move, stated up front:** a frozen fixture is one draw from the distribution of
"what an interrupted session leaves behind." Conclusions are conditional on that state. Mitigation is
§4's F-factor — three *different* frozen states — and the honest framing is "given this interruption
state," never "in general."

---

## 2. The question, and the non-goals

**Question.** Given a fresh agent, a frozen interrupted workspace, and one artifact on disk: which
properties of that artifact predict how much of the remaining work it finishes?

**Explicit non-goals**, so scope cannot drift:

1. **No harness comparison.** No product is under test. `shapeup-sdlc`, spec-kit, OpenSpec and cc-sdd
   do not appear. The author's tool is not in this experiment, which removes §0's conflict clause
   from the critical path entirely.
2. **No new features.** F4/R3 and its committed contract are reused unchanged. The oracle is reused.
3. **No model judge.** Ever.
4. **No claim about uninterrupted work.** Finding #1 says that axis is dead; this project does not
   revisit it.
5. **No compaction.** Branch E settled it.

---

## 3. Architecture

### 3.1 What is reused unchanged

The predecessor's instrument is the asset, and most of it survives:

| Component | Role | Change |
|---|---|---|
| `oracle/` | deterministic, dependency-free, self-tests before every run | none |
| `runner/lib/session.mjs` | session spawn, cap enforcement on the runner's own clock, `--resume` refusal | none |
| `runner/lib/transcript-metrics.mjs` | narration, writes, `turns_to_first_write`, stalls | none |
| `runner/stats.mjs` | Fisher exact, both units of analysis, interval disjointness | none |
| `runner/aggregate.mjs` | cell grouping, refuses ordering on overlap | new grouping key |
| `runner/run-across-windows.sh` | survives rate-limit windows unattended | none |
| PROTOCOL + committed gate scripts | pre-registration; the decision rule ships before its data | none — this is the discipline that fired two kill gates and saved ~$95 |

### 3.2 What is new

```
  scenario/                     ← NEW. the fixture layer
    <scenario>/
      state/                    frozen workspace: partial code as one real agent left it
      state.sha256              content address — the identity term for every row
      provenance.json           which session produced it, transcript path, when, at what cut
  artifacts/                    ← NEW. the treatment layer
    build.mjs                   one requirement → N artifact variants, byte-controlled
    variants/<id>.json          {content_kind, bytes, path, format, seed_text}
  runner/recover.mjs            ← NEW. fixture + variant → one scored recovery session
  runner/place.mjs              ← NEW. copy fixture, inject variant, verify hash, hand off
```

**Three architectural rules, each descended from a defect the predecessor actually shipped:**

1. **Single writer.** Exactly one script appends to `results/`. P4's `ingest-result.mjs` rule,
   carried over — two writers is how a completion vanishes.
2. **Every identity term in the key, or the run refuses.** Nine documented defects in the predecessor
   were *one missing term in an identity key* — model, build, cap, transcript stamp. Here the key is
   `scenario_sha · variant_id · model · cap · rep`, and `place.mjs` **fails closed** if the fixture
   hash does not match `state.sha256` after injection. A fixture that drifted is not a fixture.
3. **The artifact is content-addressed too.** `variant_sha` on every row. The predecessor's pack
   cache silently served a stale build until it was keyed by shipped-surface hash; the same failure
   mode is available here and is closed the same way.

### 3.3 Data model

One row per recovery session:

```
scenario_sha, variant_id, variant_sha, content_kind, artifact_bytes, artifact_path,
model, cap_b_s, rep,
acceptance_at_fixture,     ← constant per scenario, measured once, asserted every run
first_pass_acceptance,
gap_closed,                ← (after − at) / (1 − at)
turns_to_first_write, assistant_turns, narration_ratio, cost_usd, transcript
```

`acceptance_at_fixture` being **constant by construction** is the check that the fixture is doing its
job. If it ever varies, the fixture is not frozen and the run is void — that is a mechanical
assertion, not a review step.

---

## 4. Experimental design

### Factors

| Factor | Levels | Why |
|---|---|---|
| **C — content kind** | `verbatim` (the requirement, copied) · `summary` (prose) · `criteria` (acceptance checklist) · `plan` (next actions) · `spec` (structured, section-headed) · **`none`** (control) | The unrun S2 question, plus the 8.9 KB spec that lost. This is the primary factor. |
| **S — size** | ~1 KB · ~3.5 KB · ~9 KB, holding content kind at `verbatim` | Directly tests finding #5 with the confound removed. 3.5 KB and 9 KB are the two sizes actually observed. |
| **L — location** | repo root `HANDOFF.md` · `docs/HANDOFF.md` · `.state/handoff.md` (dotdir) | Discoverability. A fresh agent must *find* it; a dotdir is where most tools put it. |
| **F — fixture** | 3 frozen states from the same feature at the same cut | Guards against conclusions that are properties of one lucky workspace. |

**Not a full factorial.** 6 × 3 × 3 × 3 = 162 cells is not affordable and not necessary. Staged
one-factor-at-a-time, cheapest and most decisive first, each stage gated (§5).

### Outcome and unit

- **Outcome:** `gap_closed`, the predecessor's measure — of what remained at the fixture, how much the
  fresh agent finished. Range is known to be enormous (0% → 100%).
- **Unit of analysis: the variant.** Not the row, not a product. Rows within a variant are repeats
  and are treated as such — this is K1's lesson applied at design time instead of as a correction.
- **Ordering rule:** interval disjointness on n=3, as in `gate-s1.mjs`. Overlap claims nothing.

### Registered baseline

`none` must reproduce **19%**. Six of six rows in the predecessor closed exactly 19% with no artifact.
If the control does not land there, the fixture does not represent the state P4 measured and the
project stops until that is explained. **This is the cheapest possible check that the whole apparatus
is measuring what its predecessor measured**, and it is the first thing bought.

---

## 5. Staging and kill gates

Every stage opens with the cheapest thing that can refute it. Decision rules are committed as code
**before** their data, and the pipeline branches on exit status — the mechanism that fired branches
B and E without argument.

| Stage | What it buys | Sessions | Est. | Kill gate |
|---|---|--:|--:|---|
| **S0** Fixture + oracle wiring | 3 frozen states, hashes, `acceptance_at_fixture` measured | ~3 | **~$3** | fixture acceptance not constant across replays ⇒ stop, fix, no science |
| **S1** Baseline reproduction | `none` and `verbatim` at 3.5 KB, one fixture, n=3 | 6 | **~$4** | **`none` ≠ ~19% or `verbatim` ≠ ~100% ⇒ STOP.** The apparatus does not reproduce a known result; nothing downstream is interpretable |
| **S2** Content (the primary question) | all 6 content kinds, one fixture, n=3 | 18 | **~$12** | all kinds indistinguishable ⇒ **publish "content is irrelevant, only presence matters"** and stop. That is a complete, useful, publishable answer |
| **S3** Size | `verbatim` at 1 / 3.5 / 9 KB, n=3 | 9 | **~$6** | — |
| **S4** Location | best content kind × 3 locations, n=3 | 9 | **~$6** | — |
| **S5** Fixture generality | winning + control across the other 2 fixtures, n=3 | 12 | **~$8** | result does not hold across fixtures ⇒ publish as fixture-specific, which is still a finding |
| **S6** Publication | findings, protocol, report | 0 | $0 | — |

**Total ~$39.** Two gates stop it under $16, and both stopping outcomes are publishable.

Note the shape, deliberately copied from the predecessor: **the two cheapest stages decide whether
the rest happens.** S1 at ~$4 gates ~$32.

---

## 6. Pre-registered predictions

Written before anything is built, so they can be wrong on the record.

1. **`none` reproduces 19% ± the oracle's granularity.** Highest confidence. If not, the apparatus is
   broken.
2. **Content does not matter much — presence does.** `verbatim`, `summary`, `criteria` and `plan` land
   within one interval of each other, and all four beat `none` decisively. This is the least
   interesting outcome and the one I expect.
3. **`spec` (9 KB, structured) is NOT better than `verbatim` (3.5 KB), and may be worse.** Directly
   from finding #5, now unconfounded. If it wins, the predecessor's most damaging paragraph about
   structured specs needs qualifying and I will say so.
4. **Size has a ceiling, not a slope.** 1 KB < 3.5 KB, but 3.5 KB ≈ 9 KB. More state stops helping
   once the requirement is fully present.
5. **Location matters more than anyone expects.** A dotdir artifact underperforms a repo-root one,
   because a fresh agent's first move is `ls`. If true, this is the most immediately actionable
   result in either project — and it is the one nobody is currently measuring.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| **A frozen fixture is one draw** — conclusions may be properties of that workspace | S5 buys two more fixtures; every claim is phrased "given this interruption state" until S5 says otherwise |
| **Injected artifacts are unrealistically clean** — no real agent writes exactly 3.5 KB of well-formed prose | `verbatim` is *literally what `bare-intake` produced* (3510 B, in the record). The others are generated from the same source text. Realism is anchored to a measured artifact, not invented |
| **The oracle saturates again** | It will not: the fixture is chosen at a cut where acceptance is ~38%, leaving 62% of the gap open. The dynamic range is measured, not hoped for |
| **This is a benchmark of nothing, since no product is tested** | That is the point. The output is a property of artifacts, which every agent system can act on, rather than a ranking that is stale the next release |
| **Cheap stages tempt over-running** | Gates are code, committed first, branched on by exit status. The predecessor's two gates fired and left ~$95 unspent |
| **Author bias** | Structurally reduced: the author's tool is not an arm. The only prediction that flatters him is #3, and it is registered as the one he expects to be *unable* to confirm cleanly |

---

## 8. What this can and cannot conclude

**Can:** whether the *content*, *size* and *location* of externalised state change how much of a task
a fresh agent completes, on a real frozen interruption, at a known cost, with the trigger confound
removed by construction.

**Cannot:** anything about uninterrupted work (dead axis, finding #1); anything about compaction
(unreachable, finding #6); anything about which SDD product to buy (not measured, deliberately).

**The one-sentence output this is aiming at**, in the shape the predecessor's best result took:

> *Write the requirement down, put it where `ls` finds it, and stop at about three kilobytes —
> everything past that is ceremony.*

If S2 says content is irrelevant, the sentence gets shorter and is worth more.

---

## Appendix — why not the alternatives

| Alternative | Why not |
|---|---|
| Harder features, to fix the ceiling | Treadmill. F4/R3 already saturates 1800 s for the heavy arms, cost per cell climbs sharply, and the model improves under you between rounds |
| Rate-limit interruption as the axis | Genuinely attractive — 363 real events were logged — but it is a *different* project: the interruption becomes uncontrolled in timing, which is exactly what this design removes. Worth doing after, not instead |
| Keep benchmarking products | Answered: 1 better, 5 worse, 18 identical across 24 cells, $183. Continuing measures release notes, not mechanisms |
| Ship the finding as a tool and stop measuring | The finding is one sentence and already published. A tool adds nothing until §6's questions are answered |
