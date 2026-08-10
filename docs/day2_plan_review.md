# Proceed — but Stage 4 buys one arm where $1.27 more buys three, and two of the four steps must swap places or the build goes red

**Question:** Should the finalized Day-2 plan be executed as written, and if not, what changes?
**Scope:** The four decisions and four execution steps in the plan, against
`docs/day2_tool_efficacy_review.md`, `evals/failure-classes.json`,
`evals/schemas/day2-failure-class.schema.json`, structural §48, and the benchmark records the plan
proposes to extend. Excludes anything above the Day-2 rung.
**Sources:** this repo @ `bc30d11` (+ the untracked Day-2 report); `/Users/teo/workspace/sdd-harness-bench`
@ `dff1bf2` — author-owned, no git remote; *Graph Engineering* §VI.B, Table II, Table VI and the
Appendix graph-write invariants, read from the supplied PDF. Commit timestamps, benchmark log
mtimes, one simulation of the plan's Stage 2 against the current register, and cost/wall-clock
arithmetic over `results/runs.jsonl` — all run 2026-08-06.
**Confidence:** High on the five defects — each is a timestamp, a schema field, or a simulation
result, and every one is checkable in under a minute. High on the three-arm costing, which is
arithmetic over runs that already happened. Medium on Arm C reproducing the 5/5 baseline; that is
the falsification test, and it may fail, which is the point of running it.
**Status:** Analysis only. Nothing executed, no benchmark run, no register or test file touched.

---

## 0. The finding in one paragraph

The plan's four *decisions* are right, including the one my own report got wrong — I recommended
against Stage 4 and that recommendation does not survive a timestamp check. The runs everyone is
citing finished at **12:37 and 14:26 on 2026-07-27**; the `v1.4.0` commit they are attributed to
(`36521ba`) landed at **16:36 that afternoon**, was never tagged, and the benchmark's
content-addressed build key (`53c02ae`) landed **the next day at 16:17**, replacing a pack cache the
adapter's own comment describes as *"one directory… never invalidated."* Both sides of FC-01's pair
were therefore measured against builds the record cannot identify, which is a stronger argument for
a fresh measurement than any I made. But the plan's four *execution steps* will spend $7.69 to
produce a claim the data still cannot support, and will destroy the old measurement doing it. Three
things are missing and one is out of order: the reduction is **jointly produced by two tools** — with
FC-01's mechanisms present and FC-02's permission grant absent, the narrated rate is 1/3 and Fisher
gives **p = 0.107**, not significant; add the grant and it is 0/3 at **p = 0.018** — and the register
has one `tool` per class and no way to say so; the `Rate` type has no build field, so even a perfect
re-measure records *when* and *with which model* but never *which bytes*; there is no retirement
mechanism, so Stage 4 overwrites the $7.69 result that Day 1 built an entire `superseded` array to
stop happening, and that *Graph Engineering*'s own Appendix forbids in one line — **"Every superseded
object remains addressable."** And Stage 2, landed third as planned, goes red on exactly one row:
**FC-02.baseline**, the one measured rate the plan never mentions dating. **Proceed — but buy three
arms instead of one for $1.27 more, and land the guard last.**

---

## 1. What is actually being asked

Not "is this a good plan" — it is. The decision is narrower and it has money attached: **should the
benchmark iterations be run now, in this order, with this register schema behind them?**

The evaluation criterion is the one the plan itself adopts in decision 4, and it is the right one:
after this work, can a reader trace `reduces: true` back to runs that support it? That converts
into three checkable sub-questions, and the plan passes one:

| Sub-question | Plan as written |
|---|---|
| Will the number be **build-identified** — can a reader say which bytes produced it? | ❌ no field exists to record it (§4.2) |
| Will the number be **attributable** — to FC-01's tool rather than to a bundle? | ❌ single arm cannot separate them (§4.1) |
| Will the previous number remain **addressable** after the re-measure? | ❌ no retirement mechanism (§4.3) |
| Will the suite stay green through the sequence? | ❌ red at step 3 of 4 (§4.4) |
| Is the *direction* right — sampled evidence over structural assertion? | ✅ yes, and it is the plan's best decision |

The last row is why this is an amendment and not a rejection.

---

## 2. Scorecard — the four decisions, then the four steps

**Decisions.** These are judgement calls and three of them are simply correct.

