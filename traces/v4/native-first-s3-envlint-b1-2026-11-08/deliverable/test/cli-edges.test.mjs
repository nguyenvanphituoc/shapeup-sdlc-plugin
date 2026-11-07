import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));
const STACK = /^\s+at /m;

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'envlint-edges-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
}

function snapshot(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .map((e) => `${e.name}:${e.isDirectory() ? 'dir' : readFileSync(join(dir, e.name)).toString('base64')}`)
    .sort()
    .join('\n');
}

test('TS-ERR-IO: missing env file or schema exits 2 with cannot read <path>', (t) => {
  const dir = fixture({ 's.json': '{}', 'a.env': 'A=1\n' });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [args, path] of [[['--schema', 's.json', 'nope.env'], 'nope.env'], [['--schema', 'nope.json', 'a.env'], 'nope.json']]) {
    const r = run(args, dir);
    assert.equal(r.status, 2);
    assert.match(r.stderr, new RegExp(`^envlint: cannot read ${path.replace('.', '\\.')}`));
    assert.doesNotMatch(r.stderr, STACK);
  }
});

test('TS-ERR-IO / TS-ERR-SCHEMA: directory, bad JSON, or invalid shape schema exits 2', (t) => {
  const dir = fixture({ 'bad.json': '{not json', 'float.json': '{"A":{"type":"float"}}', 'a.env': 'A=1\n' });
  mkdirSync(join(dir, 'schemadir'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dirRun = run(['--schema', 'schemadir', 'a.env'], dir);
  assert.equal(dirRun.status, 2);
  assert.match(dirRun.stderr, /^envlint: cannot read schemadir/);
  for (const schema of ['bad.json', 'float.json']) {
    const r = run(['--schema', schema, 'a.env'], dir);
    assert.equal(r.status, 2, schema);
    assert.match(r.stderr, new RegExp(`^envlint: invalid schema ${schema.replace('.', '\\.')}`));
    assert.doesNotMatch(r.stderr, STACK);
  }
});

test('TS-REQ-empty-file: empty and comments-only env files', (t) => {
  const dir = fixture({ 'empty.env': '', 'comments.env': '# just a comment\n\n  # another\n', 'opt.json': '{"A":{"type":"int"}}', 'req.json': '{"A":{"required":true}}' });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const env of ['empty.env', 'comments.env']) {
    const ok = run(['--schema', 'opt.json', env], dir);
    assert.equal(ok.status, 0, env);
    assert.equal(ok.stdout, '');
    const missing = run(['--schema', 'req.json', env], dir);
    assert.equal(missing.status, 1, env);
    assert.match(missing.stdout, new RegExp(`^${env.replace('.', '\\.')}: A: `));
  }
});

test('TS-INV-02: binary garbage env file and a null schema never stack-trace', (t) => {
  const dir = fixture({ 'null.json': 'null', 's.json': '{"A":{"type":"int"}}', 'a.env': 'A=1\n' });
  writeFileSync(join(dir, 'garbage.env'), Buffer.from([0, 255, 254, 10, 1, 2, 61, 200, 13, 10, 0x1b, 0x5b]));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const g = run(['--schema', 's.json', 'garbage.env'], dir);
  assert.ok(g.status === 1 || g.status === 2, `status ${g.status}`);
  assert.doesNotMatch(g.stderr, STACK);
  const n = run(['--schema', 'null.json', 'a.env'], dir);
  assert.equal(n.status, 2);
  assert.match(n.stderr, /^envlint: invalid schema null\.json/);
  assert.doesNotMatch(n.stderr, STACK);
});

test('TS-INV-01: the fixture directory is unchanged after every run', (t) => {
  const dir = fixture({ 'clean.json': '{"A":{"type":"int","required":true}}', 'clean.env': 'A=1\n', 'find.json': '{"A":{"type":"int"},"B":{"required":true}}', 'find.env': 'A=x\nGARBAGE\n', 'bad.json': '{not json' });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const before = snapshot(dir);
  for (const [args, status] of [[['--schema', 'clean.json', 'clean.env'], 0], [['--schema', 'find.json', 'find.env'], 1], [['--schema', 'bad.json', 'clean.env'], 2]]) {
    assert.equal(run(args, dir).status, status, args.join(' '));
    assert.equal(snapshot(dir), before, args.join(' '));
  }
});
