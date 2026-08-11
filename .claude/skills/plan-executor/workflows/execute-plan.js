export const meta = {
  name: 'execute-plan',
  description: 'Execute a staged plan contract one stage at a time, verify each in a fresh clone, and freeze → diagnose → fix → re-verify every failure until acceptance is green or the budget runs out',
  whenToUse: 'Driven by the plan-executor skill, against a contract.md compiled from a staged plan document.',
  phases: [
    { title: 'Preflight', detail: 'run every acceptance in a clean room — what is already done?' },
    { title: 'Execute', detail: 'implement one stage against its acceptance' },
    { title: 'Verify', detail: 'fresh clone, run the stage acceptance' },
    { title: 'Diagnose', detail: 'freeze the failure, three lenses, one adjudicator' },
    { title: 'Fix', detail: 'apply the adjudicated fix' },
  ],
};

// ---------------------------------------------------------------------------
// Everything on disk is markdown. This script holds only what control flow needs: which stages
// exist, what depends on what, and the budgets. The agents read `contract.md` for the rest —
// intent, acceptance commands, guardrails — because that file is the artifact a human edits and
// a second copy of its contents in here is a second place for it to be wrong.
// ---------------------------------------------------------------------------

// Some harnesses deliver `args` as a JSON-encoded string; every field would read undefined and
// the stage loop would silently run over nothing.
const A = typeof args === 'string' ? JSON.parse(args) : args;
if (!A || !A.repo || !A.workdir || !Array.isArray(A.stages) || !A.stages.length) {
  throw new Error('execute-plan: args missing repo/workdir/stages — refusing to run over nothing');
}

const REPO = A.repo;
const WORKDIR = A.workdir;
const CONTRACT = A.contractPath || `${WORKDIR}/contract.md`;

const STAGES = A.stages || [];
const FRESH = A.freshState || 'head';
const COMMIT = A.commitPerStage !== false;
const ATTEMPTS = A.attemptBudget || 3;
const NOPROG = A.noProgressRounds || 2;
const RESERVE = A.reserveTokens || 60000;

// Defaults must equal the Model policy table in SKILL.md, because a caller who omits a field gets
// THESE and not the documented ones. `verifyModel` read 'haiku' here long after the table said
// sonnet: the documented policy held only for callers who happened to pass the field, which is the
// weakest place to keep a policy. Verification is deliberately not the cheapest tier — a verifier
// has to notice a command that exits 0 having measured nothing, and report a red it was hoped not
// to find. Sonnet is the floor for that, and is the operator's standing choice for this workflow;
// it is unrelated to the benchmark's own opus-only MUT rule, which governs what is measured, not
// what does the measuring.
const EXEC_MODEL = A.executeModel || 'sonnet';
const DX_MODEL = A.diagnoseModel || 'fable';
const VERIFY_MODEL = A.verifyModel || 'sonnet';

// The clean room, written once and pasted into every prompt that needs one. `head` mode clones
// HEAD and nothing else, so uncommitted work is invisible to it — that is the whole point, and
// it is what catches a fix that lives only in someone's working tree.
const cleanRoom = (label) => `    CLONE=${WORKDIR}/clones/${label}
    rm -rf "$CLONE"
    git clone --local --no-hardlinks --quiet ${REPO} "$CLONE"
    cd "$CLONE"${FRESH === 'worktree' ? `
    git -C ${REPO} diff HEAD --binary > /tmp/pe.patch && git apply --whitespace=nowarn /tmp/pe.patch || true
    # worktree mode: uncommitted work is replayed on top. Never accept a stage on this mode.` : ''}
    [ -f package.json ] && [ ! -d node_modules ] && npm install --silent --no-audit --no-fund || true`;

const READ_CONTRACT = `The contract is \`${CONTRACT}\`. Read it. Its frontmatter names the plan it
came from; the \`## Acceptance\` table holds one row per check with the exact command, the working
directory, and the exit code expected; each \`## Stage <id> — <title>\` section holds that stage's
intent, copied from the plan; \`## Guardrails\` holds the plan's own list of things not to do, and
those bind you as hard as the instructions here do.`;

