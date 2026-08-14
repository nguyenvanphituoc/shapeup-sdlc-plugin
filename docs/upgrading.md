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

### The knowledge base is per-skill and committed

`/coach` files each rule **by skill** under committed `shapeup/knowledge-base/<skill>.md`, read
back by `task-executor` / `ba-pitch-analyzer` / `qa-edge-hunter` at the top of their next run. If
you still carry a single flat `.shapeup/knowledge-base.md`, it is gitignored, reaches no teammate
and is read by nothing. Move its rules into `shapeup/knowledge-base/_INBOX.md` and run `/coach`
to assign each one — GATE COACH-1 asks which skill owns a rule, it never assumes — then commit
`shapeup/` so the team inherits it on `git pull`.

### Metrics are sharded per machine, and local

The metrics feed now lives at `.shapeup/metrics/<machine-id>.jsonl` — per-machine shards under
the gitignored LOCAL root (ADR-0001: a committed shard keyed on a hostname only grows and puts a
machine name in the repo). If you still carry a committed `shapeup/metrics.jsonl` or
`shapeup/metrics/`, stop tracking it; new rows land under `.shapeup/metrics/` and `harness probe stats`
reads them there.

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

## Upgrading into v2.0

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
| `node …/skills/tech-lead/scripts/run-workflow.mjs <script>` | `Workflow({scriptPath, args})` |

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
npx shapeup-sdlc init      # writes two Bash rules for kernel/harness.mjs, plus the "Workflow" token
```

**If you installed before v2.0, re-run `init`.** v2.0 replaced twenty-one pipeline entry points with
one — `kernel/harness.mjs`, with `verify | reduce | gate | probe | init | report | compile`
beneath it — so the grant is now three lines instead of forty-one, and the per-script rules an
older install wrote are removed by the same command. Your own unrelated rules are left alone.

```
Bash(node "*/kernel/harness.mjs" *)
Bash(node "*/kernel/harness.mjs")
Workflow
```

Two Bash rules, because the trailing ` *` form requires at least one argument and a bare
`node "<path>"` needs the argument-less form. The leading `*` spans the install root — a marketplace
install lives in a version-stamped cache directory, a `--plugin-dir` checkout lives wherever you
cloned it — which is also what keeps the grant working across a plugin upgrade instead of silently
expiring. `npm run test:grant` proves these by execution: it starts real CLI sessions and decides
each case by whether the target's side effect landed on disk.

**The third entry is the one to read before you accept it.** `"Workflow"` is what lets the tech lead
launch `shapeup-run.js` without an approval prompt, and it is the reason a v2.0 run gets
resume-from-journal, worktree isolation and prompt-cache-warm sub-agents. It **cannot be narrowed**:
`Workflow(<path>)` and `Workflow(<script-name>)` are both denied, so the bare token authorises
*every* dynamic workflow script in that project, including one written at runtime. Decline it with:

```bash
npx shapeup-sdlc init --no-native-workflow
```

An install that declines still runs the harness — the launch simply asks for approval once per
session, which means the unattended lane is unavailable there.

**A receipt does not prove the lane ran.** The run's first act writes one, so a receipt attests that
a session started, never that the pipeline executed. Check the run's artifacts.

### What a gate pause looks like now

Gates no longer block inside a turn — the run **returns** at one. You will see the gate block, and
the run ends with `paused`. Answer it, then relaunch the *same* command with the *same* arguments:
the fast-forward re-derives position from disk and re-dispatches nothing already finished. The same
mechanism means a session killed mid-run resumes where it died instead of starting over.

If you script around the harness, that is the behavioural change to account for: a paused run is a
normal, zero-exit outcome that expects a relaunch, not a failure to retry differently.

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
