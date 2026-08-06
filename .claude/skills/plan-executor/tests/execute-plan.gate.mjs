#!/usr/bin/env node
// Gate test for execute-plan.js's zero-work refusals — modelled on hooks/gate-zerowork.mjs.
// Rev 3's executor returned "outcome":"complete" having executed zero stages, because `args`
// never reached the script and every field read `undefined`. This proves the fix by running
// the real refusal paths, not by asserting on the source text (a grep is what
// scripts/parse-contract.mjs exists to stop, and the same principle holds here).
//
// `execute-plan.js` is not a plain Node module: it is written against workflow-runtime globals
// (`args`, `agent`, `parallel`, `phase`, `log`, `budget`) supplied by the harness that dispatches
// it, and it uses top-level `await` and a top-level `return` for its result. This evaluates the
// file's body in a `node:vm` context with those six globals stubbed, so a missing-args run, an
// empty-stages run, and a run whose stage selection comes out empty all get to actually execute
// the script's own guard clauses.
//
// Usage: node execute-plan.gate.mjs --selftest

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKFLOW = resolve(HERE, '..', 'workflows', 'execute-plan.js');

// Strip the leading `export const meta = {...};` block. It is metadata the harness reads
// separately and is irrelevant to the refusal paths under test; `export` is also not valid
// outside a real ES module record, and this file is evaluated as a plain script body.
function loadBody() {
  const src = readFileSync(WORKFLOW, 'utf8');
  const stripped = src.replace(/^export const meta[\s\S]*?\n};\n/, '');
  if (stripped === src) {
    throw new Error(`could not find the "export const meta" block to strip in ${WORKFLOW} — has the file moved?`);
  }
  return stripped;
}

// Runs the workflow body once against one `args` value and a set of stubbed globals. Returns a
// promise for { thrown } | { result }: the script either throws synchronously (a guard clause)
// or its top-level `return` resolves the wrapping async function.
async function run(argsValue, stubs = {}) {
  const body = loadBody();
  const sandbox = {
    args: argsValue,
    agent: stubs.agent || (async () => null),
    parallel: stubs.parallel || (async (fns) => Promise.all(fns.map((f) => f()))),
    phase: stubs.phase || (() => {}),
    log: stubs.log || (() => {}),
    budget: stubs.budget || { total: 0, remaining: () => Infinity, spent: () => 0 },
    console,
    __settle: null,
  };
  vm.createContext(sandbox);
  const wrapped = `__settle = (async () => {\n${body}\n})();`;
  try {
    vm.runInContext(wrapped, sandbox, { timeout: 15000, filename: 'execute-plan.js (vm)' });
  } catch (e) {
    return { thrown: e };
  }
  try {
    const result = await sandbox.__settle;
    return { result };
  } catch (e) {
    return { thrown: e };
  }
}

const cases = [];
function test(name, fn) { cases.push({ name, fn }); }

function assertRefuses({ thrown }, name) {
  if (!thrown) throw new Error(`${name}: expected a refusal, got none`);
  if (!/execute-plan:/.test(thrown.message)) {
    throw new Error(`${name}: refusal message is missing "execute-plan:" — got: ${thrown.message}`);
  }
}

// --- item 1: validate the payload before any model call -------------------------------------

test('absent args refuses, before any model call', async () => {
  let agentCalled = false;
  const outcome = await run(undefined, { agent: async () => { agentCalled = true; return null; } });
  assertRefuses(outcome, 'absent args');
  if (agentCalled) throw new Error('absent args: the agent was called — the guard must run before any model call');
});

test('args missing repo/workdir refuses', async () => {
  assertRefuses(await run({ stages: [{ id: 'S1', title: 't', depends_on: [] }] }), 'missing repo/workdir');
});

test('stages: [] refuses', async () => {
  assertRefuses(await run({ repo: '/tmp/r', workdir: '/tmp/w', stages: [] }), 'stages: []');
});

