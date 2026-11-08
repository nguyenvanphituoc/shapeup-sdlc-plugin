// Evaluator probe for envlint round 1. Drives bin/envlint.mjs as a process and the two pure modules directly.
// Fixtures live under this evidence folder only. Usage: node probe.mjs <projectRoot>
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.argv[2];
const BIN = join(ROOT, 'bin/envlint.mjs');
const FX = join(ROOT, '.shapeup/envlint/evaluation/evidence/fx');
rmSync(FX, { recursive: true, force: true });
mkdirSync(FX, { recursive: true });
const { parseEnv } = await import(pathToFileURL(join(ROOT, 'src/parse.mjs')));
const { checkSchema, checkPairs } = await import(pathToFileURL(join(ROOT, 'src/rules.mjs')));

const out = {};
const rec = (id, data) => { out[id] = data; };
function dir(name, files = {}) {
  const d = join(FX, name); mkdirSync(d, { recursive: true });
  for (const [n, c] of Object.entries(files)) writeFileSync(join(d, n), c);
  return d;
}
function run(args, cwd, opts = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', timeout: 10000, ...opts });
  return { args, code: r.status, signal: r.signal, err: r.error?.code, stdout: r.stdout, stderr: r.stderr };
}
const stack = (s) => /^\s+at /m.test(s) || /^\w*Error:/m.test(s);

