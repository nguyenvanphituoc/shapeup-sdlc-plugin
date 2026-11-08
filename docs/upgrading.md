# Upgrading an existing install

Updating an install **replaces code, and only code**: `migrate.sh` overwrites the installed skill
files for each detected CLI. Skill files are stateless, so this is a straight overwrite and
re-running it is free and always safe.

**Data migration has been removed.** Earlier versions carried a set of versioned migration scripts
that rewrote a project's own harness artifacts in place and recorded each in a committed ledger.
Every one of them existed to carry a project across a layout change that no supported version is
still on, so the machinery is gone rather than left running over nothing — a runner that reports
"nothing pending" on every invocation cannot be told apart from one that has quietly stopped
working. The consequence is stated here rather than left to be discovered: **an install old enough
to predate the current layout is not converted for you.** Run `install-harness.sh` against it
instead and treat it as a fresh install.

## Upgrading to the native-first release

This release removes the scripted decision engine. The loop that drives a run still lives in the `building`
skill, but it now reads the run's files and follows its own phase table instead of asking the kernel what
comes next, and it writes and applies orders itself. Nothing in your project's committed tree changes;
what changes is the command surface and what the runtime still checks.

**Removed kernel commands** — any script, CI step or note of yours that names one will fail:
`compile`, `reduce ingest`, `reduce board`, `reduce ship`, `reduce hill`, `verify spec`, `verify build`,
`verify budget`, `verify dispatch`, `probe resume | next | eval | owner | attempts | hunt | leg | requirements | t0 | digest`,
and `init fit`. **Kept:** `verify t0 | envelope | skills`, `gate`, `init run`. **Added:** `order open | close`, which arms and retires the
write fence.