| # | Decision | Verdict |
|---|---|---|
| 1 | Include Stage 4 — measure against v1.6.3 HEAD | ✅ **Right, and more necessary than my report said.** §4.2 |
| 2 | Strict `measured_at`, no `audit-finding` escape hatch | ✅ Right rule, ⚠️ **wrong dating method** — "from git history" writes a fix's date into a field meaning *when measured*. §4.5 |
| 3 | Skip FC-05's withdrawn baseline | ✅ Right. My earlier ranking of it above Stage 4 is superseded by §4.2 |
| 4 | Evidence-scoped: structural impossibility alone is not the exit | ✅ Right — Table II's verb is *reduces*. ⚠️ but it contradicts step 4, which makes a structural claim (§4.6) |

**Execution steps.** These are mechanical, and this is where the plan breaks.

| # | Step | Verdict |
|---|---|---|
| — | Run bench iterations for FC-01 at v1.6.3 | ⚠️ **one arm where three cost $1.27 more** (§4.1) — and must not run before the schema work (§4.3) |
| 1 | Update `failure-classes.json` + `03-system-design.md` | ✅ correct, incomplete — FC-02.baseline omitted (§4.4) |
| 2 | Strengthen `48-day1-day2.mjs` | ✅ correct content, ❌ **wrong position** — land it last (§4.4) |
| 3 | FC-02 current from the 22 guarded entry points | ✅ correct — keep the 22/26 denominators distinct, as the report already flags |

---

## 3. The central finding

**The plan treats "measure it again at HEAD" as the fix for a provenance problem, and provenance is
not a property of when you measure — it is a property of what the record can hold.**

Run Stage 4 tomorrow against v1.6.3 and you get a number with the same three holes the current one
has: no field says which build produced it, no field says what else changed alongside the tool being
credited, and writing it deletes its predecessor. The register's `Rate` type is
`{status, unit, value, n, method, measured_at, model}` — every field about *the sample*, none about
*the subject*. Day 1 has the counterpart and learned it expensively: every result carries a
`fixture_sha`, and §48 refuses to pool across fingerprints because *"a fixture-change or a different
fingerprint is a DIFFERENT instrument and must not be pooled."* Day 2's schema did not inherit it.

This is not a schema-aesthetics complaint. It is the direct cause of why the existing $7.69
measurement cannot settle the question it was bought to settle — and repeating the purchase against
an unchanged schema reproduces the defect at full price. **Four fields and one array, all free, are
what make the money worth spending.** Spend the ~45 minutes on those first and the same $7.69 buys a
result that survives being questioned.

---

## 4. Argued from the numbers

### 4.1 The reduction is produced by two tools, and one arm cannot say which

The benchmark ran the same cell in both configurations. They differ by whether `setup()` writes the
installer permission grant — which is **FC-02's registered tool** (`bin/init.mjs`), not FC-01's:

| Configuration | narrated | acceptance | Fisher vs. the 5/5 baseline |
|---|:--:|---|--:|
| v1.3 pilot, no grant *(FC-01 baseline)* | **5/5** | 29% ×5 | — |
| v1.4 mechanisms, **grant absent** (`v14-haiku-f2.log`) | **1/3** | 14/14, 4/14, 4/14 | **p = 0.107** — not significant |
| v1.4 mechanisms, **grant present** (`v15-haiku-f2.log`) | **0/3** | 14/14 ×3 | **p = 0.018** — significant |

FC-01's tool alone moves the rate and does not clear the bar. The pair that clears it includes
FC-02's tool. Writing `reduces: true` on FC-01 from a single v1.6.3 arm credits one tool with a
result two produced — and the schema has exactly one `tool` object per class, so there is no honest
place to record the entanglement even if you noticed it.

The paper is unusually specific here: §VI.B says *"Add **one** tool that addresses a measured
failure,"* and Table II's exit criterion is per-tool. A bundle reduction is not evidence that either
member reduces the class.

**This is measurable for $0.94.** A second arm at v1.6.3 with the grant withheld isolates it, and it
is cheap precisely because the failure mode is *doing nothing*: the no-grant runs cost $0.612,
$0.205, $0.120. One caveat that must travel with the plan — `setup()` writes the grant
unconditionally (`adapter.mjs:205`), so Arm B needs a small adapter flag, not just a CLI argument.