// ---- UC-01 ----
{
  const t = '\n# c\nA=1\n  \nexport B=2\nbad\n# x\nC="q"\n';
  const r = parseEnv(t);
  rec('UC01/TS-INV-01', { r, expect: 'A@3 B@5 problem@6 C@8' });
}
{
  const src = readFileSync(join(ROOT, 'src/parse.mjs'), 'utf8');
  const a = parseEnv('A=1\nB=2\nx\n'), b = parseEnv('A=1\nB=2\nx\n');
  rec('UC01/TS-INV-02', { hasImport: /^\s*import\b|\bimport\s*\(/m.test(src), hasRequire: /require\(/.test(src), same: JSON.stringify(a) === JSON.stringify(b) });
}
rec('UC01/TS-INV-03', parseEnv('A=${HOME}/x'));
{
  const res = {};
  for (const [k, v] of Object.entries({ empty: '', nl: '\n\n', eq: '=', q: "'", bom: '﻿A=1\nB=2', crlf: 'A=1\r\nB="x"\r\n\r\nC\r\n', dq: '"', export: 'export', exportsp: 'export ', nul: '\0\0=\0' })) {
    try { const r = parseEnv(v); res[k] = { ok: Array.isArray(r.pairs) && Array.isArray(r.problems), r }; } catch (e) { res[k] = { threw: String(e) }; }
  }
  rec('UC01/TS-INV-04', res);
}
rec('UC01/TS-ERR-MISSING_EQUALS', parseEnv('A=1\nJUSTAKEY\n'));
rec('UC01/TS-ERR-INVALID_KEY', parseEnv('1BAD=x\n=x\n'));
rec('UC01/TS-ERR-UNTERMINATED_QUOTE', parseEnv('A="abc\nB=\'x\n'));
rec('UC01/steps', {
  kv: parseEnv('KEY=value'), quotes: parseEnv('A="x y"\nB=\'x y\'\nC="a\\nb"\nD=x # not a comment\nE= spaced \nF=a=b'),
  mixedQuote: parseEnv('A="x\''), lone: parseEnv('A="'), dup: parseEnv('A=1\nA=2'), exportTab: parseEnv('export\tK=v'),
});

// ---- UC-02 ----
{
  const src = readFileSync(join(ROOT, 'src/rules.mjs'), 'utf8');
  const f = checkPairs([{ key: 'U', value: 'http://unreachable.invalid', line: 1 }], { U: { type: 'url' } });
  rec('UC02/TS-INV-01', { hasImport: /^\s*import\b|\bimport\s*\(/m.test(src), net: /\b(fetch|http|https|net|dns|node:)\b/.test(src.replace(/http:|https:/g, '')), findings: f });
}
rec('UC02/TS-INV-02', checkPairs([{ key: 'A', value: '1', line: 1 }, { key: 'B', value: 'z', line: 2 }, { key: 'A', value: 'x', line: 3 }], { A: { type: 'int' } }));
rec('UC02/TS-INV-03', checkPairs([{ key: 'EXTRA', value: 'x', line: 1 }], { A: { type: 'int' } }));
rec('UC02/TS-ERR-REQUIRED_MISSING', checkPairs([], { PORT: { required: true } }));
{
  const cases = [['int', '1.0'], ['int', '0x10'], ['int', '1e3'], ['int', ''], ['int', ' 7'], ['bool', 'yes'], ['url', 'localhost:3000'], ['url', 'javascript:alert(1)'], ['url', 'file:///etc']];
  rec('UC02/TS-ERR-TYPE_MISMATCH', cases.map(([t, v]) => ({ t, v, f: checkPairs([{ key: 'K', value: v, line: 1 }], { K: { type: t } }) })));
}
{
  const cases = [['int', '0'], ['int', '-5'], ['int', '42'], ['bool', 'true'], ['bool', 'false'], ['url', 'https://a.example/x'], ['string', '']];
  rec('UC02/TS-REQ-type-boundary', cases.map(([t, v]) => ({ t, v, f: checkPairs([{ key: 'K', value: v, line: 1 }], { K: { type: t } }) })));
}
rec('UC02/TS-ERR-ENUM_MISMATCH', ['Dev', 'staging', 'dev'].map((v) => ({ v, f: checkPairs([{ key: 'M', value: v, line: 1 }], { M: { enum: ['dev', 'prod'] } }) })));
rec('UC02/TS-ERR-SCHEMA_INVALID', [[], null, { A: { type: 'float' } }, { A: { enum: [] } }, { A: { required: 'yes' } }, { A: { min: 1 } }, 5, 'x', { A: 1 }, { A: { enum: [1] } }, {}, { P: { required: true, type: 'int' }, M: { enum: ['a'] } }].map((s) => ({ s, e: checkSchema(s) })));
rec('UC02/steps', {
  both: checkPairs([{ key: 'K', value: 'x', line: 4 }], { K: { type: 'int', enum: ['1'] } }),
  order: checkPairs([{ key: 'B', value: 'x', line: 5 }, { key: 'A', value: 'y', line: 2 }], { Z: { required: true }, B: { type: 'int' }, A: { type: 'bool' }, Y: { required: true } }),
  enumMsg: checkPairs([{ key: 'M', value: 'q', line: 1 }], { M: { enum: ['a', 'b', 'c'] } }),
  urlEdge: ['http://', 'https://x', 'HTTP://A.B', 'http://[::1]/'].map((v) => ({ v, f: checkPairs([{ key: 'U', value: v, line: 1 }], { U: { type: 'url' } }) })),
});
{
  let threw = null;
  try { checkPairs([{ key: '__proto__', value: 'x', line: 1 }, { key: 'constructor', value: 'y', line: 2 }], JSON.parse('{"__proto__":{"type":"int"},"constructor":{"required":true},"toString":{"required":true}}')); } catch (e) { threw = String(e); }
  rec('UC02/INV-04', { threw, schemaErrs: checkSchema(JSON.parse('{"__proto__":{"type":"int"},"constructor":{"required":true}}')) });
}

// ---- UC-03 ----
{
  const garbage = Buffer.from(Array.from({ length: 1024 }, (_, i) => (i * 131 + 7) % 256));
  const d = dir('inv01', { 's.json': '{"A":{"required":true,"type":"int"}}', 'bad.json': '{not json', 'inv.json': '{"A":{"type":"float"}}', 'arr.json': '[]', 'nul.json': 'null', 'garbage.env': garbage });
  mkdirSync(join(d, 'adir'), { recursive: true });
  const cases = [[], ['--schema'], ['--schema', 's.json'], ['--schema', 's.json', 'a', 'b'], ['--color'], ['-h'], ['--schema', 's.json', 'nope.env'], ['--schema', 's.json', 'adir'], ['--schema', 'adir', 'garbage.env'], ['--schema', 'nope.json', 'garbage.env'], ['--schema', 'bad.json', 'garbage.env'], ['--schema', 'inv.json', 'garbage.env'], ['--schema', 'arr.json', 'garbage.env'], ['--schema', 'nul.json', 'garbage.env'], ['--schema', 's.json', 'garbage.env'], ['--schema', 'garbage.env', 's.json'], ['--schema=', 's.json']];
  rec('UC03/TS-INV-01', cases.map((a) => { const r = run(a, d, { input: '' }); return { ...r, stack: stack(r.stderr), stderrLines: r.stderr.split('\n').filter(Boolean).length, stdout: r.stdout.slice(0, 300) }; }));
}
{
  const d = dir('inv02', { 'e.env': 'HOST=x\nPORT=abc\n', 's.json': '{"PORT":{"type":"int"},"TOKEN":{"required":true}}' });
  rec('UC03/TS-INV-02', run(['--schema', 's.json', 'e.env'], d, { input: '' }));
}
{
  const d = dir('inv03', { 'e.env': '# only comments\n\n   \n# more\n', 'empty.json': '{}', 'req.json': '{"A":{"required":true}}', 'zero.env': '' });
  rec('UC03/TS-INV-03', { clean: run(['--schema', 'empty.json', 'e.env'], d, { input: '' }), req: run(['--schema', 'req.json', 'e.env'], d, { input: '' }), zeroByte: run(['--schema', 'empty.json', 'zero.env'], d, { input: '' }) });
}
{
  const d = dir('inv04', { 'e.env': 'PORT=abc\n', 's.json': '{"PORT":{"type":"int"}}' });
  const before = readdirSync(d).sort();
  const runs = [run(['--schema', 's.json', 'e.env'], d, { input: '' }), run(['--schema', 's.json'], d, { input: '' }), run([], d, { input: '' }), run(['--schema', 's.json', 'nope.env'], d, { input: '' })];
  const after = readdirSync(d).sort();
  rec('UC03/TS-INV-04', { before, after, codes: runs.map((r) => r.code) });
}
{
  const d = dir('inv05', { 'e.env': 'PORT=abc\nbad\n', 's.json': '{"PORT":{"type":"int"},"T":{"required":true}}', 'esc.env': 'PORT=\x1b[31mred\n', 'esc.json': '{"PORT":{"type":"int"}}' });
  const r = spawnSync(process.execPath, [BIN, '--schema', 's.json', 'e.env'], { cwd: d, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 });
  const r2 = run(['--schema', 'esc.json', 'esc.env'], d, { input: '' });
  rec('UC03/TS-INV-05', { status: r.status, timedOut: r.error?.code ?? null, esc: r.stdout.includes('\x1b') || r.stderr.includes('\x1b'), stdout: r.stdout,
    userEscValue: { code: r2.code, stdoutHasEsc: r2.stdout.includes('\x1b'), stdoutJson: JSON.stringify(r2.stdout) } });
}
{
  const d = dir('usage', { 's.json': '{}', 'a.env': '', 'b.env': '' });
  rec('UC03/TS-ERR-USAGE', [[], ['--schema', 's.json'], ['--schema', 's.json', 'a.env', 'b.env'], ['--color'], ['a.env'], ['--schema', 's.json', '--schema', 's.json', 'a.env'], ['--schema=s.json', 'a.env']].map((a) => run(a, d, { input: '' })));
}
{
  const d = dir('io', { 's.json': '{}', 'a.env': 'A=1\n', 'bad.json': '{not json', 'inv.json': '{"A":{"type":"float"}}' });
  mkdirSync(join(d, 'adir'), { recursive: true });
  rec('UC03/TS-ERR-ENV_NOT_FOUND', run(['--schema', 's.json', 'missing.env'], d, { input: '' }));
  rec('UC03/TS-ERR-ENV_UNREADABLE', run(['--schema', 's.json', 'adir'], d, { input: '' }));
  rec('UC03/TS-ERR-SCHEMA_NOT_FOUND', run(['--schema', 'missing.json', 'a.env'], d, { input: '' }));
  rec('UC03/TS-ERR-SCHEMA_INVALID_JSON', run(['--schema', 'bad.json', 'a.env'], d, { input: '' }));
  rec('UC03/TS-ERR-SCHEMA_INVALID', run(['--schema', 'inv.json', 'a.env'], d, { input: '' }));
}
{
  const d = dir('findings', { 'e.env': 'A=1\nB=2\nnoequals\n', 's.json': '{}' });
  rec('UC03/TS-ERR-FINDINGS', run(['--schema', 's.json', 'e.env'], d, { input: '' }));
}
{
  const d = dir('nogo1', { 's.json': '{"A":{"required":true,"type":"int"}}', '.env': 'A=notint\n' });
  rec('UC03/TS-NOGO-01', run(['--schema', 's.json'], d, { input: '' }));
}
{
  const d = dir('nogo2', { 'e.env': 'A=${HOME}\n', 's.json': '{"A":{"enum":["${HOME}"]}}' });
  rec('UC03/TS-NOGO-02', run(['--schema', 's.json', 'e.env'], d, { input: '' }));
}
{
  const d = dir('order', { 'e.env': 'K=x\nnoeq\nK2=q\n', 's.json': '{"Z":{"required":true},"K2":{"enum":["a","b"]},"K":{"type":"int","enum":["1"]},"Y":{"required":true}}' });
  rec('UC03/output-order', run(['--schema', 's.json', 'e.env'], d, { input: '' }));
}
{
  const src = readFileSync(BIN, 'utf8') + readFileSync(join(ROOT, 'src/parse.mjs'), 'utf8') + readFileSync(join(ROOT, 'src/rules.mjs'), 'utf8');
  rec('UC03/static', { shebang: readFileSync(BIN, 'utf8').startsWith('#!/usr/bin/env node\n'), writes: /writeFile|appendFile|createWriteStream|fetch\(|node:https?|node:net/.test(src), stdin: /process\.stdin|readFileSync\(0|\/dev\/stdin/.test(src), defaultEnv: /['"]\.env['"]/.test(src) });
}
process.stdout.write(JSON.stringify(out, null, 1));
