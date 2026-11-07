// CLI integration tests — one test per row of the Test Surface in
// shapeup/envlint/spec/usecases/UC-LintEnvFile.md. Spawns the CLI and observes
// exit code, stdout and stderr only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIN = join(ROOT, 'bin', 'envlint.mjs');
const USAGE = 'envlint: usage: envlint --schema <schema.json> <envfile>\n';

function tmp() {
  return mkdtempSync(join(tmpdir(), 'envlint-cli-'));
}

function fixture(dir, name, content) {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

function run(args, opts = {}) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: opts.cwd ?? ROOT,
    timeout: 10000,
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function assertNoTrace(r) {
  assert.doesNotMatch(r.stderr, /^\s+at /m);
  assert.doesNotMatch(r.stderr, /Error:/);
}

test('TS-INV-01: no input produces a stack trace', () => {
  const d = tmp();
  const schema = fixture(d, 's.json', '{}');
  const garbage = fixture(d, 'g.env', Buffer.from([0, 255, 254, 10, 1, 2, 61, 3, 10, 0xc3, 0x28]));
  const arr = fixture(d, 'arr.json', '[]');
  const str = fixture(d, 'str.json', '"x"');
  const env = fixture(d, 'x.env', 'A=1\n');
  const dirEnv = join(d, 'adir');
  mkdirSync(dirEnv);
  const cases = [
    run(['--schema', schema, garbage]),
    run(['--schema', arr, env]),
    run(['--schema', str, env]),
    run(['--schema', schema, dirEnv]),
  ];
  for (const r of cases) {
    assert.ok(r.code === 1 || r.code === 2, `exit ${r.code}`);
    assertNoTrace(r);
  }
  assert.equal(cases[1].code, 2);
  assert.match(cases[1].stderr, new RegExp(`^envlint: invalid schema ${arr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: `));
  assert.equal(cases[3].stderr, `envlint: cannot read ${dirEnv}\n`);
});

test('TS-INV-02: never reads an implicit .env and writes no file', () => {
  const work = tmp();
  const sentinel = 'SECRET_SENTINEL_9f3a=do-not-leak-7c1e';
  fixture(work, '.env', `${sentinel}\nBROKEN LINE\n`);
  const other = tmp();
  const schema = fixture(other, 's.json', '{"HOST":{"required":true}}');
  const env = fixture(other, 'x.env', 'PORT=1\n');
  const snapshot = () =>
    Object.fromEntries(readdirSync(work).map((f) => [f, readFileSync(join(work, f)).toString('base64')]));
  const before = snapshot();
  const runs = [run(['--schema', schema, env], { cwd: work }), run([], { cwd: work }), run(['--schema', schema], { cwd: work })];
  assert.deepEqual(snapshot(), before);
  for (const r of runs) {
    assert.ok(!r.stdout.includes('SECRET_SENTINEL') && !r.stderr.includes('SECRET_SENTINEL'));
    assert.ok(!r.stdout.includes('BROKEN') && !r.stderr.includes('BROKEN'));
  }
  assert.equal(runs[0].code, 1);
  assert.equal(runs[1].code, 2);
  assert.equal(runs[1].stderr, USAGE);
  assert.equal(runs[2].stderr, USAGE);
});

test('TS-INV-03: no ANSI escapes and no stdin', () => {
  const d = tmp();
  const schema = fixture(d, 's.json', '{"PORT":{"type":"int"},"HOST":{"required":true}}');
  const env = fixture(d, 'x.env', 'PORT=abc\nBAD LINE\n');
  const runs = [run(['--schema', schema, env]), run([]), run(['--schema', schema, join(d, 'nope.env')])];
  for (const r of runs) {
    assert.ok(r.code === 1 || r.code === 2);
    assert.ok(!r.stdout.includes('\x1b[') && !r.stderr.includes('\x1b['));
  }
});

test('TS-ERR-USAGE: bad arguments exit 2 with the usage line', () => {
  const d = tmp();
  const schema = fixture(d, 's.json', '{}');
  const env = fixture(d, 'x.env', 'A=1\n');
  const cases = [[], ['--schema', schema], [env], ['--schema', schema, env, env], ['--schema', schema, env, '--color'], ['--schema', schema, '--schema', schema, env], [env, '--schema']];
  for (const args of cases) {
    const r = run(args);
    assert.equal(r.code, 2, JSON.stringify(args));
    assert.equal(r.stderr, USAGE);
    assert.equal(r.stdout, '');
  }
});

test('TS-ERR-READ_FAILED: a missing path exits 2 naming it', () => {
  const d = tmp();
  const schema = fixture(d, 's.json', '{}');
  const env = fixture(d, 'x.env', 'A=1\n');
  const missingEnv = join(d, 'nope.env');
  const missingSchema = join(d, 'nope.json');
  let r = run(['--schema', schema, missingEnv]);
  assert.equal(r.code, 2);
  assert.equal(r.stderr, `envlint: cannot read ${missingEnv}\n`);
  assert.equal(r.stdout, '');
  r = run(['--schema', missingSchema, env]);
  assert.equal(r.code, 2);
  assert.equal(r.stderr, `envlint: cannot read ${missingSchema}\n`);
  assert.equal(r.stdout, '');
});

test('TS-ERR-SCHEMA_INVALID: bad JSON and bad shape exit 2', () => {
  const d = tmp();
  const env = fixture(d, 'x.env', 'A=1\n');
  for (const content of ['{not json', '{"A":{"type":"float"}}']) {
    const schema = fixture(d, `s${content.length}.json`, content);
    const r = run(['--schema', schema, env]);
    assert.equal(r.code, 2);
    assert.ok(r.stderr.startsWith(`envlint: invalid schema ${schema}: `), r.stderr);
    assert.equal(r.stdout, '');
    assertNoTrace(r);
  }
});

test('TS-ERR-FINDINGS: findings are printed in order, exit 1', () => {
  const d = tmp();
  const schema = fixture(d, 's.json', '{"PORT":{"type":"int"},"HOST":{"required":true}}');
  const f = fixture(d, 'bad.env', 'PORT=abc\nBAD LINE');
  const expected = [`${f}:1: PORT: expected int, got "abc"`, `${f}:2: parse error: expected KEY=value`, `${f}: HOST: required key is missing`].join('\n') + '\n';
  for (const args of [['--schema', schema, f], [f, '--schema', schema]]) {
    const r = run(args);
    assert.equal(r.code, 1);
    assert.equal(r.stdout, expected);
    assert.equal(r.stderr, '');
  }
});

test('TS-REQ-clean: a valid envfile exits 0 with no output', () => {
  const d = tmp();
  const schema = fixture(d, 's.json', '{"PORT":{"type":"int","required":true},"MODE":{"enum":["a","b"]}}');
  const env = fixture(d, 'x.env', 'PORT=8080\nMODE=a\n');
  const r = run(['--schema', schema, env]);
  assert.deepEqual(r, { code: 0, stdout: '', stderr: '' });
});

test('TS-REQ-no-assignments: empty and comment-only files are judged normally', () => {
  const d = tmp();
  const none = fixture(d, 'none.json', '{"A":{"type":"int"}}');
  const req = fixture(d, 'req.json', '{"A":{"required":true}}');
  const empty = fixture(d, 'empty.env', '');
  const comments = fixture(d, 'comments.env', '# a comment\n\n   # another\n');
  for (const env of [empty, comments]) {
    assert.deepEqual(run(['--schema', none, env]), { code: 0, stdout: '', stderr: '' });
    assert.deepEqual(run(['--schema', req, env]), { code: 1, stdout: `${env}: A: required key is missing\n`, stderr: '' });
  }
});

test('TS-NOGO-01: no interpolation', () => {
  const d = tmp();
  const schema = fixture(d, 's.json', '{"A":{"enum":["${B}"]}}');
  const env = fixture(d, 'x.env', 'A=${B}\n');
  assert.deepEqual(run(['--schema', schema, env]), { code: 0, stdout: '', stderr: '' });
});

test('TS-NOGO-02: bin/ and src/ write no file, set no env, use no network', () => {
  const banned = [/writeFile/, /appendFile/, /process\.env\s*(\[[^\]]*\]|\.\w+)\s*=(?!=)/, /node:net/, /node:http/, /node:https/, /fetch\(/];
  const files = ['bin', 'src'].flatMap((dir) =>
    readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.mjs')).map((f) => join(ROOT, dir, f)),
  );
  assert.ok(files.length >= 3);
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const re of banned) assert.doesNotMatch(src, re, `${file} matches ${re}`);
  }
});