### 4.2 Why Stage 4 is necessary — the timestamps, which overturn my earlier advice

My Day-2 report recommended against buying more reps: *"the claim is 'the rate fell from 1.0' and
that is carried by p = 0.018 on the data in hand."* That reasoning holds only if the data in hand is
attached to a known build. It is not.

```mermaid
timeline
  title 2026-07-27 to 07-28 — the measurements precede the ability to identify what was measured
  section Runs cited as "v1.4"
    12:37 : v14-haiku-f2 finishes : 1 of 3 narrated
    14:26 : v15-haiku-f2 finishes : 0 of 3 narrated : the $7.69 result
  section Only afterwards
    16:36 : plugin commit 36521ba "v1.4.0" : never tagged
    16:50 : bench commits the logs
    07-28 16:17 : bench commit 53c02ae : pack cache becomes content-addressed
```

Three consequences, each checkable:

1. **The runs predate their own release commit by 2–4 hours.** They were made against an
   uncommitted working tree, so the exact bytes are unrecoverable. `v1.4.0` was never tagged
   (`git tag -l v1.4.0` → 0 results), so there is not even a release anchor to approximate it.
2. **Build identity did not exist yet.** The content-addressed pack key landed the following day.
   Until then the adapter's cache was, in its own words, *"one directory… returned whenever it
   existed, never invalidated"* — the very defect its comment records as *"found in exactly that
   state: a v1.4.0 pack still sitting in the cache while the source was at v1.4.1."*
3. **The clean result took five attempts.** `v14`, `v14b`, `v14c`, `v14d`, then `v15` — and `v14c`
   still produced a `never_started` run at 4/14 *with* the grant already in place. Something other
   than the grant changed between `v14c` and `v15`, and the record cannot say what.

So the plan's decision 1 is right for a better reason than it gives. **Correcting myself: buy the
measurement.** What it must not do is buy only half of it.

### 4.3 Stage 4 destroys what it replaces

`FailureClass` has one `current` object. Re-measuring overwrites it, and the $7.69 v1.5 result
ceases to exist. Searched `day2-failure-class.schema.json` for `superseded`, `supersede`, `retire`
— **zero matches.**

Day 1 hit this precise failure and wrote the post-mortem into `48-day1-day2.mjs` (d9): *"The measure
path used to write `results[skill][model] = summary`, so re-measuring after a fixture change
destroyed the figure it was supposed to be compared against — the act of producing the new number
deleted the old one."* Its answer is a `superseded` array carrying `cause`
(`fixture-change | re-sample | model-policy`), the retained figures, and the successor fingerprint,
with structural checks on all three.

Two lines from the source say the same thing independently — Appendix graph-write invariant 4,
**"Every superseded object remains addressable"**, and Table VI's Reversibility row: *"Can updates be
undone? Failure if missing: failed experiment damages state."* The plan is a change that damages
state on success.

### 4.4 Stage 2, landed third, goes red on one row

Simulated the plan's own sequence — Stage 1 dates FC-01, decision 2 dates FC-04's baseline, Stage 3
writes FC-02's `current` — then applied a strict `measured_at` requirement to every measured rate:

```
rows that would FAIL a strict measured_at check after the plan runs: FC-02.baseline
```

One row, and it is the one nobody named: FC-02's baseline is the count of **26** inert enforcement
points, `measured_at: null`, and Stage 3 touches `current`, not `baseline`. It is trivially datable —
the F-16 audit resolves to `27deb1b` *"v1.4.1 — the enforcement layer was inert under an ordinary
install"*, 2026-07-28 — but it has to be *in the plan*, and the guard has to land after it.

Day 1 published this exact lesson and it should not need learning twice:
*"Do not wire §48 in as the first commit. Verified above: it takes a clone from 4 failures to 10…
The instrument must be committed before the check that requires it."*

### 4.5 "Date the baseline from git history" is the FC-04 error class, inside the FC-04 row

`measured_at` means *when the measurement was taken*. FC-04's baseline is not a measurement — it is a
retrospective count (*"fabricated baselines shipped before the invariant existed"*, value 1, n=1).
No sampling event ever occurred, so there is no date to recover. Taking the date from the commit
that shipped the **fix** writes a timestamp asserting a measurement that never happened, into the
row whose registered error class is *"Fabricated evidence — a baseline that carries numbers no run
produced."*

