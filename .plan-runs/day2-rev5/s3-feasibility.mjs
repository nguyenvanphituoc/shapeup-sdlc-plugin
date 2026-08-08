#!/usr/bin/env node
// S3 feasibility probe — derives whether Stage S3 can run on THIS machine, rather than
// taking any session's word for it. Costs zero model tokens; every check is a command.
//
// S3 buys a Sonnet baseline: n=3 reps of f2-budgets / claude-sonnet-5 / shapeup-sdlc at the
// pre-fix build a280e86 (~$5.8), preceded by a `product_writes` change committed to the
// benchmark repository. Both halves need a benchmark this repository does not contain.
//
//   node .plan-runs/day2-rev5/s3-feasibility.mjs
//
// Exit 0 = S3 is runnable here. Exit 3 = blocked, with the reason named.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The benchmark's location as the plan records it. It is author-owned with no git remote
// (plan §Sources), so it cannot be cloned — it exists only where its author left it.
const BENCH_PATH = '/Users/teo/workspace/sdd-harness-bench';
const PREFIX_BUILD = 'a280e86';

// The two flags today's adapter passes, and the scripts that implement them. The plan states
// this as S3's "Known risk"; this check settles the repository-side half of it from primary
// evidence rather than from the plan's assertion.
const ADAPTER_SCRIPTS = ['gate-answers.mjs', 'budget-check.mjs'];

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
const results = [];
const check = (id, question, fn) => {
  let ok, detail;
  try { ({ ok, detail } = fn()); } catch (e) { ok = false; detail = `check errored: ${e.message}`; }
  results.push({ id, question, ok, detail });
};

// C1 — is the benchmark where the plan says it is?
check('C1', 'benchmark repository present at its recorded path', () => {
  const there = existsSync(BENCH_PATH);
  return { ok: there, detail: there ? `${BENCH_PATH} exists` : `${BENCH_PATH} does not exist on this machine` };
});

// C2 — is it anywhere else, under any name? Cheap breadth-first sweep of the plausible roots.
// `find` is used rather than a recursive walk so the cost stays bounded on a large volume.
check('C2', 'benchmark reachable anywhere on this machine', () => {
  let hits = '';
  try {
    hits = execFileSync('/usr/bin/find',
      ['/Users', '/Volumes', '-maxdepth', '6', '-iname', '*harness-bench*', '-not', '-path', '/System/*'],
      { encoding: 'utf8', timeout: 240_000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { /* find exits non-zero on unreadable dirs; empty stdout is the answer we want */ }
  return { ok: hits.length > 0, detail: hits || 'no directory or archive matching *harness-bench* under /Users or /Volumes' };
});

// C3 — can today's adapter drive the pre-fix build? The adapter itself lives in the benchmark
// and is unreadable here, so this settles only the half that IS readable: whether the scripts
// implementing the flags it passes exist at that commit. They are absent => the flags cannot work.
check('C3', `adapter prerequisites present at pre-fix build ${PREFIX_BUILD}`, () => {
  const tree = git('ls-tree', '-r', '--name-only', PREFIX_BUILD).split('\n');
  const missing = ADAPTER_SCRIPTS.filter((s) => !tree.some((f) => f.endsWith('/' + s) || f === s));
  return {
    ok: missing.length === 0,
    detail: missing.length
      ? `${missing.join(', ')} absent under any path at ${PREFIX_BUILD} (present at HEAD) — the flags today's adapter passes have no implementation to reach`
      : `all of ${ADAPTER_SCRIPTS.join(', ')} present at ${PREFIX_BUILD}`,
  };
});

// C4 — informational, never blocking. If S3 is unobtainable, plan §7 names the honest terminal
// state: "FC-01 cannot be re-based on Sonnet at all, and the honest terminal state is FC-01
// permanently Haiku-scoped with reduces: null." This reports whether the register is already there.
const terminal = (() => {
  const reg = JSON.parse(readFileSync(resolve(REPO, 'evals/failure-classes.json'), 'utf8'));
  const c = reg.classes.find((x) => x.id === 'FC-01');
  const haiku = (r) => /haiku/i.test(String(r?.model_scope ?? ''));
  return {
    at: c.reduces === null && c.reduction_basis === null && haiku(c.baseline) && haiku(c.current),
    detail: `reduces=${JSON.stringify(c.reduces)} basis=${JSON.stringify(c.reduction_basis)} ` +
      `baseline.model_scope=${JSON.stringify(c.baseline?.model_scope)} current.model_scope=${JSON.stringify(c.current?.model_scope)}`,
  };
})();

const blockers = results.filter((r) => !r.ok);
const w = Math.max(...results.map((r) => r.question.length));
console.log(`S3 feasibility — ${REPO}\n`);
for (const r of results) console.log(`  ${r.ok ? 'yes' : 'NO '}  ${r.id}  ${r.question.padEnd(w)}  ${r.detail}`);

console.log(`\n  --  C4  ${'register already at §7\'s honest terminal state'.padEnd(w)}  ${terminal.at ? 'yes' : 'no'} — ${terminal.detail}`);

if (!blockers.length) {
  console.log('\nS3 IS RUNNABLE HERE. The benchmark is reachable and the pre-fix build has its adapter prerequisites.');
  process.exit(0);
}
console.log(`\nS3 IS BLOCKED ON THIS MACHINE — ${blockers.length} blocker(s): ${blockers.map((b) => b.id).join(', ')}`);
console.log('S3 needs the benchmark for BOTH halves: the product_writes change is committed there,');
console.log('and the n=3 reps run through its runner and scorer. Neither is reconstructible from this');
console.log('repository, and rebuilding a lookalike would produce a DIFFERENT instrument — the exact');
console.log('pooling error this plan exists to refuse. Run this on the machine that holds the benchmark.');
process.exit(3);
