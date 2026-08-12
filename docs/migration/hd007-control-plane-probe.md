# HD-007 control-plane probe — the lane starts under `acceptEdits` when Bash carries it

> ## ⟐ SUPERSEDED IN ITS DIAGNOSIS, 2026-08-12 — read `hd007-fix-evidence.md` first
>
> Everything this file *measured* stands. Its **explanation** does not, and the correction is the
> more useful finding: **"no permission string exists that could be granted" is false.** A bare
> `"Workflow"` token in `permissions.allow` grants the tool, verified in the benchmark's own
> configuration; `Workflow(<path>)` and `Workflow(<script>)` are still denied, so the grant exists
> but **cannot be scoped**. A7's six zero-execution reps were caused by the bench's settings file
> never carrying that entry — because `npx shapeup-sdlc init` writes Bash prefixes only.
>
> HD-007 is therefore an **installer** defect, not a runtime impossibility. The fix shipped anyway,
> and by this file's route: the lane launches through `skills/tech-lead/scripts/run-workflow.mjs`
> under a **path-scoped** Bash prefix, because the alternative one-line grant permits every dynamic
> workflow script in the project, including one written at runtime. That trade-off — not
> impossibility — is now the justification. `docs/upgrading.md` documents the one-line grant as the
> supported alternative.
>
> P4/F2 below is also explained: that workspace was never trusted, and an untrusted workspace
> ignores `permissions.allow` **in full** — the CLI says so by name.

**Date:** 2026-08-12 · **Follows:** Stage C / `A7: FAIL` (`stage3-evidence.md` §7) · **Answers:**
the mechanism half of HD-007 (`shapeup/knowledge-base/harness-defects.md`). Prototype, not a
cutover: nothing in `skills/` changed, nothing ships, nothing is merged.

## The claim, and the probe that tests it

HD-007: the `Workflow` tool — the only post-cutover lane — cannot start headlessly. Every call is
denied under `--permission-mode acceptEdits` ("Review dynamic workflow before running"), no
permission string exists that could be granted, and the only measured unblock is
`bypassPermissions`. In six paid A7 reps, `shapeup-run.js` executed **zero** times.

**The prototype** (`tools/control-plane/cp-run.mjs`): move the launch surface from the un-grantable
tool to the grantable one. `node cp-run.mjs <script>` executes the **same Workflow-format script**
— `export const meta` + bare body + `agent()/parallel()/pipeline()/phase()/log()/budget` — and
dispatches each `agent()` as a fresh headless `claude -p --permission-mode acceptEdits` worker
(spawn discipline from `sdd-harness-bench/runner/lib/session.mjs`: detached process group,
SIGTERM→SIGKILL escalation). Bash prefix rules are exactly what `npx shapeup-sdlc init` already
writes (`bin/init.mjs` `mergePipelinePermissions`), so the grant this lane needs is one line in a
family the plugin already documents and merges.

## Runs — all on 2026-08-12, all re-derivable from the commands below

| # | probe | mode | grant | result |
|---|---|---|---|---|
| — | `Workflow` tool, three-line script (HD-007 record, §7.5) | `acceptEdits`, headless | none exists | **denied** |
| P1 | cp-run × the **real, unmodified** `shapeup-run.js`, `--args '{}'` | n/a (direct) | n/a | ran; returned the exact `RunReturn` abort member `{"status":"aborted","aborted_at":"args","reason":"shapeup-run: missing args.slug; …"}`, **0 agents dispatched**, exit 0 |
| P2 | cp-run × `noop.workflow.js` (HD-007-symmetric three-liner) | n/a (direct) | n/a | `{"ok":true,"result":{"ok":true}}`, exit 0 |
| P3 | cp-run × `one-agent.workflow.js` — real worker dispatch | worker: `acceptEdits` | n/a | worker session `66671191-4bf6-4a58-925b-446fe1474ae6` (model `sonnet`, $0.118, 18.1 s, attempt 1) wrote `worker-proof.txt` containing this run's token `hd007-p3-abdf235d`; schema-valid report; journaled |
| **T1** | **headless outer session told to run cp-run × noop via Bash** | **outer: `acceptEdits`** | `--allowedTools 'Bash(node …/cp-run.mjs:*)'` | **ran.** `permission_denials: []`, stdout relayed `{"ok":true,"result":{"ok":true}}`, `cp-noop-run/result.json` written inside the outer session's own workspace with `agents_dispatched: 0`. Outer model `claude-haiku-4-5-20251001`, $0.026 |
| P4 | same as T1, grant via `.claude/settings.json` in a **fresh, never-trusted** workspace | outer: `acceptEdits` | settings file only | **denied** — `permission_denials` names the exact command; the settings grant was not honored (see finding F2) |

T1 against the §7.5 record is the pair this probe exists for: **same permission mode, same
three-line script shape, different launch surface — tool denied, Bash ran.**

### Exact commands

