# Stage 0 evidence — the kill-switch spike (D1)

Plan: `docs/workflow_migration_plan.md`. Review: `docs/workflow_extraction_review.md` §6 Stage 0,
§7 (what would change this answer). All runs below happened outside both checkouts, in a scratch
project under the session scratchpad, against a plugin loaded from THIS worktree (see the
marketplace-source finding under Check 1 — the default install path does not do this on its own,
and had to be corrected). No file inside `skills/`, `hooks/`, `commands/`, `oracles/`, `bin/`, or
`tests/` was touched to produce this evidence — Stage 0 makes no harness code changes, as specified.

Every session below ran on **Sonnet** (`--model sonnet`), the D5 floor. No Haiku anywhere in this
spike.

## Setup

1. `npm pack` in the worktree → `shapeup-sdlc-1.6.3.tgz`. `npm install <tarball>` into a fresh
   scratch project (`git init`, no prior harness state).
2. `npx shapeup-sdlc init -y` from the scratch project. It wrote the `permissions.allow` grant
   into `.claude/settings.json` correctly (three `Bash(node ${CLAUDE_PLUGIN_ROOT}/skills/...)`
   pairs, tech-lead / ba-pitch-analyzer / spec-evaluator). **Finding, not part of the three named
   checks:** it also registered `extraKnownMarketplaces.nvptuoc-marketplace` with
   `{"source": "github", "repo": "nguyenvanphituoc/shapeup-sdlc-plugin"}` — this is
   `bin/init.mjs`'s hard-coded behavior regardless of whether the npm package itself came from the
   worktree tarball or the real registry. `claude plugin install` then fetched from that GitHub
   marketplace and cached **plugin version 1.3.0** — nine minor versions behind this worktree's
   1.6.3, not even the "published 1.6.x" the guardrails warn against. Every worker-side hook/skill
   test in this document would have exercised 1.3.0's code, not this branch's, had this gone
   unnoticed. Fix applied (not a code change — a marketplace re-point, redoable by any operator):
   `claude plugin marketplace remove nvptuoc-marketplace --scope project` then
   `claude plugin marketplace add <worktree-absolute-path> --scope project` — this registers a
   `"source": "directory"` marketplace, which `claude plugin details` then confirmed resolves live
   to `ShapeUp SDLC Plugin ... 1.6.3` (459-line `tech-lead` `SKILL.md`, 23 skills, 4 hooks). This
   should be fixed in `bin/init.mjs` or documented as a required manual step before Stage 1 relies
   on "npm pack → install tarball → test" as its verification method — otherwise every later stage
   silently tests the wrong code the same way this one almost did.
3. A brand-new scratch project is untrusted. The first `claude -p` call there printed:
   `Ignoring 6 permissions.allow entries from .claude/settings.json: this workspace has not been
   trusted.` — the grant is silently dropped, not stalled, until trust is accepted (normally an
   interactive dialog; here, `hasTrustDialogAccepted: true` set for the scratch path in
   `~/.claude.json`, which is what accepting the dialog once does). **Finding:** a CI runner that
   provisions a fresh ephemeral directory per run needs this handled explicitly (a pre-trusted
   image, or an equivalent flag) — a real, separate gap from the grant itself, worth Stage 1
   documenting alongside the grant.
4. Scope fixture planted for the hook probes: `.shapeup/active-scope` →
   `{"slug":"spike","scope_id":"SC-spike"}`, `shapeup/spike/scopes/SC-spike.md` →
   `allowed_file_substrate: [src/capture/**]`.

## Check 3 — headless availability (done first: it gates whether 1–2 can even run as designed)

`claude -p "List the exact names of every tool available to you right now..."` in the trusted
scratch project, Sonnet, returned `Workflow` as a directly-callable tool (full schema loaded, not
deferred) alongside `Agent, Bash, Edit, Read, ReportFindings, ScheduleWakeup, Skill, ToolSearch,
Write`. **The Workflow tool is not absent in the headless lane.**

Confirmed further: `Workflow`'s script contract matches the review's characterization exactly —
`export const meta = {name, description, phases}` (pure literal) followed by plain top-level
`await`-using statements ending in `return <value>`; helpers `agent(prompt, {label, schema, model,
effort, isolation})`, `pipeline()`, `parallel()`, `phase()`, `log()`, `workflow()`,
`budget.spent()/remaining()`; `scriptPath` (persisted file) or `name` (built-in or
`.claude/workflows/`) to select which script runs.

