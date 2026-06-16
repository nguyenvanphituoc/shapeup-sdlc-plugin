---
name: qa-edge-hunter
description: >
  Use this skill for the post-PASS exploratory QA pass — Shape Up's "QA is for the edges",
  made explicit for the harness. Triggers on: "hunt edge cases", "QA pass on this feature",
  "exploratory test the running app", "edge hunt before ship", "run qa-edge-hunter",
  "the evaluator passed — what did it miss?", and Vietnamese "săn edge case", "kiểm thử
  thăm dò", "QA trước khi ship", "tìm lỗi ngoài spec". tech-lead invokes it after the
  run's FIRST PASS at GATE L3, before SHIP; it also runs standalone given a spec folder,
  a PASS EVAL report, and a running app. The Hunter is a PURE worker: it charters edges
  OUTSIDE what the evaluator probed (EVAL-*.md = negative-space input), hunts them on the
  running app through six fixed lenses; findings → discovery/ledger.md, always `~`.
  NO verdict, NO score, NO gate; never fixes code, never promotes its own
  findings, never blocks ship — triage is PO/TL's at SHIP S.0/GATE L4. NOT for checking AC
  (spec-evaluator), deriving test cases (ba), or fixing bugs (task-executor).
---

# QA Edge Hunter — the post-PASS edge pass (v1.1)

Shape Up, Ch. 13: QA comes in **toward the end**, hunts **edge cases outside the core**,
and its issues are **nice-to-haves by default** that the team triages. This skill is that
role for the harness. It exists because the judge (`spec-evaluator`) is skeptical only
*within the spec it is handed* — absence of evidence is a FAIL, but absence of a *test
case* is invisible to it. The Hunter covers exactly that blind spot: behavior the spec
never wrote down.

```
tech-lead: ... GATE L2 → EVAL → GATE L3 PASS ──► QA EDGE HUNT (you) ──► SHIP S.0 triage → L4
                                                  charters · hunts · ~ findings → ledger
            GATE L3 FAIL → fix round (never reaches you — conformance first, edges after)
```

**Division of labor (settled at the QA meeting, 2026-06-11):**

| Tier | Owner | When |
|---|---|---|
| Derivable tests (boundaries, error codes, no-go breaches the spec implies) | `ba` `## Test Surface` + evaluator `test-surface-conformance` | spec time / every EVAL |
| **Exploratory edges (this skill)** | `/qa-edge-hunter` | once, post-first-PASS |

---

## What the Hunter is and is not

| Does | Does NOT |
|------|----------|
| Read EVAL-*.md to map covered territory — then hunt OUTSIDE it | Re-probe anything the evaluator already graded |
| Charter edges via six fixed lenses, minus covered territory | Author or extend `## Test Surface` (that is `ba --surface-only`) |
| Execute charters on the **running app** (session-based exploratory) | Read-only speculate from code ("this looks racy") — every finding needs a live repro |
| Write each finding to `discovery/ledger.md`, **always `~`** | Promote `~` → must-have (PO/TL at SHIP S.0; severity-hint is advice, not a decision) |
| Emit `qa/hunt-report.md` — charters run/cut, findings by lens | Render a verdict, score, or PASS/FAIL of any kind |
| `--recheck`: re-probe ONLY items promoted+fixed after triage | Run a second full hunt in the same cycle; fix code; touch task files; keep run-state |

Pure worker (harness rule: stateless workers, one stateful orchestrator). Receives
`feature`, `spec` folder, EVAL report path, ledger path, app URL as **arguments** from
`tech-lead`; never reads/writes `harness-run.md`. Single-writer discipline on the ledger:
the Hunter appends only inside its own `## QA Edge Findings (round N)` section.

---

## Workflow

```
⏸ GATE Q0 │ Preflight ────► hard: app running? EVAL verdict PASS? ledger exists?
          │                 soft: Test Surface present? absent → DEGRADED MODE offer
Phase Q1  │ Charter Map ──► 6 lenses × UC tree − covered territory (EVAL-probed rows/AC)
⏸ GATE Q1 │ Charter Review► PO/TL hammer the charter list (QA's own appetite is fixed too)
Phase Q2  │ Hunt ─────────► session per charter on the running app; findings → ledger LIVE
Phase Q3  │ Report ───────► qa/hunt-report.md — no score, no verdict
```