**Removed with them:** the `hill-chart` skill and the `/hill` command (their only writer was the removed hill
reducer); the wall-clock breaker and `--wall-clock-budget`; `--dimensions` and `--breadboard` on `init run`
(the dimension set goes in each evaluate order, the breadboard is copied to the run's trace by the loop);
`--lens` (carried in each plan order); and `--adversarial-verify`. The local `harness-run.md` ledger is no longer
written; the run's ending is `close.json`.

**What the runtime no longer checks** is stated in `AGENTS.md`: spec lint at the board review, single-writer
ingest with its send-back-once refusals, the attested-attempt census, the round build gate, and the ship-report
generator are now the loop's discipline. The write fence, the dispatch receipts, the T0 witness, the gate
resolver and the envelope check are unchanged in what they refuse.

## Running it

**Option A — remote one-liner** (no clone needed; auto-detects installed CLIs):

```bash
curl -fsSL "https://raw.githubusercontent.com/nguyenvanphituoc/shapeup-sdlc-plugin/main/scripts/migrate.sh" | bash -s -- --directory . --yes
```

> As with the installer, the piped form consumes stdin, so pass `--yes`. Omit it when running
> from a clone to get the interactive CLI prompt.

**Option B — local clone:**

```bash
/path/to/shapeup-sdlc-plugin/scripts/migrate.sh --directory .    # replace installed skill files
```

## What the update does not do for you

Three things older installs used to get automatically. Each is now a manual check, and each is
worth making before your next run rather than at a gate.

### The knowledge base is per-reader and committed

`/retro` files each rule **by reader** under committed `shapeup/knowledge-base/<reader>.md`, read
back by `task-executor` / `qa-edge-hunter` / `orient` at the top of their next run, and by the loop's plan step (`plan.md`, plus the `ba-pitch-analyzer.md`, `scope-architect.md` and `solution-architect.md` files you already have). If
you still carry a single flat `.shapeup/knowledge-base.md`, it is gitignored, reaches no teammate
and is read by nothing. Move its rules into `shapeup/knowledge-base/_INBOX.md` and run `/retro`
to assign each one — GATE COACH-1 asks which skill owns a rule, it never assumes — then commit
`shapeup/` so the team inherits it on `git pull`.

### Three skills are gone; their commands are not

`scope-hammer`, `coach` and `translator` were folded into the `building` loop: the stop census, the retro and the
language gate are now steps and sub-commands of `/ship`. `/hammer` and `/retro` (with `--scan` and
`--research <stack>`) keep their names. A `shapeup/knowledge-base/scope-hammer.md`, `coach.md` or
`translator.md` is read by nothing — re-file its rules with `/retro` under one of the five categories.

### Metrics are sharded per machine, and local

The metrics feed now lives at `.shapeup/metrics/<machine-id>.jsonl` — per-machine shards under
the gitignored LOCAL root (ADR-0001: a committed shard keyed on a hostname only grows and puts a
machine name in the repo). If you still carry a committed `shapeup/metrics.jsonl` or
`shapeup/metrics/`, stop tracking it; new rows land under `.shapeup/metrics/`.

### The contract parsers were repaired; find what they now reject

v1.6.0 fixes five defects in one family — *the committed contract format fails silent* — plus a
schema tightening. Every one is a change to a **reader**, so the code arrives with the upgrade and
the knowledge of which of *your* files those readers now treat differently does not. In two cases
the change is from green to red, and you should meet that here rather than at a gate:

- **a committed contract the parser could not see** used to read as one that declared *nothing*, so
  every rule over it passed — `trace-lint` printing a green `0/0 engines reach` for a wiring map
  holding six correct rows. It is RED from v1.6.0.
- **list members split on their own commas** (HD-002) — already split in any contract written
  through the old round trip. The data is gone and cannot be restored by guessing, so candidates are
  named for a human to read.
- **a stored `FAIL` with no `file:line` locator** is rejected before ingest from v1.6.0; that round
  must be re-evaluated rather than resumed.

**Nothing rewrites these for you.** Two of the three are unrecoverable by machine, and the third is
a rewrite of a committed design document that a person should make and review. Worth checking at the
same time: if your gitignored `.claude/settings.local.json` still names `haiku` in the model matrix,
the shipped default has moved to `sonnet` — your machine's choice, but rarely the one you meant to
keep.

> Per-release upgrade notes are in [`CHANGELOG.md`](../CHANGELOG.md) under the release that shipped
> each change.

## Upgrading into 4.0 — the single loop

> History. The kernel commands named in this section were removed by the native-first release above.

4.0 is a breaking release. `/ship` now drives the run in your own session: the `building` skill asks
the kernel (`probe next`) what comes next, does it, and asks again. The `tech-lead` skill, the Workflow
script it launched, the courier sub-agents that script spawned to type kernel commands, the staged
copy of the script and the relaunch after every paused gate are all gone. Nothing on your disk changes
format — boards, contracts, ledgers, receipts and `shapeup/` keep their shapes, and a run opened by an
earlier release resumes from its artifacts.

**1. `--tiny` is no longer served.** The small-change lane was the `tech-lead` skill's prose loop and
went with it. `/ship --tiny` says so, and `init run --tiny` / `--lane tiny` exit 2 with the same message.
Run the full loop and size it with the pitch's appetite instead: `~1 week` gives a two-round budget, a
small shape yields one scope, and the gates and the verification floor are the ones a bigger pitch
crosses. If a script of yours passes `--tiny`, drop it.

**2. The `Workflow` permission is no longer needed, and the installer leaves it alone.** It is an
unscoped token — it authorises every dynamic workflow script in a project — so the installer no longer
adds it and, because a project may rely on it for scripts of its own, never removes it either. If your
settings carry `Workflow` only because an earlier `init` wrote it, delete it yourself. `npx shapeup-sdlc
init --no-native-workflow` is still accepted so existing scripts keep running, and does nothing. The whole
grant is the two Bash rules for `kernel/harness.mjs`.

**3. The launch switches moved onto `init run`.** `init run-args` is gone. `init run` takes
`--exec-model`, `--eval-model`, `--qa-model`, `--no-eval`, `--no-qa`, `--parallel-scopes`,
`--adversarial-verify` and `--lane full` beside the options it always had, and writes the launch record
(`.shapeup/<slug>/run-args.json`) in the same act as the receipt. **The model floor is enforced there**: an
`exec` or `eval` model below sonnet is refused with exit 2, naming the role (`qa` is not checked, and `eval`
is not under `--no-eval`). A model left unnamed is `$SHAPEUP_EXEC_MODEL` / `$SHAPEUP_EVAL_MODEL` /
`$SHAPEUP_QA_MODEL`, else `sonnet`. A run that is already open keeps the record it has: switches typed to
`init run` over an open run are not applied (exit 3), and `--force` reopens with new ones.

**4. A gate is answered where it is reached.** The loop prints the gate block, asks the PO one question, records
the answer with the source `PO (live)` and goes on. There is no `paused` return and nothing to relaunch; to
resume a run you killed, run `/ship` again. If you script around the harness, a run no longer ends at a gate.

**5. Smaller kernel surface.** `init run-args`, `reduce snapshot` (its facts are `probe resume --slug`),
`reduce verdict` and `probe concurrency` are gone, and so is the `.shapeup/workflows/` directory `init run`
used to fill — delete an old one. `probe resume` keeps `--require`, `--set-status`, `--mark-relaunch` and the
close options. A run that ships now exports its records at its close, like every other ending.

**6. Names.** A `Skill(...)` or command naming `tech-lead` resolves to nothing: use `/ship` (or the `building`
skill). Rules filed in `shapeup/knowledge-base/tech-lead.md` are still read, as `building` guidance.

## Upgrading into v2.0

> History. The kernel commands named in this section were removed by the native-first release above.

**Nothing on your disk changes format.** Boards, scope contracts, ledgers, receipts and `shapeup/`
all keep their shapes; the run graph a v2.0 run reads is *projected* from those same artifacts on
first touch, so a v1 tree needs no conversion. What changes is how you invoke the harness, and one
permission grant.

### Four things to know

**1. Re-run `init`.** Every pipeline script became a subcommand of one entry point, so the
per-script grants an older install wrote no longer name anything. `npx shapeup-sdlc init` removes
them and writes the new ones; your unrelated rules are left alone.

**2. Commands changed shape.** If you script around the harness:

| v1 | v2.0 |
|---|---|
| `node …/skills/tech-lead/scripts/init-run.mjs …` | `node …/kernel/harness.mjs init run …` |
| `node …/skills/tech-lead/scripts/compile-order.mjs …` | `node …/kernel/harness.mjs compile …` |
| `node …/skills/tech-lead/scripts/ingest-result.mjs …` | `node …/kernel/harness.mjs reduce ingest …` |
| `node …/skills/tech-lead/scripts/t0-verify.mjs …` | `node …/kernel/harness.mjs verify t0 …` |
| `node …/skills/tech-lead/scripts/gate-answers.mjs …` | `node …/kernel/harness.mjs gate …` |
| `node …/skills/ba-pitch-analyzer/scripts/spec-lint.mjs …` | `node …/kernel/harness.mjs verify spec …` |
| `node …/skills/tech-lead/scripts/run-workflow.mjs <script>` | gone in 4.0 — `/ship` drives the run |

`node …/kernel/harness.mjs --help` lists every verb; each subcommand rejects a bad flag at the argv
boundary with a machine-readable reason on stderr and exit 2, unchanged.

**3. Six hooks were retired.** Their work moved into the runtime rather than disappearing — see
README's enforcement table, which also states the one real coverage change (a long-running build
leg is no longer interrupted mid-flight, only prevented from opening another round).