The plan's instinct — no escape hatch — is right; the resolution is one clause away. **Date it as the
audit that produced the count, and say so in `method`.** "Counted by the F1 audit, `evals/README.md`,
on <date>" is a true statement with a real date behind it, and it satisfies a strict check without
inventing anything. Same treatment for FC-02's 26.

### 4.6 A scope inconsistency worth resolving before anyone writes code

Decision 3 says focus *"entirely on FC-01 (measured) and FC-04 (structural)."* Execution step 4 does
FC-02. Decision 4 says structural impossibility *"is not enough"*; step 4 makes a structural claim.

Both resolve under one reading, and I think it is the intended one: **the rung requires at least one
sampled reduction; structural claims remain valid and stay labelled.** That is what
`reduction_basis` was invented for — the schema's own words are that naming the basis *"stops a
structural argument from being read as a sampled result."* Under the stricter reading — structural
claims are worthless — Stage 3 is wasted work and FC-04 should be retracted, which nobody wants.
Write the intended reading into the register's `note` so the next person does not have to infer it.

### 4.7 What the three arms cost

Per-rep figures from runs that already happened (`results/runs.jsonl`, Haiku 4.5):

| Arm | Configuration | n | Cost | Wall clock | What it buys |
|---|---|--:|--:|--:|---|
| **A** | v1.6.3 as installed | 3 | **$7.69** | ~91 min | the current rate, build-identified |
| **B** | v1.6.3, grant withheld | 3 | **$0.94** | fast — fails early | separates FC-01's tool from FC-02's (§4.1) |
| **C** | `v1.3.0` tag, no grant | 5 | **$0.33** | ~3 min | build-identifies the baseline; falsifies or confirms 5/5 |
| | **Three arms** | | **$8.96** | ~1.7 h | |
| | *Plan as written (A only)* | | *$7.69* | *~1.5 h* | |

**$1.27 and ~12 minutes** separate a before/after from an attributed, build-identified, falsifiable
result. Arm C is feasible: the `v1.3.0` tag exists (`6f7f023`), and the adapter takes its source
from `BENCH_SHAPEUP_DIR`, so `git worktree add` at that tag is the whole setup.

Arm C is also the only step here that can *fail interestingly*. If v1.3.0 packed today does not
reproduce 5/5 narrated, FC-01's baseline is wrong and every downstream number changes — which is
worth $0.33 to find out before writing `reduces: true`.

---

## 5. What deliberately not to do

- **Do not run any benchmark arm before the schema work lands.** It is the whole of §4.3: with one
  `current` field and no `superseded[]`, the first successful run deletes the $7.69 result. The
  schema edit is free and takes under an hour; the run costs $9 and is irreversible in the register.
  This is the same ordering error Day 1 already paid for, pointing the other way.
- **Do not add the `audit-finding` escape hatch — and do not solve it with invented dates either.**
  The plan is right to refuse the exemption. §4.5's resolution costs one sentence per row and keeps
  the rule strict. An exemption would put a hole in the guard on day one; a fabricated date would put
  the error in the data, which is worse because it looks fine.
- **Do not re-run Arm C with the permission grant to "be fair to v1.3."** It would be the more
  faithful install — F-10 argues exactly that — but it would no longer be the baseline. The 5/5 is a
  fact about v1.3 as the benchmark then drove it, and Arm C exists to check that fact under a
  known build, not to improve it. Changing two things at once is what produced §4.1's problem.
- **Do not raise n on Arm A beyond 3.** The one-sided 95% bound only reaches 25.9% at n=10 and 9.8%
  at n=29, at ~$18 and ~$67. The claim being made is *the rate fell from 1.0*, which p = 0.018
  already carries. Spend the marginal dollar on Arms B and C, which answer questions n cannot.
- **Do not extend the register to FC-06/07/08 while you are in the file.** All three are
  `hypothesized`. Once Stage 2's guard lands, they are correctly locked out of `reduces` — and the
  temptation to "complete the table" is exactly what that guard is for.

---

## 6. Recommendation — the same plan, five amendments, one new first stage

**Proceed. Reorder to schema → data → measure → write → guard, and buy three arms.**
Total ~$8.96 and roughly half a day, against the plan's $7.69 and a red build.

### Stage 0 — Schema first, before any spend · ~45 min · $0 · NEW

