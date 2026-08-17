# Ground truth — deriving each fact from the artifact

Every command here answers a question that documentation also answers. When they disagree, this
file wins, because it reads the thing itself.

Run these against the repo root. They are all read-only.

## Contents

- [Inventory: what exists on disk](#inventory-what-exists-on-disk)
- [Enums: the vocabulary the runtime enforces](#enums-the-vocabulary-the-runtime-enforces)
- [Operation ownership and write contracts](#operation-ownership-and-write-contracts)
- [Hook inventory and registration](#hook-inventory-and-registration)
- [Hook behavior: execute, do not read](#hook-behavior-execute-do-not-read)
- [Versions and the shipped set](#versions-and-the-shipped-set)
- [Test counts](#test-and-eval-counts)
- [Storage roots](#storage-roots)

## Inventory: what exists on disk

```bash
# Skills — the number docs quote as "the N skills"
ls -d skills/*/ | wc -l
ls -d skills/*/ | sed 's|skills/||;s|/||'

# Slash commands
ls commands/*.md | wc -l
ls commands/*.md | xargs -n1 basename | sed 's/\.md//'

# Oracles (the probing grammar users' fixtures invoke)
ls oracles/*.mjs | xargs -n1 basename

# Orchestrator scripts — docs routinely list a stale subset
ls kernel/*.mjs kernel/*/*.mjs | xargs -n1 basename
ls skills/tech-lead/workflows/
```

A skill directory with a `SKILL.md` is a skill. (There are no longer any `skills/*/evals/`
directories, nor a top-level `evals/` — that whole layer was removed.)

## Enums: the vocabulary the runtime enforces

The central registry is `skills/tech-lead/schemas/domain.schema.json`. Everything downstream —
which workers exist, which operations are dispatchable — is defined there and nowhere else.

```bash
node -e "
const s=require('./skills/tech-lead/schemas/domain.schema.json');
console.log('WorkerName  (%d):', s.\$defs.WorkerName.enum.length, s.\$defs.WorkerName.enum.join(', '));
console.log('Operation   (%d):', s.\$defs.Operation.enum.length, s.\$defs.Operation.enum.join(', '));
"
```

Two traps:

- **`WorkerName` excludes `tech-lead` and `shapeup`** — they are not dispatchable workers. So the
  worker count and the skill count are legitimately different numbers, and a doc that conflates
  them is wrong even when both figures appear correct in isolation.
- **The enum's own `description` field carries a prose ownership list** that drifts independently
  of the enum array. Check it separately:

```bash
node -e "
const s=require('./skills/tech-lead/schemas/domain.schema.json');
console.log(s.\$defs.Operation.description);
"
```

## Operation ownership and write contracts

The enum says an operation exists; the compiler says who owns it and what it may write. Both must
agree, and a doc's table of write targets is derived from the second.

```bash
# The routing map — grep the OP_OWNER literal
grep -n "OP_OWNER" -A 12 kernel/compile.mjs

# The actual substrate an operation is compiled with (authoritative — it is what the hook enforces)
node -e "
import('./kernel/compile.mjs').then(m=>{
  for (const op of ['analyze','reconcile','retrofit-surface','coverage','map-scopes','wire',
                    'evaluate','orient','hunt','translate','hammer','coach','execute',
                    'fix','spike']) {
    console.log(op, JSON.stringify(m.substrateFor(op,{slug:'demo'})));
  }
});
"
```

An operation with no `substrateFor` case silently falls to the default whitelist, which is usually
wrong and always worth flagging.

"No `OP_OWNER` entry" is *not* the same as "cannot be routed", and reading the map alone will
mislead you twice. Its keys are **unquoted** (`analyze:`, not `'analyze':`), so a grep for `'<op>'`
reports every entry missing. And `execute`/`fix`/`spike` are absent from the map by design — they
resolve through the `scopePath || --task || --next` branch just below it. Settle it by running the
compiler, which is the only thing that answers the question:

```bash
node <repo>/kernel/compile.mjs --operation <op> --slug demo --cwd "$PWD"
# exit 2 + "could not resolve --worker/--operation" = genuinely unroutable in that invocation
```

Compile a real order end to end when you want certainty:

```bash
mkdir -p /tmp/gt/.shapeup/demo/tasks && cd /tmp/gt
printf -- '---\nfeature: demo\n---\n| ID | Title | Status |\n|---|---|---|\n' > .shapeup/demo/tasks/_index.md
node <repo>/kernel/compile.mjs --operation coverage --slug demo --cwd "$PWD"
cat .shapeup/demo/orders/coverage.json
```

## Hook inventory and registration

Three things must line up: the files on disk, the registrations in `hooks/hooks.json`, and the
inventory the docs publish.

```bash
# Registered, grouped by event
node -e "
const h=require('./hooks/hooks.json').hooks;
for (const [evt,groups] of Object.entries(h))
  for (const g of groups)
    for (const x of g.hooks)
      console.log(evt.padEnd(14), (g.matcher||'*').padEnd(28), x.command.match(/[^/]+\.mjs/)?.[0]||x.command.slice(0,40));
"

# On disk but never registered = enforces nothing
ls hooks/*.mjs | xargs -n1 basename
```

Count `PreToolUse` entries specifically — that is the number docs quote, and note that
The envelope check is registered as `harness.mjs verify envelope` (`kernel/verify/envelope.mjs`), not from `hooks/`, so a
naive `ls hooks/` undercounts by one.

## Hook behavior: execute, do not read

The highest-value part of this catalogue. A hook's header comment, the design doc, and the glossary
can all describe behavior the hook no longer has.

The payload shape matters — `tool_input` field names differ per tool, and a wrong field name makes
the hook defer, which looks exactly like "permitted". For `Skill` the fields are **`skill` and
`args`**; `skill_name`/`skill_args` are not the field names, and a fixture using them probes
nothing while appearing to pass.

Always run the deny case **and** the permit case. A hook that denies everything and a hook that is
inert both produce a one-line result; only the pair distinguishes them.

```bash
# GATE L0.0 — does gate-intake deny an orchestrator dispatch with nothing to orchestrate?
mkdir -p /tmp/hb && cd /tmp/hb
echo '{"tool_name":"Skill","tool_input":{"skill":"shapeup-sdlc-plugin:tech-lead","args":"--unattended"},"cwd":"'$PWD'"}' \
  | node <repo>/hooks/gate-intake.mjs; echo "EXIT=$?"
# → {"hookSpecificOutput":{...,"permissionDecision":"deny",...}}  EXIT=0

# The permit half — same hook, resolvable intake.
echo '{"tool_name":"Skill","tool_input":{"skill":"shapeup-sdlc-plugin:tech-lead","args":"--pitch idea.md"},"cwd":"'$PWD'"}' \
  | node <repo>/hooks/gate-intake.mjs; echo "EXIT=$?"
# → empty stdout, EXIT=0
```

Read the result by shape, not by exit code alone:

| stdout | meaning |
|---|---|
| `{"hookSpecificOutput":{...,"permissionDecision":"deny",...}}` | denies |
| `{"systemMessage":"..."}` | advisory — permits and reports |
| empty, exit 0 | deferred: no rule matched, *or* the payload never reached the logic |

That last row is why an empty result is not evidence of anything. If you expect a decision and get
silence, suspect your fixture before concluding the hook is inert — then confirm by checking
whether a decision row was recorded:

```bash
cat .shapeup/decisions.jsonl 2>/dev/null   # a row proves the hook ran and what it concluded
```

For the sandbox guard, the fixture must supply the pointer the guard actually follows — an order
plus `.shapeup/active-order`. A scope-contract fixture leaves no pointer, the guard defers, and
every deny assertion passes vacuously against a hook that enforced nothing:

```bash
echo '{"tool_name":"Write","cwd":"'$PWD'","tool_input":{"file_path":"'$PWD'/some/path.ts"}}' \
  | node <repo>/hooks/sandbox-guard.mjs
```

## Versions and the shipped set

```bash
node -e "const a=require('./package.json'),b=require('./.claude-plugin/plugin.json');
console.log('package.json',a.version,'plugin.json',b.version, a.version===b.version?'OK':'MISMATCH')"

# The shipped boundary — allowlist plus its negations
node -e "console.log(require('./package.json').files.join('\n'))"

# What a publish would actually include
npm pack --dry-run 2>&1 | sed -n '/Tarball Contents/,/Tarball Details/p' | head -40
```

`npm pack --dry-run` is the ground truth for "does this ship". Use it whenever the allowlist's
negation patterns make a case ambiguous.

## Test counts

```bash
npm test 2>&1 | tail -3        # total checks + failures
```

**There is no measurement apparatus in this repo at all.** The per-skill trigger-eval datasets, the
Day-1 rubrics, the Day-2 failure register, `tools/trigger-eval.mjs`, `tools/skill-loop.mjs`, both
baselines, the fixture spine, the row renderers and the judge-first planted-bug fixtures were all
removed. Expect **no `evals/` directory** and no `examples/eval-planted-bug*`; a doc still promising
a measured activation rate, a craft delta, or a Tier-1/Tier-2 fixture is drift to fix, not a file to
go looking for.

The read-only projections in `kernel/probe/stats.mjs` (`--ratchet`, `--hooks`, and the
harvest report) are **not** part of that apparatus and must not be swept up with it: they reduce
over ledgers the harness writes during ordinary work, cost zero model tokens, and are the only
measurement surface that still exists.

**Section numbers are not unique, so do not use one to decide whether something still exists.** The
removal above took out a section numbered **16** (`02-skills.mjs`, "Tier-1 trigger-eval datasets…")
and one numbered **48**. A *different* §16 — "Workflow scripts … D5 floor + path-literal
discipline", in `16-workflows.mjs` — was already sharing that number and is still live, so "§16 was
removed" and "§16 runs today" are both true of different sections. §12 was duplicated the same way
until the report-parity module was retired with the benchmark; the live §12 is in `02-skills.mjs`.
Resolve a cited §N by grepping
`section("N.` and reading the title, never by the number alone. §7 was removed with the migration
runner and its ordinal was deliberately not reused. **§13** — the anti-leniency planted-bug fixture
in `04-oracles.mjs` — went the same way when the eval assets were deleted, and its ordinal is also
not reused.

The consequence worth carrying into any audit: the honesty invariant — no number written from
anything but a run that produced it — is no longer mechanically enforced. It used to fail CI. It
now depends on the reviewer, which means a fabricated or stale rate in the docs is exactly the kind
of thing this audit is for.

## Storage roots

Roots are resolved through one library, never spelled. A hardcoded root is a defect even when it
happens to be correct today.

```bash
node -e "
import('./kernel/lib/paths.mjs').then(m=>{
  console.log('SHARED', m.SHARED, '| LOCAL', m.LOCAL, '| LEGACY', JSON.stringify(m.LEGACY));
  console.log('decisions ->', m.decisions('/proj'));
});
"

# Anything spelling a root by hand instead of resolving it
grep -rn '"\.shapeup\|\x27\.shapeup\|"shapeup/' --include="*.mjs" --include="*.js" kernel skills hooks bin \
  | grep -v "lib/paths.mjs"

# The pre-ADR-0001 root is a live trap, not history: receipts written to `.shapeup-sdlc/` are
# invisible to every reader, so the symptom is zero telemetry rather than an error.
grep -rn "shapeup-sdlc/" --include="*.mjs" --include="*.js" kernel skills hooks bin | grep -v "lib/paths.mjs"
find . -name ".shapeup-sdlc" -type d -not -path "./.git/*"
```

Cross-check writers against readers: if one module writes a path and another reads a different one,
the channel between them is silently disconnected, and the symptom is an empty report rather than
an error.
