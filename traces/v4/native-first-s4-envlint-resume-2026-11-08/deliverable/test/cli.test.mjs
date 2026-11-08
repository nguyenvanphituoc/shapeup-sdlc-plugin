// End-to-end probes for UC-03 (shapeup/envlint/spec/usecases/UC-03-lint-env-file.md, Test Surface).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));

function fixture(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'envlint-'));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content);
  return dir;
}

function run(args, cwd) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', input: '', timeout: 10000 });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function assertNoStack(r) {
  assert.doesNotMatch(r.stderr, /^\s+at /m);
  assert.doesNotMatch(r.stderr, /^\w*Error:/m);
}

function assertUsageError(r) {
  assert.equal(r.code, 2);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /^envlint: /);
  assert.match(r.stderr, /usage: envlint --schema <schema\.json> <envfile>/);
  assertNoStack(r);
}

test('TS-INV-01: no error case or binary garbage produces a stack trace', () => {
  const garbage = Buffer.from(Array.from({ length: 512 }, (_, i) => (i * 37 + 11) % 256));
  const dir = fixture({ 's.json': '{"A":{"required":true}}', 'bad.json': '{not json', 'inv.json': '{"A":{"type":"float"}}' });
  writeFileSync(join(dir, 'garbage.env'), garbage);
  mkdirSync(join(dir, 'adir'));
  const cases = [
    [],
    ['--schema', 's.json'],
    ['--schema', 's.json', 'a', 'b'],
    ['--color'],
    ['--schema', 's.json', 'nope.env'],
    ['--schema', 's.json', 'adir'],
    ['--schema', 'nope.json', 'garbage.env'],
    ['--schema', 'bad.json', 'garbage.env'],
    ['--schema', 'inv.json', 'garbage.env'],
    ['--schema', 's.json', 'garbage.env'],
  ];
  for (const args of cases) {
    const r = run(args, dir);
    assertNoStack(r);
    if (r.code === 2) {
      assert.equal(r.stdout, '');
      assert.match(r.stderr, /^envlint: [^\n]*\n(usage: [^\n]*\n)?$/, `args ${args.join(' ')}`);
    } else {
      assert.equal(r.code, 1, `args ${args.join(' ')}`);
      assert.equal(r.stderr, '');
    }
  }
});

test('TS-INV-02: mixed violations print in order and exit 1', () => {
  const dir = fixture({
    'e.env': 'HOST=x\nPORT=abc\n',
    's.json': '{"PORT":{"type":"int"},"TOKEN":{"required":true}}',
  });
  const r = run(['--schema', 's.json', 'e.env'], dir);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
  assert.equal(r.stdout, 'e.env:2: PORT: expected int, got "abc"\ne.env: TOKEN: required key is missing\n');
});

test('TS-INV-02: parse problem precedes a finding on a later line and line-less findings come last', () => {
  const dir = fixture({
    'e.env': 'A=1\nnoequals\nB=x\n',
    's.json': '{"Z":{"required":true},"B":{"type":"int"},"Y":{"required":true}}',
  });
  const r = run(['--schema', 's.json', 'e.env'], dir);
  assert.equal(r.code, 1);
  assert.equal(
    r.stdout,
    "e.env:2: parse error: missing '='\ne.env:3: B: expected int, got \"x\"\ne.env: Z: required key is missing\ne.env: Y: required key is missing\n",
  );
});

test('TS-INV-03: env file with no assignments exits 0 with schema {} and 1 with a required key', () => {
  const dir = fixture({ 'e.env': '# only a comment\n\n   \n# another\n', 'empty.json': '{}', 'req.json': '{"A":{"required":true}}' });
  const clean = run(['--schema', 'empty.json', 'e.env'], dir);
  assert.equal(clean.code, 0);
  assert.equal(clean.stdout, '');
  assert.equal(clean.stderr, '');
  const missing = run(['--schema', 'req.json', 'e.env'], dir);
  assert.equal(missing.code, 1);
  assert.equal(missing.stdout, 'e.env: A: required key is missing\n');
});

test('TS-INV-04: temp cwd listing is unchanged after runs and no .env is created', () => {
  const dir = fixture({ 'e.env': 'PORT=abc\n', 's.json': '{"PORT":{"type":"int"}}' });
  const before = readdirSync(dir).sort();
  run(['--schema', 's.json', 'e.env'], dir);
  run(['--schema', 's.json'], dir);
  run([], dir);
  const after = readdirSync(dir).sort();
  assert.deepEqual(after, before);
  assert.ok(!after.includes('.env'));
});

test('TS-INV-05: no ANSI escape in output and stdin is not awaited', () => {
  const dir = fixture({ 'e.env': 'PORT=abc\nbad\n', 's.json': '{"PORT":{"type":"int"},"T":{"required":true}}' });
  // stdin left open (pipe never closed): the process must still exit on its own.
  const r = spawnSync(process.execPath, [BIN, '--schema', 's.json', 'e.env'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000 });
  assert.equal(r.error, undefined);
  assert.equal(r.status, 1);
  assert.ok(!r.stdout.includes('\x1b'));
  assert.ok(!r.stderr.includes('\x1b'));
  const e = run(['--color'], dir);
  assert.ok(!e.stderr.includes('\x1b'));
});

