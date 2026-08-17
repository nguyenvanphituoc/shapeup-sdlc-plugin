import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));

function run(args) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
}

function fixture(name, content) {
  const dir = mkdtempSync(join(tmpdir(), 'envlint-'));
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

test('clean env file against its schema -> exit 0, ok summary', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', 'PORT=8080\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'ok: 1 keys checked\n');
  assert.equal(result.stderr, '');
});

test('env file missing a required key -> exit 1, finding at line 0', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', '# nothing here\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, new RegExp(`${env}:0: PORT: PORT is required but missing`));
  assert.match(result.stdout, /1 problem\(s\)\n$/);
});

test('unreadable env file -> exit 2, tool error, empty stdout', () => {
  const schema = fixture('schema.json', JSON.stringify({}));
  const result = run(['--schema', schema, '/no/such/file']);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Error: cannot read env file: /no/such/file\n');
});

test('missing --schema -> exit 2, stderr Error prefix, single line', () => {
  const env = fixture('.env', 'PORT=8080\n');
  const result = run([env]);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Error: /);
  assert.equal(result.stderr.split('\n').filter(Boolean).length, 1);
});

test('unreadable schema file -> exit 2, specific stderr message', () => {
  const env = fixture('.env', 'PORT=8080\n');
  const result = run(['--schema', '/no/such/schema.json', env]);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'Error: cannot read schema file: /no/such/schema.json\n');
});

test('schema file not valid JSON -> exit 2, specific stderr message', () => {
  const schema = fixture('schema.json', '{ not valid json');
  const env = fixture('.env', 'PORT=8080\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `Error: schema is not valid JSON: ${schema}\n`);
});

test('>=1 finding -> stdout one line per finding then N problem(s), exit 1', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', 'PORT=notanint\nnot an assignment at all\n');
  const result = run(['--schema', schema, env]);
  assert.equal(result.status, 1);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], `${env}:2: not an assignment at all: not a KEY=VALUE assignment`);
  assert.equal(lines[1], `${env}:1: PORT: PORT is invalid`);
  assert.equal(lines[2], '2 problem(s)');
});

test('--json on the clean branch -> exact JSON doc, exit 0', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', 'PORT=8080\n');
  const result = run(['--schema', schema, '--json', env]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '{"ok":true,"findings":[],"checked":1}\n');
});

test('--json on the findings branch -> exact JSON doc, exit 1', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', '# nothing here\n');
  const result = run(['--schema', schema, '--json', env]);
  assert.equal(result.status, 1);
  assert.equal(
    result.stdout,
    '{"ok":false,"findings":[{"line":0,"key":"PORT","message":"PORT is required but missing"}],"checked":1}\n'
  );
});

test('--json never changes exit code or which branch is taken', () => {
  const schema = fixture('schema.json', JSON.stringify({ PORT: { required: true, type: 'int' } }));
  const env = fixture('.env', 'PORT=8080\n');
  const withoutJson = run(['--schema', schema, env]);
  const withJson = run(['--schema', schema, '--json', env]);
  assert.equal(withoutJson.status, withJson.status);
});

test('no exit-2 path prints a raw stack trace or anything to stdout', () => {
  const result = run(['/nonexistent/schema.json']);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.doesNotMatch(result.stderr, /at Object|at Module|\.mjs:\d+:\d+/);
});