Two additions to `day2-failure-class.schema.json`:

1. **`superseded: []`** on `FailureClass`, modelled on the Day-1 baseline's array — retained
   `value`/`n`/`method`/`measured_at`/`model`, plus a `cause` enum. Do not invent a new vocabulary;
   `re-measure | instrument-change | withdrawn` maps onto Day 1's three and a reader already knows
   how to read it.
2. **A build field on `Rate`** — `harness_build`, holding what the benchmark now produces (the
   content-addressed shipped-surface hash) or a git tag. Nullable, because historical rates
   legitimately have none — and a *recorded* null is the finding, where today's silence is not.

**Exit:** `npm test` green; the register round-trips unchanged.

### Stage 1 — Date and correct what already exists · ~30 min · $0

FC-01 baseline `n` 3 → 5 and its date; FC-02 baseline dated to the F-16 audit (`27deb1b`,
2026-07-28); FC-04 baseline dated to the F1 audit — each with `method` saying *counted by that
audit*, per §4.5. Fix `03-system-design.md:135`'s `n=3`. Set `harness_build: null` on every existing
rate and note in `method` that the build is unrecoverable (§4.2).

**Exit:** every measured rate carries a date and a build field, one of them honestly null.

### Stage 2 — The three-arm measurement · ~1.7 h · **$8.96** · gated behind Stage 0

Arms A, B and C from §4.7. Arm B needs a small `setup()` flag to withhold the grant. **Run Arm C
first** — it is $0.33, it takes three minutes, and if it fails to reproduce 5/5 the other two arms
are measuring against a baseline that needs rewriting before they are worth buying.

**Exit:** three build-identified rates. Arm C reproduces 5/5 (or the plan re-opens); A gives the
current rate; B gives the attribution.

### Stage 3 — Write the result, attributed · ~45 min · $0

FC-01 `current` from Arm A with `harness_build` and `measured_at`; the v1.5 figure moved to
`superseded` with `cause: re-measure`, not overwritten. Set `reduces` and `reduction_basis:
"sampled"` **only if Arm B supports crediting FC-01's tool**. If B shows the grant carries the
result, say so in `method` and record the reduction against the pair — an honestly-stated joint
attribution is a better Day-2 row than a clean-looking single one.

**Exit:** `reduces: true` on FC-01, traceable to three arms and a build hash.

### Stage 4 — FC-02's structural current · ~20 min · $0

As the plan has it, and as the Day-2 report specifies: 0 hand-rolled guards over 33 scanned modules,
22 entry points execution-probed, `reduction_basis: "structural"`, **and the 22 and the 26 kept
visibly distinct.**

### Stage 5 — The guards, last · ~45 min · $0

`measured_at` required; `hypothesized` may not claim a reduction; `sampled` requires `n` on both
rates. Add one more while you are there: **`sampled` requires `harness_build` on both rates**, which
is the mechanical form of §4.2's lesson.

**Exit — and this is the acceptance test, not a green suite:** re-applying the FC-06 mutation from
the report's §4.3 must turn the suite **red**, and reverting it must turn it green. Mutation-verify
each of the four rules in both directions; a guard verified only by the suite passing is the
inert-enforcement class this register exists to track.

---

## 7. What would change this answer

- **If Arm C does not reproduce 5/5 narrated at `v1.3.0`.** Then FC-01's baseline is not a stable
  property of that build, the Fisher arithmetic in §4.1 is void, and the right response is to
  withdraw the baseline the way Day 1 withdrew its HD-004 row rather than to patch it. $0.33 and
  three minutes decides this, which is why it runs first.
- **If Arm B shows no difference — v1.6.3 without the grant also gives 0/3.** Then FC-01's tools
  carry the result alone, §4.1's concern dissolves, and Stage 3 writes the simple version. That is a
  good outcome and it is what the $0.94 is buying the right to say.
- **If the operator's reading of decision 4 is the strict one** — that structural claims do not
  count at all — then Stage 4 is wasted and FC-04 should be retracted, and the rung stands or falls
  entirely on FC-01. I have assumed the moderate reading (§4.6). This is the single assumption most
  of the staging rests on and it is a one-line answer.