// ---------------------------------------------------------------------------
// schemas — small on purpose. Control flow needs a handful of facts; everything a human will
// read later goes into markdown files the agents write.
// ---------------------------------------------------------------------------

const EXEC_SCHEMA = {
  type: 'object',
  required: ['done', 'summary'],
  properties: {
    done: { type: 'boolean', description: 'your belief, not a verdict — a verifier decides' },
    summary: { type: 'string' },
    files_touched: { type: 'array', items: { type: 'string' } },
    committed: { type: 'boolean' },
    blocked_reason: { type: ['string', 'null'], description: 'set only if you could not proceed without crossing a line' },
  },
};

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['green', 'ledger_path', 'failing'],
  properties: {
    green: { type: 'boolean' },
    ledger_path: { type: 'string' },
    failing: {
      type: 'array',
      items: {
        type: 'object',
        required: ['stage', 'cmd', 'exit'],
        properties: {
          stage: { type: 'string' },
          cmd: { type: 'string' },
          exit: { type: 'integer' },
          why: { type: 'string' },
        },
      },
    },
    green_stages: { type: 'array', items: { type: 'string' } },
    red_stages: { type: 'array', items: { type: 'string' } },
    clean_room_error: { type: ['string', 'null'], description: 'set when the clone or install failed, i.e. nothing was learned about the plan' },
  },
};

const FREEZE_SCHEMA = {
  type: 'object',
  required: ['frozen_path', 'repro_cmd'],
  properties: {
    frozen_path: { type: 'string' },
    repro_cmd: { type: 'string' },
    head_sha: { type: ['string', 'null'] },
  },
};

const DIAGNOSIS_SCHEMA = {
  type: 'object',
  required: ['lens', 'root_cause', 'evidence', 'fix', 'changes_acceptance', 'confidence'],
  properties: {
    lens: { type: 'string' },
    root_cause: { type: 'string', description: 'the mechanism, not the symptom' },
    evidence: { type: 'array', items: { type: 'string' }, description: 'file:line, output lines, commit shas — things a reader can check' },
    fix: { type: 'string' },
    changes_acceptance: { type: 'boolean', description: 'true if the fix would alter, relax, skip or delete an acceptance command or what it exercises' },
    violates_guardrail: { type: ['string', 'null'] },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    risk: { type: ['string', 'null'] },
  },
};

const ADJUDICATION_SCHEMA = {
  type: 'object',
  required: ['chosen_lens', 'rationale', 'fix_plan', 'weakens_acceptance', 'escalate'],
  properties: {
    chosen_lens: { type: 'string' },
    rationale: { type: 'string' },
    fix_plan: { type: 'array', items: { type: 'string' } },
    weakens_acceptance: { type: 'boolean' },
    violates_guardrail: { type: ['string', 'null'] },
    escalate: { type: 'boolean' },
    escalate_reason: { type: ['string', 'null'] },
  },
};

// ---------------------------------------------------------------------------
// prompts
// ---------------------------------------------------------------------------

const RUN_ACCEPTANCE = (stageClause, label) => `Build a clean room and run the acceptance. Change
nothing anywhere: you are the instrument here, not a judge of the work.

${READ_CONTRACT}

1. Build the clean room:

\`\`\`bash
${cleanRoom(label)}
\`\`\`

   If the clone or the install fails, stop: set clean_room_error and green=false. Nothing was
   learned about the plan, and that is a different thing from the plan failing.

2. Get the rows ${stageClause} from the one parser — do not read the \`## Acceptance\` table by
   eye. Its \`\\|\` escaping is exact and easy to misread, and two independent eyeball-reads of the
   same cell have disagreed before:

\`\`\`bash
node ${REPO}/.claude/skills/plan-executor/scripts/parse-contract.mjs ${CONTRACT}
\`\`\`

   It prints one JSON object per row with \`cmd\` / \`cwd\` / \`expect_exit\` / \`expect_match\` /
   \`expect_absent\` already unescaped — filter to the rows you need from that output, not from
   the raw markdown. Run every one, from inside \`$CLONE\`, exactly as printed. Do not repair a
   failing command, do not substitute a similar one, do not skip one that looks irrelevant.
   Record for each: the command, its exit code, and whether it matched.

3. Write \`${WORKDIR}/ledger/${label}.md\`:

\`\`\`markdown
---
label: ${label}
clone_sha: <git -C $CLONE rev-parse HEAD>
mode: ${FRESH}
green: [<stage ids where every row passed>]
red: [<stage ids where any row failed>]
---

# Acceptance ledger — ${label}

| stage | cmd | exit | expected | passed | why |
|---|---|---|---|---|---|

## <stage id> — failed

### \`<the failing command>\`
exit <n>, expected <n>

\`\`\`
<the 10 or so output lines a person would actually look at first>
\`\`\`
\`\`\`

Then return: green (true only when the red list is empty), green_stages, red_stages, ledger_path,
and one \`failing\` entry per failed row. A row you could not run counts as failed — never report
green on absent evidence, because a stage marked done that was never checked is the one outcome
this whole run is built to avoid.`;

