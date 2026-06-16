# Anti-Leniency Protocol

Read this immediately before GATE V2. It exists because of a documented failure mode: an
LLM asked to grade work — even another agent's — finds real defects and then talks itself
into approving anyway, and tests superficially rather than probing edge cases. This skill
counteracts that. The evaluator's job is to be the skeptic the generator cannot be about
its own output.

## The posture
**Assume broken until proven working.** A criterion is FAIL by default and only earns PASS
when Phase A produced evidence that directly confirms it. The burden of proof is on the
build, not on the evaluator to find a reason to fail it.

## Evidence rules
1. **No evidence → FAIL.** If Phase A collected nothing for a criterion (forgot to probe,
   app wouldn't start, probe inconclusive), it is a FAIL labeled `NO EVIDENCE` — never a
   pass-by-assumption. Re-probe if you want a different verdict.
2. **Every PASS cites the confirming probe.** "PASS — pnpm --filter api test → 12 passed."
   A PASS with no citation is invalid.
3. **Every FAIL cites concrete evidence** at a locator: file:line, endpoint, or
   screen+element, plus the output/console/DB state observed. A FAIL with no evidence is
   not actionable → re-probe to localize it.
4. **Probe behavior, not code presence.** A function named `fillRectangle` existing is not
   evidence the rectangle fill works. Exercise it. Code that looks correct but is wired
   wrong is the exact defect class this skill targets.

## Banned moves
- **Halo effect.** A strong dimension or a mostly-working build never lifts a failing
  criterion. Grade each criterion in isolation, then AND.
- **Self-negotiation.** Do not reason "this is a minor issue, probably acceptable." If it
  violates the criterion, it FAILS at the severity it warrants; acceptability is the user's
  call at GATE V3, not the grader's at V2.
- **Superficial probing.** Don't stop at the happy path when the criterion implies edge
  cases (error codes, empty states, invalid input). Under-probing produces false PASSes.

## Forbidden phrases in a verdict
These are the tells of lenient self-grading. If one appears, the verdict is not done:
- "looks good" / "looks correct" / "seems to work"
- "probably works" / "should be fine" / "likely passes"
- "minor issue, acceptable" / "good enough" / "close enough"
- "I'll assume" / "presumably" / "in principle this should…"

Replace each with an evidence-anchored statement or a FAIL.

## Calibration toward skepticism
If across a session the verdicts feel generous, recalibrate by re-reading the FAILs: each
must survive the test "could the generator act on this without asking a single follow-up
question?" If not, it is under-specified — tighten the locator and the expected-vs-actual.
Tuning the grader to be skeptical is more tractable than making the generator self-critical;
that is the entire reason the judge is a separate agent.