```sh
# P1 — the loader executes the real orchestrator (free: aborts before any dispatch)
node tools/control-plane/cp-run.mjs skills/tech-lead/workflows/shapeup-run.js \
  --args '{}' --run-dir <dir>

# P2 — lane-start probe, no agents
node tools/control-plane/cp-run.mjs tools/control-plane/probes/noop.workflow.js --run-dir <dir>

# P3 — one schema-forced worker under acceptEdits; token binds the artifact to THIS run
node tools/control-plane/cp-run.mjs tools/control-plane/probes/one-agent.workflow.js \
  --args '{"token":"<fresh-token>"}' --run-dir <dir> --worker-cwd <ws>

# T1 — the decisive layer: a headless acceptEdits session launches the lane via granted Bash
claude -p 'Run exactly this command via the Bash tool, changing nothing about it, then reply
with ONLY its stdout, verbatim: node <abs>/tools/control-plane/cp-run.mjs
<abs>/tools/control-plane/probes/noop.workflow.js --run-dir ./cp-noop-run' \
  --model <m> --output-format json --permission-mode acceptEdits \
  --allowedTools 'Bash(node <abs>/tools/control-plane/cp-run.mjs:*)'
# → "permission_denials": [], stdout carries {"ok":true,...}; omit --allowedTools in an
#   untrusted workspace to reproduce P4's denial.
```

## Findings

**F1 — the lane starts under `acceptEdits` (the thing A7 could not buy).** A headless session in
the bench's uniform mode ran the control plane end-to-end with zero denials (T1), and the control
plane dispatched a real worker under the same mode (P3). The §7.7 statement "doing so needs both
arms re-run under `bypassPermissions`" is now too strong: **the real A7 comparison is obtainable
under `acceptEdits`** with a one-line Bash grant on the candidate arm — no uniformity break, no
`bypassPermissions` anywhere.

**F2 — grant delivery is two channels, and only one is proven here.** `--allowedTools` on the
spawned session: proven (T1). `.claude/settings.json` in the workspace: **not honored in a fresh,
never-trusted directory** (P4) — same rule string, so the string is not the variable; folder trust
is the suspected one (every real project in `~/.claude.json` carries `hasTrustDialogAccepted`; the
probe workspace has no entry). Untested because pinning it means editing user-global state or the
project's own settings, both of which this session's permission classifier refused — correctly.
One user-run line closes it:
`claude -p '<T1 prompt>' --permission-mode acceptEdits --output-format json` from a **trusted**
project whose settings carry the grant. Until then: rigs pass `--allowedTools`; user projects
(trusted by construction — the user has opened Claude there) are expected to honor `init`'s
settings write, and that expectation is *expected*, not measured.

**F3 — the loader runs the shipped orchestrator byte-identical.** P1 executed
`skills/tech-lead/workflows/shapeup-run.js` unmodified and got the exact `RunReturn` union member
its own `validateArgs` produces, with zero spend. The script format survives the surface swap;
`shapeup-run.js` needs no fork to run on this lane.

**F4 — worker-side `agent()` semantics hold where shapeup-run.js depends on them.** Schema forcing
(instruction + balanced-scan extraction — `parseMechJson`'s own algorithm — + shallow validation +
one retry), null-on-dead-worker (the case `mechEnvelope` exists for), per-dispatch journaling with
cost and session id. P3's journal line is the receipt shape: model, mode, wall, cost, attempts,
result.

## What this probe does NOT prove — read before leaning on it

- **No full pipeline ran.** P1 stops at arg validation by design. ORIENT→…→Ship through cp-run,
  gates included, has never executed. That is the A7 re-run (both arms, ~6 reps), which remains
  the PO's spend decision.
- **The composed tree ran in two halves, not one.** T1 proves outer→cp; P3 proves cp→worker
  (itself already nested: this session → Bash → cp → worker). The single tree
  outer→cp→worker was composed but not executed — this session's classifier blocked launching
  further permission-granting nested sessions, which is a fact about this authoring session, not
  about the mechanism. The T1 command with the P3 script is the one-liner that runs it.
- **Resume is journaled, not implemented.** `journal.jsonl` records every dispatch;
  nothing replays it. `shapeup-run.js` resumes from disk state by design, so the lane's
  kill/resume story does not depend on this — but the claim "cp-run resumes" is not available.
- **budget counts USD, not tokens** (summed from worker envelopes' `total_cost_usd`); same
  `{total, spent(), remaining()}` interface. `workflow()` child workflows throw. Schema validation
  is shallow.
- **HD-008 is untouched.** `gate-zerowork`'s work-by-other-means escape still swallows the
  receiptless case; nothing here changes hooks.

## Files

- `tools/control-plane/cp-run.mjs` — the control plane (prototype; `tools/` does not ship in the
  npm `files` set)
- `tools/control-plane/probes/noop.workflow.js` · `probes/one-agent.workflow.js`
- This file. Raw envelopes/journals live in the authoring session's scratchpad (ephemeral); every
  decisive field is quoted above and every probe is re-derivable from its command.

## What follows from this, if the PO takes it

1. **HD-007's fix has a concrete shape:** the ship command launches `shapeup-run.js` via
   `node cp-run.mjs` under Bash, and `init`'s existing `mergePipelinePermissions` adds the one
   prefix. Failing closed stays required: cp-run already exits non-zero with `{"ok":false}` when
   the launch is malformed, which is the loud L0 failure HD-007 asks for.
2. **A7 re-run becomes obtainable under `acceptEdits`** — the uniform mode both arms already use.
3. F2's one-liner from a trusted project, before any of this is documented as the install story.