function executePrompt(s) {
  return `Implement one stage of an agreed plan, in the repository at ${REPO}.

**Stage ${s.id} — ${s.title}**

${READ_CONTRACT} Read the \`## Stage ${s.id}\` section for what to do. For what will judge it, get
the Acceptance rows for \`${s.id}\` from the one parser rather than reading the table by eye:

\`\`\`bash
node ${REPO}/.claude/skills/plan-executor/scripts/parse-contract.mjs ${CONTRACT} --stage=${s.id}
\`\`\`

What matters more than finishing quickly:

1. Implement what that stage says, and stop there. Not the next stage, and not improvements it
   did not ask for — a diff bigger than the stage is a diff nobody can review against it.
2. Never edit, relax, skip or delete an acceptance command, or the tests, fixtures or config it
   exercises — unless the stage *is* that change. If the acceptance looks wrong to you, say so in
   blocked_reason instead of making it pass. Code that agrees with a weakened check is worth less
   than an honest red.
3. The contract's \`## Guardrails\` are the plan's own prohibitions. They bind you.
${COMMIT
      ? `4. Commit when the stage is implemented, with a message saying why rather than what. The
   acceptance clones HEAD — uncommitted work is invisible to it, deliberately. Do not push, do not
   tag, do not open a pull request.`
      : `4. Do not commit; leave the change in the working tree.`}

\`done\` is your belief. A separate verifier runs the acceptance in a clean clone and decides.`;
}

function freezePrompt(s, label, v) {
  return `Stage ${s.id} failed its acceptance. Freeze the failing state before anything changes it —
if the next attempt makes things worse, this is the only record that the earlier failure was
different.

Create \`${WORKDIR}/freeze/${label}/\` and write:

\`\`\`bash
mkdir -p ${WORKDIR}/freeze/${label}
cp ${v.ledger_path} ${WORKDIR}/freeze/${label}/ledger.md
git -C ${REPO} status --short --branch > ${WORKDIR}/freeze/${label}/git-status.txt
git -C ${REPO} diff HEAD          > ${WORKDIR}/freeze/${label}/diff.patch
git -C ${REPO} log --oneline -8   > ${WORKDIR}/freeze/${label}/log.txt
\`\`\`

Then write \`${WORKDIR}/freeze/${label}/NOTES.md\`: the stage id and title, which acceptance
commands failed and what they printed, and the single command that reproduces the failure from a
clean checkout.

Failing now:
${v.failing.map((f) => `- \`${f.cmd}\` → exit ${f.exit}${f.why ? ` — ${f.why}` : ''}`).join('\n')}