// --- item 2: zero-work gate — a stage list of [] cannot report "complete" --------------------

test('zero-work gate: every stage optional, includeOptional unset, selects nothing', async () => {
  const argsValue = {
    repo: '/tmp/r', workdir: '/tmp/w',
    stages: [{ id: 'S1', title: 'only stage', depends_on: [], optional: true }],
  };
  assertRefuses(await run(argsValue), 'all-optional selection');
});

test('zero-work gate: --only names a stage id that does not exist', async () => {
  const argsValue = {
    repo: '/tmp/r', workdir: '/tmp/w',
    stages: [{ id: 'S1', title: 'a stage', depends_on: [], optional: false }],
    only: ['NOPE'],
  };
  assertRefuses(await run(argsValue), '--only naming nothing');
});

// --- the gate must not fire on real work — proves it targets zero work specifically ----------

test('a real run with a green stage reports "complete", ungated', async () => {
  const argsValue = {
    repo: '/tmp/r', workdir: '/tmp/w',
    stages: [{ id: 'S1', title: 'a stage', depends_on: [], optional: false }],
  };
  const agentStub = async (_prompt, opts) => {
    if (opts.phase === 'Preflight') return null;
    if (opts.phase === 'Execute') return { done: true, summary: 'did the thing', committed: true, files_touched: ['a.txt'] };
    if (opts.phase === 'Verify') return { green: true, ledger_path: '/tmp/w/ledger/x.md', failing: [], green_stages: ['S1'], red_stages: [] };
    return null;
  };
  const outcome = await run(argsValue, { agent: agentStub });
  if (outcome.thrown) throw new Error(`did not expect a refusal on a real green run: ${outcome.thrown.message}`);
  if (!outcome.result || outcome.result.outcome !== 'complete') {
    throw new Error(`expected outcome "complete", got ${JSON.stringify(outcome.result && outcome.result.outcome)}`);
  }
});

test('a real run that never goes green reports "incomplete", not "complete", ungated', async () => {
  const argsValue = {
    repo: '/tmp/r', workdir: '/tmp/w',
    stages: [{ id: 'S1', title: 'a stage', depends_on: [], optional: false }],
    attemptBudget: 1,
  };
  const agentStub = async (_prompt, opts) => {
    if (opts.phase === 'Preflight') return null;
    if (opts.phase === 'Execute') return { done: false, summary: 'tried', committed: false, files_touched: [] };
    if (opts.phase === 'Verify') return { green: false, ledger_path: '/tmp/w/ledger/x.md', failing: [{ stage: 'S1', cmd: 'npm test', exit: 1 }], green_stages: [], red_stages: ['S1'] };
    return null;
  };
  const outcome = await run(argsValue, { agent: agentStub });
  if (outcome.thrown) throw new Error(`did not expect the zero-work gate to fire on a genuinely attempted, still-failing run: ${outcome.thrown && outcome.thrown.message}`);
  if (!outcome.result || outcome.result.outcome === 'complete') {
    throw new Error(`expected a non-"complete" outcome, got ${JSON.stringify(outcome.result && outcome.result.outcome)}`);
  }
});

// ---------------------------------------------------------------------------

async function main() {
  if (!process.argv.includes('--selftest')) {
    console.error('usage: execute-plan.gate.mjs --selftest');
    process.exitCode = 1;
    return;
  }

  let failed = 0;
  for (const { name, fn } of cases) {
    try {
      await fn();
      console.log(`PASS  ${name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL  ${name}`);
      console.log(`      ${e.message}`);
    }
  }

  if (failed) {
    console.log(`\nFAIL  ${failed}/${cases.length} zero-work gate case(s) failed`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nzero-work gate: ${cases.length}/${cases.length} passed — absent args, empty stages, and a ` +
    `selection that resolves to nothing all refuse before reporting "complete"; a genuinely attempted run does not`);
}

await main();
