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
- [Test and eval counts](#test-and-eval-counts)
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
ls skills/tech-lead/scripts/*.mjs skills/tech-lead/scripts/lib/*.mjs | xargs -n1 basename
ls skills/tech-lead/workflows/
```

A skill directory with a `SKILL.md` is a skill. A directory that only holds `evals/` is not — check
before counting.

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
grep -n "OP_OWNER" -A 12 skills/tech-lead/scripts/compile-order.mjs

# The actual substrate an operation is compiled with (authoritative — it is what the hook enforces)
node -e "
import('./skills/tech-lead/scripts/compile-order.mjs').then(m=>{
  for (const op of ['analyze','reconcile','retrofit-surface','coverage','map-scopes','wire',
                    'evaluate','orient','hunt','translate','hammer','coach','execute']) {
    console.log(op, JSON.stringify(m.substrateFor(op,{slug:'demo'})));
  }
});
"
```

An operation in the enum with no `OP_OWNER` entry cannot be routed. An operation with no
`substrateFor` case silently falls to the default whitelist, which is usually wrong and always
worth flagging.

Compile a real order end to end when you want certainty:

```bash
mkdir -p /tmp/gt/.shapeup/demo/tasks && cd /tmp/gt
printf -- '---\nfeature: demo\n---\n| ID | Title | Status |\n|---|---|---|\n' > .shapeup/demo/tasks/_index.md
node <repo>/skills/tech-lead/scripts/compile-order.mjs --operation coverage --slug demo --cwd "$PWD"
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
`validate-envelope.mjs` is registered from `skills/tech-lead/scripts/`, not from `hooks/`, so a
naive `ls hooks/` undercounts by one.

## Hook behavior: execute, do not read

The highest-value part of this catalogue. A hook's header comment, the design doc, and the glossary
can all describe behavior the hook no longer has.

The payload shape matters — `tool_input` field names differ per tool, and a wrong field name makes
the hook defer, which looks exactly like "permitted".

```bash
# GATE L2 against a partial board — does it deny, warn, or say nothing?
mkdir -p /tmp/hb/.shapeup/dm/tasks && cd /tmp/hb
printf -- '---\nfeature: dm\n---\n| ID | Title | Status |\n|---|---|---|\n| TASK-001 | a | done |\n| TASK-002 | b | ready |\n' > .shapeup/dm/tasks/_index.md
printf -- '---\nid: TASK-001\nstatus: done\n---\n'  > .shapeup/dm/tasks/TASK-001.md
printf -- '---\nid: TASK-002\nstatus: ready\n---\n' > .shapeup/dm/tasks/TASK-002.md
echo '{"tool_name":"Skill","tool_input":{"skill_name":"spec-evaluator","skill_args":"--spec shapeup/dm/spec --feature dm --single-pass"},"cwd":"'$PWD'"}' \
  | node <repo>/hooks/gate-l2.mjs; echo "EXIT=$?"
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

## Test and eval counts

```bash
npm test 2>&1 | tail -3        # total checks + failures

# Trigger-eval dataset, per skill and total
node -e "
const fs=require('fs');let pos=0,neg=0,tot=0,n=0;
for (const d of fs.readdirSync('skills')) {
  const p='skills/'+d+'/evals/trigger-evals.json';
  if (!fs.existsSync(p)) continue;
  n++; const c=JSON.parse(fs.readFileSync(p,'utf8'));
  for (const x of c.cases||[]) { tot++; x.should_trigger===false?neg++:pos++; }
}
console.log({skills:n,total:tot,positives:pos,negatives:neg});
"

# The committed baseline — compare its datasets block against the live numbers above
node -e "
const b=require('./evals/baselines/trigger-evals.baseline.json');
console.log('status',b.status,'model',b.model,'measured_at',b.measured_at);
console.log('datasets:',Object.keys(b.datasets||{}).length,'results:',Object.keys(b.results||{}).length);
"
```

A baseline whose `results` still name a skill the tree no longer has is a stale measurement, not a
count to be corrected. Report it; do not rewrite the rate. See the honesty section in `SKILL.md`.

## Storage roots

Roots are resolved through one library, never spelled. A hardcoded root is a defect even when it
happens to be correct today.

```bash
node -e "
import('./skills/tech-lead/scripts/lib/paths.mjs').then(m=>{
  console.log('SHARED', m.SHARED, '| LOCAL', m.LOCAL, '| LEGACY', JSON.stringify(m.LEGACY));
  console.log('decisions ->', m.decisions('/proj'));
});
"

# Anything spelling a root by hand instead of resolving it
grep -rn '"\.shapeup\|\x27\.shapeup\|"shapeup/' --include="*.mjs" --include="*.js" skills hooks bin \
  | grep -v "lib/paths.mjs" | grep -v "/evals/"
```

Cross-check writers against readers: if one module writes a path and another reads a different one,
the channel between them is silently disconnected, and the symptom is an empty report rather than
an error.