Capture. Do not diagnose, and do not fix anything.`;
}

function diagnosePrompt(s, lens, v, freeze, history) {
  const lenses = {
    'what-changed': `Look at what this run changed — \`${freeze.frozen_path}/diff.patch\` and the
commits made for this stage — before you look anywhere else. You are testing the hypothesis that
the failure is *in the change*: a wrong edit, an incomplete one, or one made in the wrong file.`,
    'what-the-check-asserts': `Read the failing command and the code it exercises until you can say
in one sentence what it asserts and why that is false right now. You are testing the hypothesis
that the change is fine and the *state it landed in* is not: a missing prerequisite, an unbuilt
artifact, a file that was never tracked, an ordering requirement stated elsewhere in the plan.`,
    'what-the-plan-forbade': `Re-read the contract's \`## Guardrails\` and the stage ordering in the
plan. You are testing the hypothesis that this failure was predicted. Plans of this shape often
carry a line like "do not do X first — it makes things worse", and a failure count going *up*
after a change is what that looks like from the inside.`,
  };

  return `You are diagnosing a failing stage. Your lens is **${lens}**.

${lenses[lens]}

**Stage ${s.id} — ${s.title}**. ${READ_CONTRACT}

Frozen evidence: \`${freeze.frozen_path}\` — ledger.md, diff.patch, git-status.txt, log.txt,
NOTES.md. The repository is ${REPO}. Read the actual files and the actual output. A root cause you
cannot point at a line for is a guess, and a guess costs a full fix-and-verify cycle to disprove.

Failing now:
${v.failing.map((f) => `- \`${f.cmd}\` → exit ${f.exit}${f.why ? ` — ${f.why}` : ''}`).join('\n')}
${history}

Two fields decide whether your fix is admissible, so answer them honestly rather than helpfully:

- \`changes_acceptance\` — would your fix alter, relax, skip or delete an acceptance command, or the
  test, fixture or config it runs? Making the check agree with the code is not a fix. Say true and
  your fix will be rejected; that is the correct outcome, and a rejected honest diagnosis is far
  more useful than a laundered one.
- \`violates_guardrail\` — name the guardrail if your fix would break one.

Stay inside your lens. Other agents hold the others and an adjudicator compares all three; your
worth here is an independent reading, not a consensus one.`;
}

function adjudicatePrompt(s, ds, v, attempt) {
  return `Three independent diagnoses of one failing stage. Choose a fix, or refuse all three.

**Stage ${s.id} — ${s.title}** · fix attempt ${attempt} of ${ATTEMPTS}. ${READ_CONTRACT}

Still failing:
${v.failing.map((f) => `- \`${f.cmd}\` → exit ${f.exit}${f.why ? ` — ${f.why}` : ''}`).join('\n')}

${ds.map((d, i) => `--- diagnosis ${i + 1} · lens "${d.lens}" · confidence ${d.confidence}
root cause: ${d.root_cause}
evidence:   ${(d.evidence || []).join(' | ')}
fix:        ${d.fix}
changes_acceptance: ${d.changes_acceptance} · violates_guardrail: ${d.violates_guardrail || 'none'} · risk: ${d.risk || 'unstated'}`).join('\n\n')}

How to choose:

1. **Admissibility first.** Any diagnosis with \`changes_acceptance: true\`, or one that breaks a
   guardrail in the contract, is inadmissible whatever its confidence. If all three are, set
   \`escalate: true\` and say what a human now has to decide. Escalating is a correct outcome — a
   run that reaches green by editing its own acceptance has produced nothing at all.
2. **Prefer the diagnosis that points at a line over the one that reads well.**
3. **Prefer the smallest fix that closes the failure for the stated reason.** Where two agree on
   the mechanism, take the narrower one.
4. If the best available fix is genuinely an improvement but you doubt it closes the failure, say
   so in the rationale and take it anyway. One verify cycle is cheaper than more analysis.

Set \`weakens_acceptance: true\` if your plan would in effect make the check easier rather than the
code correct — including indirectly, by deleting a fixture, adding a skip, loosening an assertion,
or narrowing what a test scans. Return an ordered, concrete fix_plan.`;
}