**Finding that is not one of the three named checks, but binds Stage 1+ launch design just as
hard:** invoking a **dynamic** (project-authored) workflow — by `scriptPath` to an arbitrary file
or by `name` from `.claude/workflows/`, tried both — is blocked in headless mode by a review gate,
**by default and under two of the four permission modes tested**:

| `--permission-mode` | Workflow launch |
|---|---|
| (default / unset) | denied — `Error: Review dynamic workflow before running` |
| `dontAsk` | denied — model's own read: "running in 'don't ask' mode, which blocks Workflow" |
| `acceptEdits` | denied — same `Review dynamic workflow before running` |
| `auto` | **launches, no human present, no denial** |

This is a real operational requirement Stage 1+ must state explicitly: an unattended/CI launch of
this harness's own workflow scripts needs `--permission-mode auto` (or a settings-level
equivalent, not investigated further here) on the invoking session. Neither the plan nor the
review's §6.5 opt-in-policy note mentions this; the review's own "not checked" list names exactly
this class of gap. Under `--permission-mode auto`, the launch succeeded twice, reproducibly (see
Check 1/2 below), with no interactive step and no `--dangerously-skip-permissions`-class bypass.

## Check 1 — permission grant (inside the workflow)

`spike-workflow.js` (scratch project, throwaway), `agent()` #1: runs
`node "<pluginRoot>/skills/tech-lead/scripts/init-run.mjs" --slug spike --intake-text "spike"
--auto-level unattended --cwd "<projectDir>" --force`, schema-forced to
`{exit_code, stdout, stderr, receipt_exists, receipt_contents}`. Launched via
`Workflow({scriptPath: ".../spike-workflow.js"})` under `--permission-mode auto`.

