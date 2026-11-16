# Before the close — reflect on the run

| Contract | |
|---|---|
| Phase | `15` |
| Order | `learn` |
| Gate | `COACH-1` |
| Done when | `<run>/learning/candidates.json` exists, GATE COACH-1 has a row for this run, and, when it says `file` or `K kb review` reports a change, the matching `K kb apply` / `K kb review --apply` has answered `ok` (or the log says why not) |

This runs at every ending a run reaches — `shipped`, `escalated` and `aborted` — and **before** `K order close`.
A run that failed is the one with the most to teach, and the close retires the fence and the pointer this step needs.

1. **Read the run's own facts.** `K kb evidence --slug <slug>` lists the failure classes the run really had and the rows
   of the ledgers the kernel or a hook wrote (the guard's metrics, the T0 trial ledger, the gate ledger) with the digest to
   cite each by. Nothing else is evidence: the discovery ledger, a QA finding and the decision log may *support* a lesson, and
   the pitch and anything fetched from the web are never the reason for one.
2. **Write the candidates** to `<run>/learning/candidates.json`, one per lesson, no more than the run has evidence for:
   `{"schema_version":1,"candidates":[{"id":"C1","reader":"<reader>","class":"<a class from step 1>","body":"<the lesson and its reason, about 120 words at most>","citations":[{"ledger":"…","run_id":"…","row_digest":"…"}]}]}`.
   Copy each citation from step 1. A class that did not recur across runs and cost no attempt is not a lesson yet — leave it out;
   the threshold is checked again by the kernel.
3. **Put GATE COACH-1 to the gate agent** with the candidate file. It chooses each candidate's reader (`harness-defect` when
   unsure) and answers `file` or `skip`. The kernel narrows `file` to `skip` when no candidate's citations match a row it wrote.
4. **On `file`:** write the order for operation `learn` (`resources/orders.md`; `worker: "building"`, no `step`), open it with
   `K order open`, then write the delta the gate agent settled — one operation per candidate that stands (`ADD`, `EDIT`, `MERGE`,
   `RETIRE`, or `DEFECT` for a harness defect), each naming its candidate — and run `K kb apply --slug <slug> --delta <path>`.
   A new rule starts on probation and names the class it targets (`targets`), so a later run can show whether it worked. `kb apply` lints the table and undoes the whole delta if it is left red: write the reason
   in the log, never a hand-edited rule. Write `results/learn.json` yourself when it is done, so the order is answered.
5. **Probation.** `K kb review --slug <slug>` says what the runs so far show about each rule still on probation: a rule whose
   class had a base rate and stayed away is promoted, one with no base rate expires after enough runs, one whose class came back
   while it was loaded is retired and filed as a defect. When it reports a change, open a `learn` order (if step 4 did not) and run
   `K kb review --slug <slug> --apply` — a change of `status` and nothing else. A rule is never promoted on a stretch in which
   its class never occurred: that is a check that cannot fail.
6. **Then close the run** (`K order close`). The close writes the run's row in the cross-run index from the ledgers, so the next
   run's threshold counts this one.

A rule steers craft and never decides a gate: a candidate that tells a gate what to answer is refused at lint, and a delta
that adds one is undone.