function fixPrompt(s, pick, freeze) {
  return `Apply an adjudicated fix in ${REPO}.

**Stage ${s.id} — ${s.title}**. ${READ_CONTRACT}

Accepted reading (lens "${pick.chosen_lens}"): ${pick.rationale}

Apply exactly this:
${pick.fix_plan.map((f, i) => `  ${i + 1}. ${f}`).join('\n')}

Frozen evidence for the failure you are closing: \`${freeze.frozen_path}\`

Hard limits:
- Do not touch the acceptance commands, or the tests, fixtures or config they exercise. If this
  plan turns out to require that, stop and return blocked_reason.
- Stay inside this stage.
- The contract's guardrails still bind you.
${COMMIT ? `- Commit the fix, naming the failure it closes. Do not push.` : `- Do not commit.`}

A fresh clone is built and the acceptance re-run the moment you finish, so leave the repository in
the state you want judged.`;
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

const outOfBudget = () => !!budget.total && budget.remaining() < RESERVE;

// A failure fingerprint the workflow computes itself, from the failing commands and their exit
// codes. Two attempts with the same fingerprint mean the fix changed nothing observable, which is
// the only reliable signal that more attempts are just spending the budget.
const fingerprint = (failing) => (failing || []).map((f) => `${f.stage}:${f.cmd}:${f.exit}`).sort().join(' | ');

const selected = (function () {
  const wanted = A.only && A.only.length ? new Set(A.only) : null;
  const picked = STAGES.filter((s) => (wanted ? wanted.has(s.id) : !(s.optional && !A.includeOptional)));
  const byId = new Map(picked.map((s) => [s.id, s]));
  const out = [];
  const seen = new Set();
  const open = new Set();
  const visit = (s) => {
    if (!s || seen.has(s.id) || open.has(s.id)) return;
    open.add(s.id);
    for (const d of s.depends_on || []) visit(byId.get(d));
    open.delete(s.id);
    seen.add(s.id);
    out.push(s);
  };
  for (const s of picked) visit(s);
  return out;
})();

// Zero-work gate — modelled on hooks/gate-zerowork.mjs. Rev 3 returned "outcome":"complete"
// having run zero stages because `args` never reached the script; that class is closed above
// by validating `args` before any model call. This is the same failure one level down: `stages`
// can be a valid non-empty array and `selected` still come out empty — every stage optional
// with `includeOptional` unset, or `--only` naming nothing that exists — and the run loop below
// would then do nothing at all, yet fall through to a report where `unfinished` is vacuously
// empty too and `outcome` reads "complete". A run with no stage selected touched nothing: no
// green stage, no commit, no freeze directory. Refuse rather than report it.
if (!selected.length) {
  throw new Error('execute-plan: zero-work gate — no stage was selected to run (stages/--only/optional filtering left nothing); refusing to report "complete" on a run that would touch nothing');
}

const state = {};
for (const s of selected) state[s.id] = { id: s.id, title: s.title, status: 'pending', attempts: 0, freezes: [], notes: [] };

log(`${selected.length} stage(s) · clean room: ${FRESH} · attempt budget: ${ATTEMPTS} · execute=${EXEC_MODEL} diagnose=${DX_MODEL} verify=${VERIFY_MODEL}`);
if (budget.total) log(`token target ${Math.round(budget.total / 1000)}k, holding back ${Math.round(RESERVE / 1000)}k for the handoff`);

// --- Preflight. One cheap agent, and on a resumed run it can save every stage of work.
phase('Preflight');
const pre = await agent(RUN_ACCEPTANCE('in the table, for every stage', 'preflight'), {
  model: VERIFY_MODEL, phase: 'Preflight', label: 'preflight', schema: VERIFY_SCHEMA,
});

// Already-done counts only on a positive statement that it passed. Anything ambiguous — no
// preflight, an unbuildable clean room, a stage the ledger never mentions — is red and gets
// attempted. Redoing finished work costs tokens; skipping unfinished work costs the run.
if (!pre) log('preflight returned nothing — every stage will be attempted');
else if (pre.clean_room_error) log(`preflight could not build a clean room: ${pre.clean_room_error} — every stage will be attempted`);
else {
  const red = new Set(pre.red_stages || []);
  for (const id of pre.green_stages || []) {
    if (state[id] && !red.has(id)) { state[id].status = 'green'; state[id].notes.push('green at preflight — not re-executed'); }
  }
  const skipped = selected.filter((s) => state[s.id].status === 'green').map((s) => s.id);
  if (skipped.length) log(`already green: ${skipped.join(', ')}`);
}

async function runStage(s) {
  const st = state[s.id];

  const blocker = (s.depends_on || []).find((d) => state[d] && state[d].status !== 'green');
  if (blocker) {
    st.status = 'skipped';
    st.notes.push(`not attempted: depends on ${blocker}, which is ${state[blocker].status}`);
    log(`${s.id} skipped — ${blocker} is ${state[blocker].status}`);
    return;
  }
  if (outOfBudget()) { st.status = 'budget'; st.notes.push('not attempted: token target reached'); return; }

  phase('Execute');
  const exec = await agent(executePrompt(s), { model: EXEC_MODEL, phase: 'Execute', label: `exec:${s.id}`, schema: EXEC_SCHEMA });
  if (!exec) { st.status = 'stalled'; st.notes.push('the executing agent returned nothing — an interrupted run, not a failed stage'); return; }
  st.executed = { summary: exec.summary, files: exec.files_touched || [], committed: !!exec.committed };
  if (exec.blocked_reason) st.notes.push(`executor reported a block: ${exec.blocked_reason}`);

  let stall = 0;
  let lastPrint = null;
  const rejected = [];

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (outOfBudget()) { st.status = 'budget'; st.notes.push(`stopped before attempt ${attempt}: token target reached`); return; }
    st.attempts = attempt;
    const label = `${s.id}-a${attempt}`;

    phase('Verify');
    const v = await agent(RUN_ACCEPTANCE(`whose \`stage\` column is \`${s.id}\``, label), {
      model: VERIFY_MODEL, phase: 'Verify', label: `verify:${label}`, schema: VERIFY_SCHEMA,
    });
    if (!v) { st.status = 'stalled'; st.notes.push(`verification returned nothing at attempt ${attempt}`); return; }
    if (v.clean_room_error) {
      st.status = 'stalled';
      st.notes.push(`the clean room could not be built at attempt ${attempt}: ${v.clean_room_error}. Nothing was learned about the plan.`);
      return;
    }
    if (v.green) {
      st.status = 'green';
      st.notes.push(`green after ${attempt} verification(s)`);
      log(`${s.id} green (attempt ${attempt})`);
      return;
    }

    const print = fingerprint(v.failing);
    stall = print && print === lastPrint ? stall + 1 : 0;
    lastPrint = print;
    if (stall >= NOPROG) {
      st.status = 'blocked';
      st.notes.push(`no progress: an identical failure survived ${stall + 1} attempts (${print}). Stopping this stage rather than spending the budget on a loop.`);
      log(`${s.id} blocked — ${stall + 1} attempts, identical failure`);
      return;
    }
    if (attempt === ATTEMPTS) {
      st.status = 'exhausted';
      st.notes.push(`attempt budget of ${ATTEMPTS} spent, still failing: ${v.failing.map((f) => f.cmd).join('; ')}`);
      log(`${s.id} exhausted its ${ATTEMPTS} attempts`);
      return;
    }

    phase('Diagnose');
    const freeze = await agent(freezePrompt(s, label, v), { model: VERIFY_MODEL, phase: 'Diagnose', label: `freeze:${label}`, schema: FREEZE_SCHEMA });
    if (!freeze) { st.status = 'stalled'; st.notes.push(`freezing returned nothing at attempt ${attempt}`); return; }
    st.freezes.push({ attempt, path: freeze.frozen_path, repro: freeze.repro_cmd });

    const history = [
      st.freezes.length > 1 ? `\nEarlier frozen attempts on this stage: ${st.freezes.map((f) => f.path).join(', ')}. Whatever you propose must differ from what those already tried.` : '',
      rejected.length ? `\nAlready rejected as inadmissible here:\n${rejected.map((r) => `  - ${r}`).join('\n')}` : '',
    ].join('');

    const LENSES = ['what-changed', 'what-the-check-asserts', 'what-the-plan-forbade'];
    const ds = (await parallel(LENSES.map((lens) => () =>
      agent(diagnosePrompt(s, lens, v, freeze, history), {
        model: DX_MODEL, effort: stall > 0 ? 'max' : 'high', phase: 'Diagnose', label: `dx:${label}:${lens}`, schema: DIAGNOSIS_SCHEMA,
      })
    ))).filter(Boolean);

    if (!ds.length) { st.status = 'stalled'; st.notes.push(`every diagnostic lens failed at attempt ${attempt}`); return; }
    if (ds.length < LENSES.length) log(`${label}: ${LENSES.length - ds.length} of ${LENSES.length} lenses returned nothing — adjudicating on the rest`);

    const pick = await agent(adjudicatePrompt(s, ds, v, attempt), {
      model: DX_MODEL, effort: 'high', phase: 'Diagnose', label: `adjudicate:${label}`, schema: ADJUDICATION_SCHEMA,
    });
    if (!pick) { st.status = 'stalled'; st.notes.push(`adjudication returned nothing at attempt ${attempt}`); return; }

    if (pick.escalate || pick.weakens_acceptance || pick.violates_guardrail) {
      const why = pick.escalate
        ? `no admissible fix — ${pick.escalate_reason || pick.rationale}`
        : pick.weakens_acceptance
          ? `the only fix on offer weakens the acceptance instead of fixing the code — ${pick.rationale}`
          : `the only fix on offer breaks guardrail "${pick.violates_guardrail}" — ${pick.rationale}`;
      st.status = 'escalated';
      st.notes.push(why);
      st.proposal = { fix_plan: pick.fix_plan, rationale: pick.rationale, diagnoses: ds.map((d) => ({ lens: d.lens, root_cause: d.root_cause, fix: d.fix })) };
      log(`${s.id} escalated — ${why}`);
      return;
    }

    rejected.push(...ds.filter((d) => d.changes_acceptance || d.violates_guardrail).map((d) => `${d.lens}: ${d.fix}`));

    phase('Fix');
    const fixed = await agent(fixPrompt(s, pick, freeze), { model: EXEC_MODEL, phase: 'Fix', label: `fix:${label}`, schema: EXEC_SCHEMA });
    if (!fixed) { st.status = 'stalled'; st.notes.push(`the fixing agent returned nothing at attempt ${attempt}`); return; }
    if (fixed.blocked_reason) {
      st.status = 'escalated';
      st.notes.push(`the fix could not be applied without crossing a line: ${fixed.blocked_reason}`);
      st.proposal = { fix_plan: pick.fix_plan, rationale: pick.rationale };
      return;
    }
    st.notes.push(`attempt ${attempt}: applied the "${pick.chosen_lens}" fix — ${String(pick.rationale).slice(0, 160)}`);
  }
}

