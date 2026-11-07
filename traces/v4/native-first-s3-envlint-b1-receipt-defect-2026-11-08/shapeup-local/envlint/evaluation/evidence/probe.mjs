// Evaluator's own probe of envlint (round 1) — process oracle on bin/envlint.mjs + direct module calls.
// Run: node probe.mjs <out.json>
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const ROOT = '/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer';
const BIN = join(ROOT, 'bin/envlint.mjs');
const { parse } = await import(join(ROOT, 'src/parse.mjs'));
const { validateSchema, evaluate } = await import(join(ROOT, 'src/rules.mjs'));

const results = [];
function rec(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}
function check(id, fn) {
  try { const d = fn(); rec(id, true, d ?? 'ok'); } catch (e) { rec(id, false, e.message); }
}
const dir = mkdtempSync(join(tmpdir(), 'envlint-eval-'));
const f = (name, body) => { const p = join(dir, name); writeFileSync(p, body); return p; };
function run(args, opts = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8', cwd: opts.cwd ?? dir, stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
  return { code: r.status, out: r.stdout, err: r.stderr, sig: r.signal };
}
const noTrace = (r) => !/^\s*at /m.test(r.err) && !/Error:/.test(r.err);

// ---------------- UC-ParseEnvText ----------------
check('P TS-INV-01', () => { const t = 'A=1\n#c\nB="x"\nbad'; assert.deepEqual(parse(t), parse(t)); assert.throws(() => parse(undefined)); return 'deep-equal; parse(undefined) throws'; });
check('P TS-INV-02', () => { const r = parse('A=${B}\nC=$D'); assert.deepEqual(r.pairs.map(p => p.value), ['${B}', '$D']); return r; });
check('P TS-INV-03', () => { const r = parse('A=1\n\n# c\nBAD LINE\nB=2'); assert.deepEqual(r.pairs.map(p => p.line), [1, 5]); assert.deepEqual(r.problems, [{ line: 4, message: 'expected KEY=value' }]); return r; });
check('P TS-ERR-NO_EQUALS', () => { const r = parse('JUSTAKEY'); assert.deepEqual(r, { pairs: [], problems: [{ line: 1, message: 'expected KEY=value' }] }); return r; });
check('P TS-ERR-INVALID_KEY', () => { const r = parse('1BAD=x'); assert.deepEqual(r.problems, [{ line: 1, message: 'invalid key' }]); return r; });
check('P TS-ERR-UNTERMINATED_SINGLE', () => { const r = parse("A='abc"); assert.deepEqual(r.problems, [{ line: 1, message: 'unterminated single quote' }]); return r; });
check('P TS-ERR-UNTERMINATED_DOUBLE', () => { const r = parse('A="abc'); assert.deepEqual(r.problems, [{ line: 1, message: 'unterminated double quote' }]); return r; });
check('P TS-ERR-TRAILING_AFTER_QUOTE', () => { const r = parse("A='x' y"); assert.deepEqual(r.problems, [{ line: 1, message: 'unexpected text after closing quote' }]); return r; });
check('P TS-REQ-forms', () => {
  const r = parse("KEY=value\nexport KEY=value\nA='x # y'\nB=\"a\\nb\"\nC=v # c\n# c\n");
  assert.deepEqual(r.pairs.map(p => [p.key, p.value]), [['KEY', 'value'], ['KEY', 'value'], ['A', 'x # y'], ['B', 'a\nb'], ['C', 'v']]);
  assert.deepEqual(r.problems, []); return r.pairs;
});
check('P TS-REQ-empty', () => { assert.deepEqual(parse(''), { pairs: [], problems: [] }); assert.deepEqual(parse('# a\n  # b\n\n'), { pairs: [], problems: [] }); return 'both empty'; });
check('P TS-NOGO-01', () => { const s = readFileSync(join(ROOT, 'src/parse.mjs'), 'utf8'); assert.ok(!/\bimport\b|require\(/.test(s), 'parse.mjs has an import'); return 'src/parse.mjs contains no import/require'; });
check('P step1 CRLF', () => { assert.deepEqual(parse('A=1\r\nB=2\r\n'), parse('A=1\nB=2\n')); return 'CRLF==LF'; });
check('P step6b escapes', () => { const r = parse('A="q\\"x\\\\y\\tz"'); assert.equal(r.pairs[0].value, 'q"x\\y\\tz'); return r.pairs[0].value; });
check('P step6a literal single', () => { const r = parse("A='a\\nb'"); assert.equal(r.pairs[0].value, 'a\\nb'); return r.pairs[0].value; });
check('P step6c comment after quote', () => { const r = parse('A="x"   # c'); assert.deepEqual(r.pairs[0].value, 'x'); assert.deepEqual(r.problems, []); return 'ok'; });
check('P step6d hash no space', () => { const r = parse('A=a#b'); assert.equal(r.pairs[0].value, 'a#b'); return 'a#b'; });
check('P step5 key trim', () => { const r = parse('  A  =  v  '); assert.deepEqual(r.pairs[0], { key: 'A', value: 'v', line: 1 }); return r.pairs[0]; });
check('P step7 duplicates kept', () => { const r = parse('A=1\nA=2'); assert.equal(r.pairs.length, 2); return 'kept'; });
check('P empty value', () => { const r = parse('A='); assert.deepEqual(r.pairs[0], { key: 'A', value: '', line: 1 }); return 'A=""'; });
check('P domain one-per-line', () => { const r = parse("A=1\nB\n1X=2\nC='x\nD=\"y\" z\nE=5"); const lines = [...r.pairs.map(p => p.line), ...r.problems.map(p => p.line)]; assert.equal(new Set(lines).size, lines.length); assert.equal(lines.length, 6); return 'each line exactly one'; });

// ---------------- UC-EvaluateRules ----------------
check('R TS-INV-01', () => {
  const pairs = [{ key: 'A', value: 'x', line: 1 }]; const schema = { A: { required: true, type: 'int', enum: ['1'] }, B: { required: true } };
  const p0 = structuredClone(pairs), s0 = structuredClone(schema);
  validateSchema(schema); evaluate(pairs, schema);
  assert.deepEqual(pairs, p0); assert.deepEqual(schema, s0);
  const s = readFileSync(join(ROOT, 'src/rules.mjs'), 'utf8'); assert.ok(!/\bimport\b|require\(/.test(s)); return 'args unchanged; no import';
});
const judge = (type, v) => evaluate([{ key: 'K', value: v, line: 1 }], { K: { type } }).length === 0;
check('R TS-INV-02', () => {
  const acc = { int: ['42', '-1', '+3'], url: ['https://a.b', 'postgres://u:p@h:5432/db', 'http://localhost:3000'], bool: ['true', 'FALSE', '1', '0'] };
  const rej = { int: ['', ' 7', '1e3', '0x10', '3.0', 'abc'], url: ['localhost:3000', 'mailto:x@y', 'http:/x', 'https://', '', 'not a url'], bool: ['yes', '', 'on', '2'] };
  const bad = [];
  for (const [t, vs] of Object.entries(acc)) for (const v of vs) if (!judge(t, v)) bad.push(`${t} wrongly rejects ${JSON.stringify(v)}`);
  for (const [t, vs] of Object.entries(rej)) for (const v of vs) if (judge(t, v)) bad.push(`${t} wrongly accepts ${JSON.stringify(v)}`);
  assert.deepEqual(bad, []); return 'all accepts/rejects as listed';
});
check('R TS-INV-03', () => { const r = evaluate([{ key: 'A', value: '', line: 1 }], { A: { required: true, type: 'int' } }); assert.deepEqual(r.map(x => x.code), ['INVALID_TYPE']); return r; });
check('R TS-ERR-MISSING_REQUIRED', () => { const r = evaluate([], { A: { required: true } }); assert.deepEqual(r, [{ key: 'A', line: null, code: 'MISSING_REQUIRED', message: 'required key is missing' }]); return r; });
check('R TS-ERR-INVALID_TYPE', () => { const r = evaluate([{ key: 'PORT', value: 'abc', line: 3 }], { PORT: { type: 'int' } }); assert.deepEqual(r, [{ key: 'PORT', line: 3, code: 'INVALID_TYPE', message: 'expected int, got "abc"' }]); return r; });
check('R TS-ERR-NOT_IN_ENUM', () => { const r = evaluate([{ key: 'MODE', value: 'prod', line: 2 }], { MODE: { enum: ['dev', 'test'] } }); assert.deepEqual(r, [{ key: 'MODE', line: 2, code: 'NOT_IN_ENUM', message: 'expected one of dev, test; got "prod"' }]); assert.equal(evaluate([{ key: 'MODE', value: 'DEV', line: 2 }], { MODE: { enum: ['dev'] } }).length, 1); return r; });
check('R TS-ERR-SCHEMA_INVALID', () => {
  const cases = [[], null, { A: { type: 'float' } }, { A: { enum: [] } }, { A: { required: 'yes' } }, { A: { foo: 1 } }, 'x', 3, { A: 1 }, { A: { enum: [1] } }];
  const out = cases.map(c => validateSchema(c)); out.forEach((m, i) => assert.ok(m.length >= 1, `case ${i} accepted`));
  assert.deepEqual(validateSchema({ A: { required: true, type: 'int', enum: ['1'] }, B: {} }), []); return out;
});
check('R TS-REQ-duplicate', () => { assert.deepEqual(evaluate([{ key: 'A', value: 'x', line: 1 }, { key: 'A', value: '1', line: 2 }], { A: { type: 'int' } }), []); return 'no finding'; });
check('R TS-NOGO-01', () => { const s = readFileSync(join(ROOT, 'src/rules.mjs'), 'utf8'); assert.ok(!/parse\.mjs|node:fs|node:net|node:http|node:dns|\bimport\b/.test(s)); return 'no import'; });
check('R step both codes', () => { const r = evaluate([{ key: 'A', value: 'x', line: 1 }], { A: { type: 'int', enum: ['1'] } }); assert.deepEqual(r.map(x => x.code), ['INVALID_TYPE', 'NOT_IN_ENUM']); return r; });
check('R step schema order + unknown ignored', () => { const r = evaluate([{ key: 'Z', value: '', line: 1 }, { key: 'X', value: 'q', line: 2 }], { B: { required: true }, A: { required: true } }); assert.deepEqual(r.map(x => x.key), ['B', 'A']); return 'B,A'; });
check('R validateSchema messages', () => {
  assert.deepEqual(validateSchema([]), ['schema must be a JSON object']);
  assert.deepEqual(validateSchema({ K: 1 }), ['K: rule must be an object']);
  assert.deepEqual(validateSchema({ K: { required: 'y' } }), ['K: required must be true or false']);
  assert.deepEqual(validateSchema({ K: { type: 'float' } }), ['K: unknown type float']);
  assert.deepEqual(validateSchema({ K: { enum: [] } }), ['K: enum must be a non-empty array of strings']);
  assert.deepEqual(validateSchema({ K: { foo: 1 } }), ['K: unknown property foo']);
  return 'messages verbatim';
});

// ---------------- UC-LintEnvFile (process oracle) ----------------
const okSchema = f('ok.json', JSON.stringify({ PORT: { type: 'int' } }));
check('C TS-INV-01', () => {
  const garbage = join(dir, 'garbage.bin'); writeFileSync(garbage, Buffer.from([0, 255, 254, 10, 61, 0, 128, 27, 10, 65, 61, 0xc3, 0x28]));
  const sub = join(dir, 'adir'); mkdirSync(sub);
  const runs = [run(['--schema', okSchema, garbage]), run(['--schema', f('arr.json', '[]'), f('e1.env', 'A=1')]), run(['--schema', f('str.json', '"x"'), f('e2.env', 'A=1')]), run(['--schema', okSchema, sub])];
  runs.forEach((r, i) => { assert.ok([1, 2].includes(r.code), `run ${i} exit ${r.code}`); assert.ok(noTrace(r), `run ${i} trace: ${r.err}`); });
  return runs.map(r => ({ code: r.code, err: r.err.trim(), out: r.out.trim().slice(0, 80) }));
});
check('C TS-INV-02', () => {
  const t = mkdtempSync(join(tmpdir(), 'envlint-inv2-')); writeFileSync(join(t, '.env'), 'SECRET_SENTINEL=zzz\n');
  const snap = () => readdirSync(t).map(n => n + ':' + createHash('sha256').update(readFileSync(join(t, n))).digest('hex')).sort().join('|');
  const before = snap();
  const envp = f('other.env', 'PORT=abc\n'); const s = f('req.json', JSON.stringify({ SECRET_SENTINEL: { required: true }, PORT: { type: 'int' } }));
  const r1 = run(['--schema', s, envp], { cwd: t }); const r2 = run([], { cwd: t }); const r3 = run(['--schema', s], { cwd: t });
  assert.equal(snap(), before);
  for (const r of [r1, r2, r3]) assert.ok(!/zzz/.test(r.out + r.err), 'sentinel leaked');
  assert.match(r1.out, /SECRET_SENTINEL: required key is missing/); assert.equal(r2.code, 2); assert.equal(r3.code, 2);
  return { r1: r1.out.trim(), r3: r3.err.trim() };
});
check('C TS-INV-03', () => {
  const r = run(['--schema', f('f.json', JSON.stringify({ PORT: { type: 'int' }, HOST: { required: true } })), f('f.env', 'PORT=abc\nBAD LINE\n')]);
  assert.equal(r.sig, null); assert.equal(r.code, 1); assert.ok(!/\x1b\[/.test(r.out + r.err)); return 'exit 1, no ESC, stdin closed, no hang';
});
check('C TS-ERR-USAGE', () => {
  const s = okSchema, e = f('u.env', 'PORT=1');
  const U = 'envlint: usage: envlint --schema <schema.json> <envfile>\n';
  const cases = [[], ['--schema', s], [e], ['--schema', s, e, 'extra'], ['--schema', s, e, '--color'], ['--color', '--schema', s, e], ['--schema', s, '--schema', s, e], ['--schema']];
  const rs = cases.map(c => run(c)); rs.forEach((r, i) => { assert.equal(r.code, 2, `case ${i}`); assert.equal(r.err, U, `case ${i} stderr ${JSON.stringify(r.err)}`); assert.equal(r.out, ''); });
  const after = run([e, '--schema', s]); assert.equal(after.code, 0, 'schema after envfile');
  return `${cases.length} bad argv -> exit 2 + usage; --schema after envfile -> exit 0`;
});
check('C TS-ERR-READ_FAILED', () => {
  const missE = join(dir, 'nope.env'), missS = join(dir, 'nope.json');
  const a = run(['--schema', okSchema, missE]), b = run(['--schema', missS, f('r.env', 'PORT=1')]);
  assert.equal(a.code, 2); assert.equal(a.err, `envlint: cannot read ${missE}\n`);
  assert.equal(b.code, 2); assert.equal(b.err, `envlint: cannot read ${missS}\n`);
  return [a.err.trim(), b.err.trim()];
});
check('C TS-ERR-SCHEMA_INVALID', () => {
  const nj = f('nj.json', '{not json'), bt = f('bt.json', '{"A":{"type":"float"}}'), e = f('s.env', 'A=1');
  const a = run(['--schema', nj, e]), b = run(['--schema', bt, e]);
  assert.equal(a.code, 2); assert.equal(a.err, `envlint: invalid schema ${nj}: not valid JSON\n`);
  assert.equal(b.code, 2); assert.ok(b.err.startsWith(`envlint: invalid schema ${bt}: `)); assert.equal(a.out + b.out, '');
  const multi = run(['--schema', f('m.json', '{"A":{"type":"float","foo":1}}'), e]); assert.equal(multi.err.trim().split('\n').length, 2);
  return [a.err.trim(), b.err.trim(), multi.err.trim()];
});
check('C TS-ERR-FINDINGS', () => {
  const e = f('fx.env', 'PORT=abc\nBAD LINE');
  const r = run(['--schema', f('fx.json', '{"PORT":{"type":"int"},"HOST":{"required":true}}'), e]);
  assert.equal(r.code, 1); assert.equal(r.err, '');
  assert.equal(r.out, `${e}:1: PORT: expected int, got "abc"\n${e}:2: parse error: expected KEY=value\n${e}: HOST: required key is missing\n`);
  return r.out.trim();
});
check('C TS-REQ-clean', () => { const r = run(['--schema', f('c.json', '{"PORT":{"type":"int","required":true},"MODE":{"enum":["dev"]}}'), f('c.env', 'PORT=8080\nMODE=dev\n')]); assert.deepEqual([r.code, r.out, r.err], [0, '', '']); return 'exit 0, silent'; });
check('C TS-REQ-no-assignments', () => {
  const none = f('none.json', '{"A":{"type":"int"}}'), req = f('reqa.json', '{"A":{"required":true}}');
  const empty = f('empty.env', ''), comm = f('comm.env', '# only\n\n  # c\n');
  const out = [];
  for (const e of [empty, comm]) {
    const a = run(['--schema', none, e]); assert.deepEqual([a.code, a.out, a.err], [0, '', '']);
    const b = run(['--schema', req, e]); assert.equal(b.code, 1); assert.equal(b.out, `${e}: A: required key is missing\n`); out.push(b.out.trim());
  }
  return out;
});
check('C TS-NOGO-01', () => { const r = run(['--schema', f('ng.json', '{"A":{"enum":["${B}"]}}'), f('ng.env', 'A=${B}')]); assert.deepEqual([r.code, r.out, r.err], [0, '', '']); return 'exit 0'; });
check('C TS-NOGO-02', () => {
  const files = ['bin/envlint.mjs', 'src/parse.mjs', 'src/rules.mjs'].map(p => [p, readFileSync(join(ROOT, p), 'utf8')]);
  const pats = [/writeFile/, /appendFile/, /process\.env\[[^\]]*\]\s*=/, /process\.env\.\w+\s*=/, /node:net/, /node:http/, /node:https/, /fetch\(/];
  const hits = []; for (const [p, s] of files) for (const re of pats) if (re.test(s)) hits.push(`${p} ${re}`);
  assert.deepEqual(hits, []); return 'no forbidden token in bin/ src/';
});
check('C RULE-02 ordering', () => {
  const e = f('ord.env', 'Z=x\nA=y\nBAD\nB=q');
  const r = run(['--schema', f('ord.json', '{"M2":{"required":true},"B":{"type":"int"},"A":{"type":"int"},"M1":{"required":true},"Z":{"type":"bool"}}'), e]);
  const lines = r.out.trim().split('\n');
  assert.deepEqual(lines, [`${e}:1: Z: expected bool, got "x"`, `${e}:2: A: expected int, got "y"`, `${e}:3: parse error: expected KEY=value`, `${e}:4: B: expected int, got "q"`, `${e}: M2: required key is missing`, `${e}: M1: required key is missing`]);
  return lines;
});
check('C RULE-03 relative path', () => { f('rel.env', 'PORT=x'); const r = run(['--schema', 'ok.json', './rel.env']); assert.equal(r.out, './rel.env:1: PORT: expected int, got "x"\n'); return r.out.trim(); });
check('C step2-3 envfile read before schema', () => { const r = run(['--schema', join(dir, 'nope.json'), join(dir, 'nope.env')]); assert.equal(r.err, `envlint: cannot read ${join(dir, 'nope.env')}\n`); return r.err.trim(); });
// Observation only (not a Test Surface row): value bytes are echoed into finding messages.
check('OBS ANSI echoed from file content', () => { const r = run(['--schema', okSchema, f('esc.env', 'PORT=\x1b[31mred')]); return { code: r.code, stdoutContainsEsc: /\x1b\[/.test(r.out) }; });

console.log('\nSUMMARY', results.filter(r => r.ok).length, '/', results.length);
writeFileSync(process.argv[2] ?? join(dir, 'out.json'), JSON.stringify(results, null, 2));
