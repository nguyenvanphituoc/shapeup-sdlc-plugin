# Resume — superseded, the run finished (S3 included)

This file existed because the previous session stopped on a usage limit with S1, S2 and S4 unstarted.
**All three have since landed** (`9cbbc1f`, `5546fee`, `bc61af3`) and every acceptance row passes at
the commit that produced it. There is nothing to resume.

Read **`REPORT.md`** instead. It carries what shipped, the checks that were run without any agent
involved, and the five things still open.

## If you want to re-derive the result yourself

Never trust this directory's claim about its own progress — that rule is why the run is trustworthy.

```bash
node .plan-runs/day2-rev5/preflight.mjs                 # all 28 rows at HEAD  -> expect 27/28
node .plan-runs/day2-rev5/preflight.mjs S1 --at=9cbbc1f # the stage-local row  -> expect 5/5
```

**27/28 at HEAD is the correct result, not a failure.** One S1 row asserts the register is
byte-identical to S0's commit, and S2 edits the register on purpose; it is marked `stage-local` in
the contract and passes at S1's own commit. `--at=<ref>` exists for exactly this.

## S3 has since run too

The hold was lifted on 2026-08-07. S3 is green, 8/8, at `f0b33d7` — and it closed **without
spending its $5.8**, because the arm it specifies cannot be bought: the adapter requires a receipt
that `init-run.mjs` writes, `init-run.mjs` first exists at v1.4.0, and `a280e86` is the pre-fix
build precisely because it predates it. The question was answered instead from transcripts already
on disk: **0 of 8 scored Sonnet `shapeup-sdlc` rows ship nothing, against 7 of 16 on Haiku.**

```bash
node .plan-runs/day2-rev5/preflight.mjs                 # all 36 rows at HEAD  -> expect 35/36
node .plan-runs/day2-rev5/preflight.mjs S1 --at=9cbbc1f # the stage-local row  -> expect 5/5
```

Three S3 rows read `/Users/teo/workspace/sdd-harness-bench` (set `BENCH_DIR` if it lives
elsewhere). That is the one place this contract reaches outside the repository, and it does so
because the plan puts S3's prerequisite there.

**Do not trust `s3-feasibility.mjs` here.** It arrived in the merge from a machine that genuinely
lacked the benchmark, where its exit-3 verdict was right. On this machine it still exits 3, but its
own output refutes it: C1 finds the benchmark at its recorded path and C2 then claims nothing
matching `*harness-bench*` exists under `/Users`. Believe `preflight.mjs S3` — which runs the
benchmark's suite rather than searching for it — and see open item 6 in `REPORT.md`.

---

## IN FLIGHT (2026-08-11) — FC-01's n=10 arm, pre-registered

A measurement is running. **Read the pre-registration first and do not re-decide it:**
`sdd-harness-bench` PROTOCOL §9, commit `f286567`, written before any rep was bought.

```bash
BENCH_ALLOW_MODEL=claude-haiku-4-5-20251001 node runner/run.mjs \
  --feature f2-budgets --harness shapeup-sdlc \
  --model claude-haiku-4-5-20251001 --reps 12          # log: /tmp/fc01-arm.log
```

**Why.** FC-01 is not dead, it is underpowered. Rules 6/7/8 already accept it as a sampled claim
(verified by mutation); only power is missing — 5/5 → 1/3 is Fisher one-tailed p=0.107, and the new
rule 9 refuses it for exactly that. n=10 scored at ~1/3 lands near p=0.019.

**What to do when the arm stops** — nothing here is a judgement call, it was all fixed in advance:

1. Select the new rows: `harness_build` = the packed build from plugin HEAD `1a149c2`
   (`v1.6.3+3864b1d09f71`), model `claude-haiku-4-5-20251001`, feature `f2-budgets`, harness
   `shapeup-sdlc`. **Do not pool** the older `v1.6.3+e08082c685dc` day2-armA rows.
2. Keep only `scored: true` rows (§8 excludes the rest). Target n=10; attempt cap 30 total.
   If fewer than 10 scored after 30 attempts, report the n actually obtained — do not run more.
3. k = rows whose `failureMode()` is `shipped_nothing` (predicate:
   `bench@d3787fa:runner/lib/transcript-metrics.mjs:387`).
4. Fisher exact one-tailed, 5/5 baseline vs k/n. **Rule 9 decides** — do not hand-rule it.
   - p < 0.05  → FC-01 gets `reduces: true`, `reduction_basis: "sampled"`, current = k/n at the new
     build, `model_scope` haiku on both rates. Day 2's rung has its first sampled reduction.
   - p ≥ 0.05 → `reduces` stays **null**; record the k/n rate anyway as the honest current rate.
     The rung stays open. Do not buy more reps to move the p-value.
5. `npm test` must stay green (rule 9 is the check that will accept or refuse this), then
   `preflight.mjs` 35/36, then push.

**The claim is Haiku-scoped either way** — the MUT is `claude-opus-5` and this class does not occur
there (0 of 8 scored Sonnet rows), so Haiku-scoped-and-labelled is the only honest form available.
