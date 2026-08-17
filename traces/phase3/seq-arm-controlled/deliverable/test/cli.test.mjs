import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));

function run(args) {
  return spawnSync('node', [BIN, ...args], { encoding: 'utf8' });
}

function tmpFile(name, contents) {
  const dir = mkdtempSync(join(tmpdir(), 'envlint-'));
  const path = join(dir, name);
  writeFileSync(path, contents);
  return path;
}

const SIMPLE_SCHEMA = { PORT: { required: true, type: 'int' } };

test('missing --schema -> exit 2, stderr Error prefix, single line', () => {
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const result = run([envFile]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: /);
  assert.equal(result.stderr.trim().split('\n').length, 1);
  assert.equal(result.stdout, '');
});

test('unreadable schema file -> exit 2, specific stderr message', () => {
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const schemaPath = '/no/such/schema.json';
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, `Error: cannot read schema file: ${schemaPath}\n`);
  assert.equal(result.stdout, '');
});

test('schema file not valid JSON -> exit 2, specific stderr message', () => {
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const schemaPath = tmpFile('schema.json', 'not json');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, `Error: schema is not valid JSON: ${schemaPath}\n`);
  assert.equal(result.stdout, '');
});

test('unreadable env file -> exit 2, tool error, empty stdout', () => {
  const schemaPath = tmpFile('schema.json', JSON.stringify(SIMPLE_SCHEMA));
  const envPath = '/no/such/file';
  const result = run(['--schema', schemaPath, envPath]);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, `Error: cannot read env file: ${envPath}\n`);
  assert.equal(result.stdout, '');
});

test('clean env file against its schema -> exit 0, ok summary', () => {
  const schemaPath = tmpFile('schema.json', JSON.stringify(SIMPLE_SCHEMA));
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'ok: 1 keys checked\n');
});

test('>=1 finding -> stdout one line per finding then N problem(s), exit 1', () => {
  const schemaPath = tmpFile('schema.json', JSON.stringify(SIMPLE_SCHEMA));
  const envFile = tmpFile('.env', '# no PORT here\n');
  const result = run(['--schema', schemaPath, envFile]);
  assert.equal(result.status, 1);
  const lines = result.stdout.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], `${envFile}:0: PORT: PORT is required`);
  assert.equal(lines[1], '1 problem(s)');
});

test('--json on the clean branch -> exact JSON doc, exit 0', () => {
  const schemaPath = tmpFile('schema.json', JSON.stringify(SIMPLE_SCHEMA));
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const result = run(['--schema', schemaPath, '--json', envFile]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, `${JSON.stringify({ ok: true, findings: [], checked: 1 })}\n`);
});

test('--json on the findings branch -> exact JSON doc, exit 1', () => {
  const schemaPath = tmpFile('schema.json', JSON.stringify(SIMPLE_SCHEMA));
  const envFile = tmpFile('.env', '# no PORT here\n');
  const result = run(['--schema', schemaPath, '--json', envFile]);
  assert.equal(result.status, 1);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.checked, 1);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].key, 'PORT');
});

test('--json never changes exit code or which branch is taken', () => {
  const schemaPath = tmpFile('schema.json', JSON.stringify(SIMPLE_SCHEMA));
  const envFile = tmpFile('.env', 'PORT=3000\n');
  const plain = run(['--schema', schemaPath, envFile]);
  const withJson = run(['--schema', schemaPath, '--json', envFile]);
  assert.equal(plain.status, withJson.status);

  const badEnvFile = tmpFile('.env', '# no PORT here\n');
  const plainBad = run(['--schema', schemaPath, badEnvFile]);
  const withJsonBad = run(['--schema', schemaPath, '--json', badEnvFile]);
  assert.equal(plainBad.status, withJsonBad.status);
});

test('no exit-2 path prints a raw stack trace or anything to stdout', () => {
  const result = run(['--schema', '/no/such/schema.json', '/no/such/env']);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.doesNotMatch(result.stderr, /at .*\.mjs:\d+/);
});