---

## GATE Q0 — Preflight

```
HARD (any miss → STOP, report which):
  ✅ app reachable at the given URL (one real request, not a ping)
  ✅ EVAL-FEATURE-<slug>.md exists with verdict: PASS
  ✅ discovery/ledger.md exists and ledger.feature == <feature> arg
SOFT:
  ⚠️ any usecases/UC-*.md has `## Test Surface`?
     NO → DEGRADED MODE:
       "Test Surface absent — derivable cases (boundaries, error codes, no-go breaches)
        were never systematically probed. Lenses ① and ⑤ will widen to compensate
        (charters tagged [derivable-fallback]). Better: run
        `ba-pitch-analyzer --surface-only <spec>` + one evaluator pass first, then hunt
        with a narrower charter. Continue degraded? [y/n]"
     Degraded is first-class, not an error — for old specs, a degraded hunt beats no hunt.
Questions: max 2. The standing one: "Any areas OUT OF BOUNDS for exploratory testing?
(e.g. real payments, real emails, production data)" — out-of-bounds areas are excluded
from charters and listed in the report, never silently skipped.
```

**Output:**
```
⏸ GATE Q0 — Preflight
App       : [url] ✅ reachable
EVAL      : EVAL-FEATURE-[slug].md — PASS (dims: [...])
Ledger    : discovery/ledger.md ✅ feature match
Surface   : [present | ABSENT → degraded mode]
Out-of-bounds? (max 2 questions) …
```

---

## Phase Q1 — Charter Map

A **charter** is a hunting ground + a mission — NOT a test case (test cases are the
derivable tier; writing them here would re-do `ba`'s job badly). Generate charters by
crossing the UC tree with the **six fixed lenses**, then subtract covered territory.

| Lens | Mission | Typical prey |
|---|---|---|
| ① Boundary overflow | Inputs the contract never bounded | very long strings, unicode/emoji, 0/negative where unstated, paste-bombs, huge files |
| ② Concurrency | Same action, twice, at once | double-submit, two tabs editing one aggregate, rapid re-click on mutation CTAs |
| ③ State interruption | Break the flow mid-stride | refresh mid-wizard, back button after submit, session expiry mid-form, network drop on save |
| ④ Cross-UC journey | Chain UCs end-to-end | create→edit→delete→recreate same entity; output of UC-A as adversarial input to UC-B |
| ⑤ No-go probing | Is the excluded path truly absent? | direct URLs, API calls bypassing the UI, role escalation to no-go'd features |
| ⑥ Data residue | What survives that shouldn't? | deleted data via old links/exports, prior-session state bleeding, cache after logout |

The six lenses are **fixed** (simplicity as a hard constraint) — scoping happens by
cutting charters at GATE Q1, not by configuring lenses.

**Charter quality** — before generating, internalize the target altitude:
- Good: "What happens to the order record if the user refreshes the page after clicking
  Confirm but before the server responds?" → one specific risk, concrete mission,
  achievable in one session, requires a running app to test.
- Too broad: "Test the checkout flow" → maps 1:1 with a UC; that is the evaluator's job.
- Too narrow: "Verify the Confirm button is disabled after click" → this is a derivable
  test case; it belongs in `## Test Surface`, not a charter.
A charter is a license to deviate within a hunting ground; a test case is a script.

```
Q1.1  Parse EVAL-*.md → covered set: every TS row probed (test-surface-conformance
      section) + every AC/Done-when graded (spec-conformance section).
Q1.2  Per UC × lens: draft a charter ONLY where the covered set leaves territory.
      Lens ⑤ vs Test Surface D4: TS-NOGO rows probe the no-go AS SPECIFIED; the charter
      hunts UNSPECIFIED breach routes (other URLs, API bypass, role tricks) — overlap
      with a probed row = drop the charter.
Q1.3  Degraded mode: add [derivable-fallback] charters for the uncovered derivable tier
      (lens ① boundary basics; lens ⑤ no-go-as-specified) — tagged so GATE Q1 sees
      exactly which bulk is owed to the missing surface.
Q1.4  Drop charters touching Q0 out-of-bounds areas; list them in the report as
      "excluded (out of bounds)".
Q1.5  Time-box each charter (default 1 session unit ≈ one focused pass; a charter that
      wants more must say why).
```

