// Independent evaluator probe for envlint r1. Drives `node bin/envlint.mjs` and the pure modules.
// Fixtures live in a fresh os.tmpdir() directory and are removed at the end.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const ROOT = '/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer';
const BIN = join(ROOT, 'bin/envlint.mjs');
const SCR = mkdtempSync(join(tmpdir(), 'envlint-eval-'));
const { parse } = await import(join(ROOT, 'src/parse.mjs'));
const { check, checkSchema } = await import(join(ROOT, 'src/rules.mjs'));

const out = [];
const rec = (id, ok, detail) => out.push(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${detail}`);
const J = JSON.stringify;
function fx(files) {
  const d = mkdtempSync(join(SCR, 'fx-'));
  for (const [n, b] of Object.entries(files)) writeFileSync(join(d, n), b);
  return d;
}
const run = (args, cwd) => spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
const STACK = /^\s+at /m;
const snap = (d) => readdirSync(d, { withFileTypes: true }).map((e) => `${e.name}:${e.isDirectory() ? 'dir' : createHash('sha256').update(readFileSync(join(d, e.name))).digest('hex')}`).sort().join('|');

// ---------- UC-ParseEnv ----------
{
  const src = readFileSync(join(ROOT, 'src/parse.mjs'), 'utf8');
  const imps = [...src.matchAll(/^\s*import\b.*$/gm)].map((m) => m[0]);
  const t = 'A=1\nBAD\nexport B="x"\n';
  rec('UC-ParseEnv/TS-INV-01', imps.length === 0 && J(parse(t)) === J(parse(t)), `imports=${J(imps)} deterministic=${J(parse(t)) === J(parse(t))}`);
}
{
  let ok = true; const d = [];
  for (const s of ['=x', '\u0000', 'A', '', 'export', '"', 'A="x\ny', '￿=\uD800']) {
    try { const r = parse(s); d.push(`${J(s)}->${J(r.problems.map((p) => p.line))}`); if (!r.problems.every((p) => Number.isInteger(p.line) && p.line >= 1)) ok = false; } catch (e) { ok = false; d.push(`${J(s)} threw ${e.message}`); }
  }
  for (const s of ['=x', '\u0000', 'A']) if (parse(s).problems.length !== 1) ok = false;
  rec('UC-ParseEnv/TS-INV-02', ok, d.join(' '));
}
{ const r = parse('A=1\nGARBAGE\n'); rec('UC-ParseEnv/TS-ERR-PARSE_NO_EQUALS', J(r.problems.map((p) => p.line)) === '[2]' && J(r.pairs.map((p) => p.key)) === '["A"]', J(r)); }
{ const r = parse('1BAD=x'); rec('UC-ParseEnv/TS-ERR-PARSE_BAD_KEY', r.pairs.length === 0 && r.problems.length === 1 && r.problems[0].line === 1, J(r)); }
{ const r = parse('A="open'); rec('UC-ParseEnv/TS-ERR-PARSE_UNCLOSED_QUOTE', r.problems.length === 1 && r.problems[0].line === 1 && r.pairs.length === 0, J(r)); }
{
  const r = parse(['A=value', '# c', '', 'export K=v', "S='single'", 'D="double"', '  KEY2 = spaced  '].join('\r\n'));
  const exp = [{ key: 'A', value: 'value', line: 1 }, { key: 'K', value: 'v', line: 4 }, { key: 'S', value: 'single', line: 5 }, { key: 'D', value: 'double', line: 6 }, { key: 'KEY2', value: 'spaced', line: 7 }];
  rec('UC-ParseEnv/TS-REQ-text-forms', r.problems.length === 0 && J(r.pairs) === J(exp), J(r));
}
{ const r = parse('A=${B}'); rec('UC-ParseEnv/TS-NOGO-01', J(r.pairs) === J([{ key: 'A', value: '${B}', line: 1 }]), J(r)); }
{ const r = parse('A=x # y'); rec('UC-ParseEnv/Step7 PD-5', r.pairs[0]?.value === 'x # y', J(r)); }
{ const r = parse('A=1\nA=2'); rec('UC-ParseEnv/Step8 PD-6', J(r.pairs.map((p) => p.value)) === '["1","2"]', J(r)); }

// ---------- UC-CheckRules ----------
{
  const src = readFileSync(join(ROOT, 'src/rules.mjs'), 'utf8');
  const imps = [...src.matchAll(/^\s*import\b.*$/gm)].map((m) => m[0]);
  rec('UC-CheckRules/TS-INV-01', imps.length === 0 && !/require\(|fetch\(/.test(src), `imports=${J(imps)}`);
}
{
  const t0 = Date.now(); const r = check([{ key: 'U', value: 'https://nonexistent.invalid', line: 1 }], { U: { type: 'url' } });
  rec('UC-CheckRules/TS-INV-02', Array.isArray(r) && r.length === 0, `result=${J(r)} sync=${Array.isArray(r)} ms=${Date.now() - t0}`);
}
{ const r = check([], { A: { required: true } }); rec('UC-CheckRules/TS-ERR-RULE_REQUIRED', r.length === 1 && r[0].rule === 'required' && r[0].line === null, J(r)); }
{
  let ok = true; const d = [];
  for (const [ty, v, ln] of [['int', '1.5', 3], ['bool', 'yes', 4], ['url', 'localhost', 5]]) { const r = check([{ key: 'K', value: v, line: ln }], { K: { type: ty } }); d.push(J(r)); if (!(r.length === 1 && r[0].rule === 'type' && r[0].line === ln)) ok = false; }
  for (const [ty, v] of [['int', '-3'], ['bool', 'true'], ['url', 'https://x.y']]) { const r = check([{ key: 'K', value: v, line: 1 }], { K: { type: ty } }); if (r.length) { ok = false; d.push(`${v}->${J(r)}`); } }
  rec('UC-CheckRules/TS-ERR-RULE_TYPE', ok, d.join(' '));
}
{
  const r = check([{ key: 'E', value: 'c', line: 2 }], { E: { enum: ['a', 'b'] } }); const r2 = check([{ key: 'E', value: 'a', line: 2 }], { E: { enum: ['a', 'b'] } });
  rec('UC-CheckRules/TS-ERR-RULE_ENUM', r.length === 1 && r[0].rule === 'enum' && r[0].line === 2 && r2.length === 0, `${J(r)} / ${J(r2)}`);
}
{
  const bad = [[], { A: 1 }, { A: { type: 'float' } }, { A: { enum: 'x' } }].map((s) => checkSchema(s));
  rec('UC-CheckRules/TS-ERR-SCHEMA_INVALID', bad.every((x) => x.length > 0) && J(checkSchema({ A: { required: true, type: 'int', enum: ['1'] } })) === '[]', J(bad));
}
{ const r = check([{ key: 'A', value: 'x', line: 1 }, { key: 'A', value: '1', line: 2 }], { A: { type: 'int' } }); rec('UC-CheckRules/TS-REQ-duplicate-last', r.length === 0, J(r)); }
{ const r = check([{ key: 'Z', value: 'q', line: 1 }, { key: 'B', value: 'no', line: 2 }], { A: { required: true }, B: { type: 'bool' } }); rec('UC-CheckRules/Step6-7 ignore+order', J(r.map((f) => f.key)) === '["A","B"]', J(r)); }

// ---------- UC-LintEnvFile ----------
const FIND = { 's.json': '{"A":{"type":"int"},"B":{"required":true}}', 'app.env': 'A=x\nGARBAGE\n' };
{
  const d = fx({ ...FIND, 'clean.json': '{"A":{"type":"int","required":true}}', 'clean.env': 'A=1\n', 'bad.json': '{not json' });
  const before = snap(d); const res = []; let ok = true;
  for (const [a, st] of [[['--schema', 'clean.json', 'clean.env'], 0], [['--schema', 's.json', 'app.env'], 1], [['--schema', 'bad.json', 'clean.env'], 2]]) { const r = run(a, d); const same = snap(d) === before; res.push(`exit ${r.status} (want ${st}) unchanged=${same}`); if (r.status !== st || !same) ok = false; }
  rec('UC-LintEnvFile/TS-INV-01', ok, res.join('; '));
}
{
  const d = fx({ 'null.json': 'null', 's.json': '{"A":{"type":"int"}}', 'a.env': 'A=1\n' });
  writeFileSync(join(d, 'g.env'), Buffer.from([0, 255, 254, 10, 1, 2, 61, 200, 13, 10, 0x1b, 0x5b, 0x22]));
  const g = run(['--schema', 's.json', 'g.env'], d); const n = run(['--schema', 'null.json', 'a.env'], d);
  rec('UC-LintEnvFile/TS-INV-02', [1, 2].includes(g.status) && !STACK.test(g.stderr) && n.status === 2 && !STACK.test(n.stderr) && /^envlint: /.test(n.stderr), `garbage exit=${g.status} stderr=${J(g.stderr)}; null exit=${n.status} stderr=${J(n.stderr)}`);
}
{
  const d = fx(FIND); const r = run(['--schema', 's.json', 'app.env'], d);
  rec('UC-LintEnvFile/TS-INV-03', r.error === undefined && r.status === 1 && !/\x1b\[/.test(r.stdout + r.stderr), `stdin=ignore exit=${r.status} signal=${r.signal} ansi=${/\x1b\[/.test(r.stdout + r.stderr)}`);
}
{
  const d = fx({ 's.json': '{}', 'a.env': '', 'b.env': '' }); const res = []; let ok = true;
  for (const a of [[], ['--schema'], ['a.env', '--schema'], ['--schema', 's.json'], ['--schema', 's.json', 'a.env', 'b.env'], ['--bogus', '--schema', 's.json', 'a.env'], ['--schema=', 'a.env']]) {
    const r = run(a, d); res.push(`${J(a)}->${r.status} ${J(r.stderr)}`);
    if (!(r.status === 2 && /^envlint: /.test(r.stderr) && /usage:/.test(r.stderr) && !STACK.test(r.stderr))) ok = false;
  }
  rec('UC-LintEnvFile/TS-ERR-USAGE', ok, res.join(' | '));
}
{
  const d = fx({ 's.json': '{}', 'a.env': 'A=1\n' }); mkdirSync(join(d, 'sdir')); mkdirSync(join(d, 'edir')); const res = []; let ok = true;
  for (const [a, p] of [[['--schema', 's.json', 'nope.env'], 'nope.env'], [['--schema', 'nope.json', 'a.env'], 'nope.json'], [['--schema', 'sdir', 'a.env'], 'sdir'], [['--schema', 's.json', 'edir'], 'edir']]) {
    const r = run(a, d); res.push(`${p}->${r.status} ${J(r.stderr)}`);
    if (!(r.status === 2 && r.stderr === `envlint: cannot read ${p}\n`)) ok = false;
  }
  rec('UC-LintEnvFile/TS-ERR-IO', ok, res.join(' | '));
}
{
  const d = fx({ 'bad.json': '{not json', 'f.json': '{"A":{"type":"float"}}', 'a.env': 'A=1\n' }); const res = []; let ok = true;
  for (const s of ['bad.json', 'f.json']) { const r = run(['--schema', s, 'a.env'], d); res.push(`${s}->${r.status} ${J(r.stderr)}`); if (!(r.status === 2 && r.stderr.startsWith(`envlint: invalid schema ${s}`) && !STACK.test(r.stderr))) ok = false; }
  rec('UC-LintEnvFile/TS-ERR-SCHEMA', ok, res.join(' | '));
}
{
  const d = fx(FIND); const r = run(['--schema', 's.json', 'app.env'], d); const L = r.stdout.trimEnd().split('\n');
  rec('UC-LintEnvFile/TS-ERR-FINDINGS', r.status === 1 && L.length === 3 && /^app\.env:1: A: /.test(L[0]) && /^app\.env:2: /.test(L[1]) && /^app\.env: B: /.test(L[2]), `exit=${r.status} stdout=${J(r.stdout)}`);
}
{ const d = fx({ 's.json': '{"A":{"type":"int","required":true}}', 'app.env': 'A=1' }); const r = run(['--schema', 's.json', 'app.env'], d); rec('UC-LintEnvFile/TS-REQ-clean', r.status === 0 && r.stdout === '', `exit=${r.status} stdout=${J(r.stdout)} stderr=${J(r.stderr)}`); }
{
  const d = fx({ 'e.env': '', 'c.env': '# only\n\n#x\n', 'o.json': '{"A":{"type":"int"}}', 'r.json': '{"Z":{"required":true}}' }); const res = []; let ok = true;
  for (const e of ['e.env', 'c.env']) { const a = run(['--schema', 'o.json', e], d); const b = run(['--schema', 'r.json', e], d); res.push(`${e}: ${a.status} ${J(a.stdout)} then ${b.status} ${J(b.stdout)}`); if (!(a.status === 0 && a.stdout === '' && b.status === 1 && b.stdout.includes('Z'))) ok = false; }
  rec('UC-LintEnvFile/TS-REQ-empty-file', ok, res.join(' | '));
}
{
  const d = fx(FIND); const base = run(['--schema', 's.json', 'app.env'], d); const res = []; let ok = true;
  for (const a of [['app.env', '--schema=s.json'], ['app.env', '--schema', 's.json'], ['--schema=s.json', 'app.env']]) { const r = run(a, d); res.push(`${J(a)}->${r.status}`); if (r.status !== base.status || r.stdout !== base.stdout) ok = false; }
  rec('UC-LintEnvFile/TS-REQ-schema-position', ok, `base=${base.status} ${res.join(' ')}`);
}
{ const d = fx({ '.env': 'A=bad\nGARBAGE\n', 's.json': '{"A":{"type":"int","required":true}}', 'ok.env': 'A=1\n' }); const r = run(['--schema', 's.json', 'ok.env'], d); rec('UC-LintEnvFile/TS-NOGO-01', r.status === 0 && r.stdout === '', `exit=${r.status} stdout=${J(r.stdout)}`); }
{ const d = fx({ 's.json': '{"Q":{"required":true},"C":{"type":"int"},"A":{"enum":["z"]}}', 'x.env': 'A=1\nBAD\nC=y\n' }); const r = run(['--schema', 's.json', 'x.env'], d); rec('UC-LintEnvFile/Step8 ordering', r.status === 1 && J(r.stdout.trimEnd().split('\n').map((l) => l.split(': ')[0])) === J(['x.env:1', 'x.env:2', 'x.env:3', 'x.env']), J(r.stdout)); }

rmSync(SCR, { recursive: true, force: true });
console.log(out.join('\n'));
console.log(`total=${out.length} fail=${out.filter((l) => l.startsWith('FAIL')).length}`);