- **I did not verify that the benchmark still runs end-to-end at v1.6.3.** The adapter reads
  `BENCH_SHAPEUP_DIR` and packs with `npm pack`, which is the right shape, but four releases have
  shipped since it was last exercised and I did not execute even a `--dry-run`. Do that before
  budgeting Stage 2 — it is free and it is the cheapest way to find out that Arm A costs more than
  $7.69.
- **I did not check whether `v14` and `v15` used the same tarball.** Under the pre-`53c02ae` cache
  that is unknowable from the record, which is why §4.1's 1/3-vs-0/3 comparison is presented as
  *the grant plus possibly other changes* rather than as a controlled contrast. Arm B is what
  converts it into one.

---

## Appendix — evidence table

| # | Claim | Source | How obtained |
|---|---|---|---|
| 1 | Day-2 exit criterion is per-tool; §VI.B says "add **one** tool" | supplied PDF, §VI.B + Table II | read |
| 2 | "Every superseded object remains addressable" | supplied PDF, Appendix graph-write invariants | read |
| 3 | Reversibility row: "failed experiment damages state" | supplied PDF, Table VI | read |
| 4 | v14 run finished 12:37, v15 at 14:26, 2026-07-27 | log file mtimes | measured |
| 5 | Plugin `v1.4.0` commit at 16:36 the same day | `git log 36521ba` | read |
| 6 | `v1.4.0` was never tagged | `git tag -l v1.4.0` → 0 | run |
| 7 | Content-addressed pack key landed 2026-07-28 16:17 | bench `git log 53c02ae` | read |
| 8 | Pre-fix cache was "one directory… never invalidated" | `harnesses/shapeup-sdlc/adapter.mjs:33-42` | read |
| 9 | Grant is written unconditionally by `setup()` | `adapter.mjs:205` | read |
| 10 | Grant is FC-02's registered tool (`bin/init.mjs`) | `failure-classes.json` FC-02 | read |
| 11 | v1.4 without grant: 1/3 narrated, acc 14/14, 4/14, 4/14 | `results/v14-haiku-f2.log` | read |
| 12 | v1.4 with grant: 0/3 narrated, 14/14 ×3 | `results/v15-haiku-f2.log` | read |
| 13 | v14c had the grant and still produced `never_started` 4/14 | `results/v14c-haiku-f2.log` | read |
| 14 | Fisher one-tailed: 5/5→1/3 p=0.107; 5/5→0/3 p=0.018 | — | computed |
| 15 | Day-2 schema has no `superseded`/`retire` mechanism | grep of `day2-failure-class.schema.json` → 0 | run |
| 16 | Day-1 baseline has a full `superseded` array with `cause` | `skill-loop.baseline.json:830` | read |
| 17 | Day 1's post-mortem: re-measuring deleted the prior figure | `48-day1-day2.mjs` (d9) | read |
| 18 | `Rate` has no build/version field | schema `$defs.Rate` | read |
| 19 | Day 1 pins `fixture_sha` and refuses cross-fingerprint pooling | `48-day1-day2.mjs` (d9) + `pooledRevisions` | read |
| 20 | After the plan's steps, exactly `FC-02.baseline` fails a strict date check | simulation over the register | run |
| 21 | F-16 audit resolves to `27deb1b`, 2026-07-28 16:10 | `git log 27deb1b` | read |
| 22 | Day 1's ordering lesson, published | `docs/day1_evidence_chain_review.md` §5 | read |
| 23 | Arm costs: A $7.69 / B $0.94 / C $0.33 | `results/runs.jsonl` per-run `cost_usd` | computed |
| 24 | Arm A wall clock ~91 min | `v15-haiku-f2.log` session lines | computed |
| 25 | `v1.3.0` tag exists at `6f7f023`; adapter reads `BENCH_SHAPEUP_DIR` | `git rev-parse`; `adapter.mjs:31` | run + read |
| 26 | 95% bound at n=10 is 25.9%, at n=29 is 9.8% | — | computed |

**Not checked:** whether the benchmark runs end-to-end at v1.6.3 (§7 — not even a `--dry-run`);
whether `v14` and `v15` packed the same tarball (unknowable pre-`53c02ae`); what changed between
`v14c` and `v15` beyond the grant; whether `setup()` can withhold the grant without a code change —
I read the call site and inferred a flag is needed, but did not write or test one; whether the F1
audit that produced FC-04's count has a single unambiguous commit date, which Stage 1 assumes.