---

## ⏸ GATE Q1 — Charter Review

The scope hammer applied to QA itself — the Hunter's appetite is as fixed as everyone
else's.

```
⏸ GATE Q1 — Charter Review               [DEGRADED MODE]   ← shown only when degraded
Charters: [N] ([D] derivable-fallback) · est: [N] session units
  C-01 [①boundary]  UC-04 amount field beyond contract silence …
  C-02 [②concurr]   UC-04 double-submit Confirm …
  C-03 [⑤no-go]     export via unauthenticated direct URL …      [derivable-fallback]
  …
Excluded (out of bounds): [list from Q0]
Question (max 1): "Cut or add any charters? (ids / add <desc> / none)"
```

Cut charters appear in the report under "Hammered out (not hunted)" — visible cuts, never
silent ones.

---

## Phase Q2 — Hunt

Session-based exploratory testing per approved charter, on the running app.

```
Per charter:
  H.1  Execute the mission within its time box. Vary, provoke, chain — follow the scent;
       a charter is a license to deviate INSIDE its ground, not a script.
  H.2  Suspected finding → reproduce it (≥1 clean repro) before recording. No repro →
       log in session notes as "unconfirmed observation", NOT a ledger finding.
  H.3  Confirmed → append to discovery/ledger.md IMMEDIATELY (live, not batched):

       ## QA Edge Findings (round [r] — [date])          ← created on first finding
       ~ [QA-NNN] [lens:②concurrency] [UC-04] Double-click "Confirm" creates 2 orders
           repro: <numbered steps, shortest path>
           severity-hint: data-integrity | boundary-breach | ux-degradation | cosmetic
           evidence: <response/state/screenshot ref — what was observed, factually>
           test-gap: unit | integration | exploratory-only
                     (unit = a targeted unit test would have caught this;
                      integration = a cross-layer integration test would catch this;
                      exploratory-only = only discoverable through live session dynamics)

       Always `~`. severity-hint is the Hunter's advice to triage — the promotion
       decision is PO/TL's at SHIP S.0, never made here.
       test-gap is advisory for ba-pitch-analyzer reconciliation: it signals whether
       to generate a test-writing task alongside the fix task.
  H.4  A finding that contradicts a PASSED criterion (the evaluator graded it PASS, the
       hunt shows otherwise) → record with `contradicts: <EVAL criterion id>`. Do NOT
       edit EVAL-*.md or un-tick anything — the judge's record is the judge's; the
       contradiction flag routes it back through triage.
  H.5  Time box expires mid-scent → stop, note "charter exhausted time with open scent"
       in the report. The circuit breaker applies to hunting too.
```

### Lens-specific hunting techniques

Use these as your toolbox when executing a charter. The goal is to provoke the app
in ways a spec author wouldn't think to write down.

**① Boundary overflow** — things the contract never bounded
- Strings: paste 10 KB of text, emoji sequences (🏳️‍🌈 multi-codepoint), RTL Unicode (؀؁),
  null bytes (`\x00` via DevTools console injection), leading/trailing whitespace
- Numbers: try -1, 0, 2147483647 (MAX_INT), 2147483648 (MAX_INT+1), floats where
  integers are expected, strings that look like numbers ("1e9", "Infinity")
- Files: 0-byte file, file with wrong extension but correct MIME type, size exactly at
  the stated limit and size+1 byte above it
- API: send the field missing entirely vs. `null` vs. `""` — three different cases even
  if the UI treats them the same

**② Concurrency** — same action, twice, at once
- Open two tabs or two browsers sharing the same session; navigate both to the same
  mutation form; submit within milliseconds of each other