for (const s of selected) {
  if (state[s.id].status === 'green') continue;
  if (outOfBudget()) { state[s.id].status = 'budget'; state[s.id].notes.push('not attempted: token target reached'); continue; }
  await runStage(s);
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

const rows = selected.map((s) => state[s.id]);
const green = rows.filter((r) => r.status === 'green');
const unfinished = rows.filter((r) => r.status !== 'green');
const stalled = unfinished.filter((r) => r.status === 'stalled');

const outcome = !unfinished.length ? 'complete'
  : stalled.length === unfinished.length && stalled.length ? 'interrupted'
    : rows.some((r) => r.status === 'budget') ? 'budget-exhausted'
      : 'incomplete';

log(`${green.length}/${rows.length} green · ${outcome}`);
for (const r of unfinished) log(`  ${r.id} ${r.status} — ${r.notes[r.notes.length - 1] || ''}`);

return {
  outcome,
  contract: CONTRACT,
  workdir: WORKDIR,
  policy: { fresh_state: FRESH, attempt_budget: ATTEMPTS, no_progress_rounds: NOPROG, commit_per_stage: COMMIT },
  models: { execute: EXEC_MODEL, diagnose: DX_MODEL, verify: VERIFY_MODEL },
  stages: rows,
  green: green.map((r) => r.id),
  unfinished: unfinished.map((r) => ({ id: r.id, status: r.status, why: r.notes[r.notes.length - 1] || null, freezes: r.freezes, proposal: r.proposal || null })),
  tokens_spent: budget.spent(),
  budget_remaining: budget.total ? budget.remaining() : null,
  next_action: outcome === 'complete'
    ? 'Re-run every acceptance command yourself before believing this. A run should not be the last word on itself.'
    : outcome === 'interrupted'
      ? 'Agents stopped returning, which usually means a usage limit. Park until the window resets, then re-run the preflight — finished stages cost nothing to confirm and are skipped.'
      : 'Read the freeze directories for the unfinished stages, then choose: raise the attempt budget, fix by hand, or ship what is green.',
};
