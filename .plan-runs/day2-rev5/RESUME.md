# Resume — superseded, the run finished

This file existed because the previous session stopped on a usage limit with S1, S2 and S4 unstarted.
**All three have since landed** (`9cbbc1f`, `5546fee`, `bc61af3`) and every acceptance row passes at
the commit that produced it. There is nothing to resume.

Read **`REPORT.md`** instead. It carries what shipped, the checks that were run without any agent
involved, and the three things still open.

## If you want to re-derive the result yourself

Never trust this directory's claim about its own progress — that rule is why the run is trustworthy.

```bash
node .plan-runs/day2-rev5/preflight.mjs                 # all 28 rows at HEAD  -> expect 27/28
node .plan-runs/day2-rev5/preflight.mjs S1 --at=9cbbc1f # the stage-local row  -> expect 5/5
```

**27/28 at HEAD is the correct result, not a failure.** One S1 row asserts the register is
byte-identical to S0's commit, and S2 edits the register on purpose; it is marked `stage-local` in
the contract and passes at S1's own commit. `--at=<ref>` exists for exactly this.

## The one stage that was never run

**S3** — probe the Sonnet baseline. $5.8, n=3 at pre-fix `a280e86`, and the only stage that spends
money or writes outside this repository. Compiled in full in `contract.md` so it can be picked up
without recompiling. Nothing that shipped depends on it.

**Attempted 2026-08-08 and blocked — it cannot run on this machine.** The benchmark it needs is not
here and has no remote to fetch it from, so both halves of the stage (the `product_writes` change,
committed *there*, and the n=3 reps through its runner and scorer) are out of reach. Derive that
yourself rather than believing this file:

```bash
node .plan-runs/day2-rev5/s3-feasibility.mjs   # exit 0 runnable · exit 3 blocked, reason named
```

Run it on the machine that holds the benchmark; if it exits 0, follow the runbook at the end of
`contract.md`'s Stage S3 section. **No number was invented in the meantime** — the register still
carries no Sonnet rate, which §7 says is the honest terminal state when this probe is unobtainable.