- Rapid double-click on a mutation CTA: check DevTools → Network for duplicate POSTs
- Optimistic UI: click Save, navigate away immediately before the response arrives;
  return — was state lost, duplicated, or correctly reconciled?
- Two different roles editing the same aggregate simultaneously — last-write-wins vs.
  conflict detection

**③ State interruption** — break the flow mid-stride
- Browser Back after submitting step N of a multi-step wizard; then Forward again —
  is unsaved state preserved, lost, or doubled?
- Refresh immediately after clicking Submit (before the response) — race between
  browser reload and server confirmation
- Network drop mid-save: DevTools → Network → Offline → toggle back; does the app
  retry, error gracefully, or show stale data?
- Session expiry mid-form: delete the session cookie (DevTools → Application →
  Cookies → Delete) then attempt to submit — graceful redirect or silent failure?
- Tab sleep: leave the tab idle for 10–15 minutes, return, and try a mutation

**④ Cross-UC journey** — chain UCs end-to-end
- Create → Edit → Delete → Re-create the same entity with the same name/ID — does
  the second Create fail with an ID collision, ghost the deleted record, or succeed?
- Use the output of UC-A as adversarial input to UC-B: if UC-A allows a 500-char name,
  does UC-B's display truncate, wrap, or break layout?
- Partial completion of UC-A → switch to UC-B → return to UC-A — is the partial state
  saved, cleared, or corrupted?

**⑤ No-go probing** — is the excluded path truly absent?
- Direct URL: type a protected route into the address bar while unauthenticated or as a
  lower-privilege role
- API replay: in DevTools → Network, copy a privileged request as cURL, strip the auth
  cookie, replay — does the server reject it?
- DOM enable: find a disabled/hidden UI element, `element.disabled = false` or
  `element.style.display = 'block'` in the console, submit — does the server validate
  server-side?
- Path traversal in URL params (`../`, `%2F..`) for file/export endpoints

**⑥ Data residue** — what survives that shouldn't?
- Delete an entity, then navigate to its detail URL via browser history — 404, redirect,
  or stale cached data?
- Log out, log back in (same browser, same session storage) — does the new session show
  any leftover state from the prior session?
- DevTools → Application → Cache Storage / Local Storage / IndexedDB after logout —
  is sensitive data cleared?
- Re-download a previously generated export URL after the source data was deleted —
  does the export still serve the old data?

---

## Phase Q3 — Report

Write `qa/hunt-report.md`:

```markdown
# Hunt Report — [feature] (round [r], [date])
mode: [full | degraded | recheck]
charters: [run]/[approved] · session units spent: [n]
out of bounds (excluded): […]
hammered out at GATE Q1 (not hunted): […]

## Findings by lens
| Lens | Hunted | Findings | Of which contradicts-EVAL |
|---|---|---|---|
| ① Boundary | C-01, C-05 | 2 | 0 |
| … | | | |
→ details live in discovery/ledger.md ## QA Edge Findings (round [r])

## Shaping-quality signal (advisory, for the PO — next cycle's input)
- lens ⑤ findings ≈ No-gos written loosely (breach routes left open)
- lens ④ findings ≈ UC decomposition cut too disjointly (journeys fall in the seams)
- lens ① in degraded mode ≈ owed to the missing Test Surface, not to shaping

## Session notes
[per charter: what was tried, unconfirmed observations, open scents]
```

No verdict line exists in this file by design. The Hunter's last words:
`✅ hunt complete — [N] findings (all ~) → ledger · triage at SHIP S.0 / GATE L4.`

---

## `--recheck` mode (after triage promoted + fixed items)