test('TS-INV-05: an ESC-valued fixture leaks no 0x1b byte into stdout or stderr', () => {
  const dir = fixture({ 'esc.env': 'PORT=\x1b[31mred\n', 's.json': '{"PORT":{"type":"int"}}' });
  const r = run(['--schema', 's.json', 'esc.env'], dir);
  assert.equal(r.code, 1);
  assert.equal(r.stderr, '');
  assert.ok(!r.stdout.includes('\x1b'));
  assert.equal(r.stdout, 'esc.env:1: PORT: expected int, got "\\x1b[31mred"\n');
  writeFileSync(join(dir, 's\x1b[31m.json'), '{not json');
  const e = run(['--schema', 's\x1b[31m.json', 'esc.env'], dir);
  assert.equal(e.code, 2);
  assert.ok(!e.stdout.includes('\x1b'));
  assert.ok(!e.stderr.includes('\x1b'));
});

test('TS-ERR-USAGE: no args, --schema alone, two positionals, unknown flag', () => {
  const dir = fixture({ 's.json': '{}', 'a.env': '', 'b.env': '' });
  assertUsageError(run([], dir));
  const noEnv = run(['--schema', 's.json'], dir);
  assertUsageError(noEnv);
  assert.match(noEnv.stderr, /^envlint: expected exactly one env file\n/);
  assertUsageError(run(['--schema', 's.json', 'a.env', 'b.env'], dir));
  assertUsageError(run(['--color'], dir));
  const noSchema = run(['a.env'], dir);
  assertUsageError(noSchema);
  assert.match(noSchema.stderr, /^envlint: missing --schema\n/);
  assertUsageError(run(['--schema', 's.json', '--schema', 's.json', 'a.env'], dir));
});

test('TS-ERR-USAGE: --schema=<path> form is accepted', () => {
  const dir = fixture({ 's.json': '{}', 'a.env': 'A=1\n' });
  const r = run(['--schema=s.json', 'a.env'], dir);
  assert.equal(r.code, 0);
  assert.equal(r.stderr, '');
});

test('TS-ERR-ENV_NOT_FOUND: missing env path exits 2 naming path and ENOENT', () => {
  const dir = fixture({ 's.json': '{}' });
  const r = run(['--schema', 's.json', 'missing.env'], dir);
  assert.equal(r.code, 2);
  assert.equal(r.stderr, 'envlint: cannot read env file missing.env: ENOENT\n');
  assertNoStack(r);
});

test('TS-ERR-ENV_UNREADABLE: env path is a directory', () => {
  const dir = fixture({ 's.json': '{}' });
  mkdirSync(join(dir, 'adir'));
  const r = run(['--schema', 's.json', 'adir'], dir);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /^envlint: cannot read env file adir: \w+\n$/);
  assertNoStack(r);
});

test('TS-ERR-SCHEMA_NOT_FOUND: missing schema path', () => {
  const dir = fixture({ 'e.env': 'A=1\n' });
  const r = run(['--schema', 'nope.json', 'e.env'], dir);
  assert.equal(r.code, 2);
  assert.equal(r.stderr, 'envlint: cannot read schema file nope.json: ENOENT\n');
});

test('TS-ERR-SCHEMA_INVALID_JSON: schema {not json', () => {
  const dir = fixture({ 'e.env': 'A=1\n', 'bad.json': '{not json' });
  const r = run(['--schema', 'bad.json', 'e.env'], dir);
  assert.equal(r.code, 2);
  assert.equal(r.stderr, 'envlint: invalid schema bad.json: not valid JSON\n');
});

test('TS-ERR-SCHEMA_INVALID: schema with type float', () => {
  const dir = fixture({ 'e.env': 'A=1\n', 'inv.json': '{"A":{"type":"float"}}' });
  const r = run(['--schema', 'inv.json', 'e.env'], dir);
  assert.equal(r.code, 2);
  assert.equal(r.stderr, 'envlint: invalid schema inv.json: A: "type" must be one of string, int, bool, url\n');
});

test('TS-ERR-FINDINGS: parse problem on line 3', () => {
  const dir = fixture({ 'e.env': 'A=1\nB=2\nnoequals\n', 's.json': '{}' });
  const r = run(['--schema', 's.json', 'e.env'], dir);
  assert.equal(r.code, 1);
  assert.equal(r.stdout, "e.env:3: parse error: missing '='\n");
});

test('TS-NOGO-01: no env positional in a cwd holding .env is a usage error and .env is not read', () => {
  const dir = fixture({ '.env': 'PORT=abc\nbroken\n', 's.json': '{"PORT":{"type":"int"},"T":{"required":true}}' });
  const r = run(['--schema', 's.json'], dir);
  assertUsageError(r);
  assert.equal(r.stdout, '');
  assert.doesNotMatch(r.stderr, /PORT|parse error|required key/);
});

test('TS-NOGO-02: ${HOME} is compared literally', () => {
  const dir = fixture({ 'e.env': 'A=${HOME}\n', 's.json': '{"A":{"enum":["${HOME}"]}}' });
  const r = run(['--schema', 's.json', 'e.env'], dir);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, '');
  assert.equal(r.stderr, '');
});