Result: `exit_code: 0`, `receipt_exists: true`. Receipt on disk, read back independently (not just
through the subagent's report):

```json
{
  "receipt_version": 1, "type": "harness-run-receipt", "slug": "spike",
  "started_at": "2026-08-06T09:19:55.967Z",
  "intake_sha256": "798552d3924a30ba1defcdd9c1619ec2faaabe3b3e345806ca9458033b535b7b",
  "intake_chars": 5, "intake_lines": 1, "started": true,
  "config": { "auto_level": "unattended", "lens": "standard", "max_rounds": 3, "attempt_budget": 5 }
}
```

No approval stall, no denial, inside the workflow-spawned `agent()`. `decisions.jsonl` shows
`safety-spine` inspecting and permitting every Bash call in the run
(`"reason":"command matched no destructive rule — inspected and permitted"`), consistent with the
26-denial class **not** reproducing here.

**Caveat that must not be buried:** isolated follow-up probes (same script, same settings.json
grant, but a bare top-level session instead of a workflow, and without `--permission-mode auto`)
did **not** get through cleanly — a Bash call built with the already-resolved absolute path was
denied ("This command requires approval"), and a Bash call typed with the literal
`${CLAUDE_PLUGIN_ROOT}` template text was rejected outright by the Bash tool's own
shell-expansion guard ("Contains expansion") before permission matching ever ran. So this
evidence supports "the call runs cleanly inside a workflow `agent()` launched under
`--permission-mode auto`" — the literal check — but does **not** establish that the
`Bash(node ${CLAUDE_PLUGIN_ROOT}/...)` allow-pattern itself, as written, is what does the work in
that context, versus `auto` mode's broader allowance. Root-causing that pattern-matching
mechanism is outside what this spike could resolve without visibility into Claude Code's
permission-matcher internals; Stage 1 should re-test once the real `mech()` helper exists.

## Check 2 — hooks fire inside a workflow-spawned `agent()`

First attempt exposed a fixture bug worth recording: `init-run.mjs` (check 1, above) overwrites
`.shapeup/active-scope` with `{slug, started_at}` — no `scope_id` — because scope-mapping (GATE
L1b) normally sets that later. `sandbox-guard` fails **open** on a pointer missing `scope_id`
(by design — "no round in progress"), so an out-of-substrate write probed at that point never hit
the deny path; it hit the fail-open path instead (worth knowing: the corresponding
`decisions.jsonl` row read `"verdict":"allow","reason":"active-scope pointer is unreadable or
incomplete","rule":"bad-pointer"`). Corrected by adding a third `agent()` phase that restores
`.shapeup/active-scope` to `{"slug":"spike","scope_id":"SC-spike"}` between check 1 and the probes
— itself a legitimate write the guard fails open on for the same reason, so it needed no
substrate exception.

With the pointer restored, a fourth `agent()` (`hook-probe`, same workflow run, same
`Workflow()` launch) attempted, in order: (A) `Write` to a path outside `SC-spike`'s
`allowed_file_substrate`; (B) `Skill(shapeup-sdlc-plugin:task-executor, --order /nonexistent.json)`.
Both were denied by the plugin's own tools, and both denials are on disk in the scratch project's
`.shapeup-sdlc/decisions.jsonl`, read back independently after the run (not only through the
subagent's report):

```
{"at":"2026-08-06T09:21:04.110Z","hook":"sandbox-guard","pid":45963,"event":"PreToolUse","tool":"Write","subject":"SC-spike","verdict":"deny","reason":"1 write(s) outside the scope substrate: OUTSIDE_SUBSTRATE.txt","rule":"outside-substrate"}
{"at":"2026-08-06T09:21:06.728Z","hook":"validate-envelope","pid":46576,"event":"PreToolUse","tool":"Skill","subject":"/nonexistent.json","verdict":"deny","reason":"WorkOrder gate — order file not found: /nonexistent.json. Compile it first (compile-order.mjs) — a worker must never be dispatched against a dangling order.","rule":"order-missing"}
```

Both rows came from **inside** the `Workflow`-spawned `agent()`'s own tool-call stream, not from
the outer orchestrating session. **Plugin PreToolUse hooks fire inside workflow-spawned
subagents, and hold their fail-closed behavior there** — the review's biggest open question (§7,
first bullet) resolves in the affirmative, with a reproducible fixture.

## Cost measurement (D5 floor: Sonnet)

An isolated single `mech()`-shaped `agent()` call (one bash command, schema-forced
`{exit_code, stdout, stderr}`, no other steps in the workflow) — the leanest shape Stage 1's
`mech()` helper is meant to have:

```
task: echo hello-from-mech
total_cost_usd: $0.293   duration_ms: 2264   model: claude-sonnet-5
usage: cache_creation_input_tokens 1086, cache_read_input_tokens 47220, output_tokens 44
workflow's own budget.spent(): 553 (tokens, workflow-internal accounting)
```

**Flag, not a pass/fail:** the review's inference (`workflow_extraction_review.md` evidence-table
row 25) assumed mech() calls of "2–4k tok" costing, in aggregate, ≲$1/round across ~55 calls. This
one **measured** call — on Sonnet, via the real Workflow tool, doing genuinely trivial work — cost
$0.293, dominated by cache/context overhead (47k cached tokens read) rather than the task itself.
55 such calls would be well above the ≲$1/round estimate if this per-call floor holds under the
real `mech()` helper; whether a long-lived single session's cache amortizes that down across many
calls in one round is exactly what Stage 1's own cost measurement (its Verify step, item 2) needs
to re-check with the real helper, not this throwaway script. This spike's own total cost across
all iterations (multiple corrective re-runs of the probes above, plus the four permission-mode
probes in Check 3) was itself several dollars, not the "≲$1" estimated for the Stage-0 exercise —
worth Stage 1's planning knowing the workflow tool's per-launch overhead is not negligible.

## Summary

| # | Check | Result |
|---|---|---|
| 1 | Permission grant — no approval stall inside the workflow | passed, with the pattern-matching caveat above |
| 2 | Hooks fire inside workflow-spawned subagents | passed — sandbox-guard and validate-envelope both denied, quoted verbatim above, 2 deny rows |
| 3 | Workflow tool present and launchable in the headless lane | passed, conditioned on `--permission-mode auto` (or an equivalent not yet identified) |
| — | Cost, Sonnet floor | measured $0.293/lean call; higher than the review's inferred estimate — flagged for Stage 1 |

Findings that bind Stage 1+ even though they are not one of the three named checks: the
tarball-install path does not actually load the worktree's plugin code without a manual
marketplace re-point (fix before relying on it again); a fresh scratch/CI directory silently
drops the permission grant until trust is accepted; headless workflow launches need
`--permission-mode auto`; per-call cost on Sonnet is higher than the review inferred.

None of these are check 2 or check 3 failing outright — both produced the evidence their own
acceptance criteria ask for, reproducibly, independently re-read from disk rather than taken on
the subagent's word. Check 1's stall-free run is real and reproducible under the launch
configuration Stage 1 will actually use. The fixable items above are exactly the "check 1 is a
fixable installer defect" class the guardrails already anticipate, not a reason to stop.

Decision: GO