```
Input: the promoted finding ids (from tech-lead) + the fix round's PASS EVAL report.
Q0   : hard checks only (app up, new EVAL PASS); no soft check, no charter map.
Hunt : re-run EXACTLY the recorded repro of each promoted finding — nothing else.
        fixed   → in the ledger, annotate the line: `~ [QA-NNN] … ✦ fixed r[N], verified`
                  (annotate, never delete — the ledger is history)
        not fixed → `✦ NOT fixed r[N]` + fresh evidence; back to triage.
Report: append a `## Recheck (round [r])` section to qa/hunt-report.md.
NEVER a second full hunt in the same cycle — new edges found while rechecking are
recorded `~` like any finding and wait for triage; they don't restart the loop.
```

---

## Invocation

```bash
# Orchestrated (how tech-lead calls it after first PASS)
/qa-edge-hunter --feature checkout-vnpay --spec .claude/specs/checkout-vnpay/ \
    --eval .claude/specs/checkout-vnpay/EVAL-FEATURE-checkout-vnpay.md \
    --ledger discovery/ledger.md --app http://localhost:3000

# Standalone (same arguments, human-invoked)
/qa-edge-hunter --feature checkout-vnpay --spec .claude/specs/checkout-vnpay/ --app http://localhost:3000
# (--eval/--ledger default to the conventional paths under --spec)

# Recheck after triage promoted + fixed findings
/qa-edge-hunter --recheck QA-001,QA-004 --feature checkout-vnpay --spec ... --app ...

# Escape hatches
--auto            # skip GATE Q1 pause (charter list logged, not reviewed) — Q0 hard
                  # checks and the out-of-bounds question are NEVER skipped
--lenses-note     # there is deliberately NO --lenses flag: the 6 lenses are fixed;
                  # narrow by cutting charters at GATE Q1 (or --auto + report)
```

### Progress Markers
```
⏸ GATE Q0   Preflight (hard + soft checks, out-of-bounds question)
▶ Phase Q1  Charter Map        ⏸ GATE Q1 Charter Review
▶ Phase Q2  Hunt — C-01 ✅ C-02 🔍 …   (findings stream to ledger live)
▶ Phase Q3  Report
✅ hunt complete — [N] findings (all ~) → ledger · triage at SHIP S.0 / GATE L4
```

---

## Hard rules (the never-list)

1. **Never a verdict.** The run's verdict is the evaluator's PASS. One judge.
2. **Never promote.** Every finding is born `~`. severity-hint advises; PO/TL decide.
3. **Never fix.** Read-only on code; execute-only on the app; write-only to its ledger
   section + qa/hunt-report.md.
4. **Never block ship.** A hunt with 40 findings and a hunt with 0 both end the same way:
   report, then triage at L4. The circuit breaker outranks the Hunter.
5. **Never re-probe covered territory.** EVAL-*.md territory is subtracted at Q1; an
   exception requires a `contradicts:` suspicion arising mid-hunt, not curiosity.
6. **Never run on FAIL.** Conformance first; edges after.
7. **Never invent severity from code reading.** Every finding has a live repro on the
   running app.
8. **Never gate on Test Surface.** Its absence degrades the hunt; it never blocks it.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-06-16 | Phase Q2: added "Lens-specific hunting techniques" — concrete toolbox (DevTools tricks, paste-bomb recipes, cookie manipulation, API replay, DOM enable) per all 6 lenses; replaces abstract "vary, provoke, chain". Findings format: added `test-gap: unit \| integration \| exploratory-only` field to advise ba-pitch-analyzer reconciliation on whether to generate a test-writing task. Phase Q1: charter quality guide (altitude definition — "one specific risk + concrete mission", with good/too-broad/too-narrow examples). |
| 1.0 | 2026-06-11 | Initial — QA-meeting Bước 2 ("QA-as-edge-hunter", Phương án 3). Pure worker, post-first-PASS, pre-ship. GATE Q0 preflight (hard: app/EVAL-PASS/ledger · soft: Test Surface → first-class degraded mode + `--surface-only` upgrade path). Phase Q1 charters = 6 fixed lenses × UC tree − EVAL-covered territory ([derivable-fallback] tagging in degraded mode). GATE Q1 charter review = scope hammer on QA itself. Phase Q2 session-based hunt, repro-required, findings stream live to discovery/ledger.md always `~` + severity-hint + `contradicts:` flag. Phase Q3 hunt-report (no verdict) + shaping-quality signal by lens. `--recheck` re-probes promoted items only (annotate, never delete). 8-rule never-list; triage owned by tech-lead SHIP S.0 / GATE L4. |