**4. `probe resume --set-active-scope` is gone**, with the shared substrate pointer it wrote.
`sandbox-guard` reads every live order instead, which is what makes concurrent scopes safe.

### The grant, and the one decision in it

### Two things you must have for headless runs

**1. The pipeline grant, which is what starts the lane at all.**

```bash
npx shapeup-sdlc init      # writes two Bash rules for kernel/harness.mjs
```

**If you installed before v2.0, re-run `init`.** v2.0 replaced twenty-one pipeline entry points with
one — `kernel/harness.mjs`, with `verify | reduce | gate | probe | init | report | compile`
beneath it — so the grant is now two lines instead of forty-one, and the per-script rules an
older install wrote are removed by the same command. Your own unrelated rules are left alone.

```
Bash(node "*/kernel/harness.mjs" *)
Bash(node "*/kernel/harness.mjs")
```

Two Bash rules, because the trailing ` *` form requires at least one argument and a bare
`node "<path>"` needs the argument-less form. The leading `*` spans the install root — a marketplace
install lives in a version-stamped cache directory, a `--plugin-dir` checkout lives wherever you
cloned it — which is also what keeps the grant working across a plugin upgrade instead of silently
expiring. `npm run test:grant` proves these by execution: it starts real CLI sessions and decides
each case by whether the target's side effect landed on disk.

(The v2.0 grant carried a third entry, the unscoped `Workflow` token. It is no longer written and no longer
needed; see "Upgrading into 4.0" above.)

**A receipt does not prove the lane ran.** The run's first act writes one, so a receipt attests that
a session started, never that the pipeline executed. Check the run's artifacts.

### What a gate pause looked like in v2.0

In v2.0 a gate ended the run: it **returned** `paused` and you relaunched the same command. 4.0 removed that —
see "Upgrading into 4.0": a gate is answered in the session that reached it.

### Rolling back

**Pin `1.7.0-final`**, the last release of the script-runtime line. There are no dual paths: the
hand-rolled runtime and the per-script entry points were deleted rather than kept as a fallback, so
downgrading the package is the only way back — and a downgrade also means re-running `init`, because
the two grants do not overlap.

Know what the pin takes with it: the fan-out, the run graph, the pointer-free substrate guard and
the proven two-line grant all go together. If a v2.0 problem is worth pinning for, open an issue
rather than pinning — the rollback is deliberately coarse and we would rather fix forward.

## Why the entrypoints live where they do

Source resolution, CLI selection, and skill replacement are factored into a shared
`scripts/shapeup-sdlc/lib/lib-harness.sh`, which both entry points source.

The `install-harness.sh` / `migrate.sh` entrypoints stay at a stable `scripts/` path on
purpose — an update mechanism that broke its own bookmarked URL on every refactor would
defeat the point of having one.
