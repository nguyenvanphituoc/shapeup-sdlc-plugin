import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/envlint.mjs', import.meta.url));

function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'envlint-cli-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

function run(args, cwd) {
  return spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
}

const FINDINGS = { 's.json': '{"A":{"type":"int"},"B":{"required":true}}', 'app.env': 'A=x\nGARBAGE\n' };

test('REQ-21: shebang present and node --check passes', () => {
  assert.ok(readFileSync(BIN, 'utf8').startsWith('#!/usr/bin/env node\n'));
  const r = spawnSync(process.execPath, ['--check', BIN], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('TS-ERR-FINDINGS: one stdout line per problem/finding, exit 1', (t) => {
  const dir = fixture(FINDINGS);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = run(['--schema', 's.json', 'app.env'], dir);
  assert.equal(r.status, 1);
  const lines = r.stdout.trimEnd().split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^app\.env:1: A: /);
  assert.match(lines[1], /^app\.env:2: /);
  assert.match(lines[2], /^app\.env: B: /);
  assert.equal(r.stderr, '');
});

test('TS-REQ-clean: exit 0 with empty stdout', (t) => {
  const dir = fixture({ 's.json': '{"A":{"type":"int","required":true}}', 'app.env': 'A=1\n' });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = run(['--schema', 's.json', 'app.env'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
});

test('TS-REQ-schema-position: --schema=x and schema after the env file give the same result', (t) => {
  const dir = fixture(FINDINGS);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const base = run(['--schema', 's.json', 'app.env'], dir);
  for (const args of [['app.env', '--schema=s.json'], ['--schema=s.json', 'app.env'], ['app.env', '--schema', 's.json']]) {
    const r = run(args, dir);
    assert.equal(r.status, base.status, args.join(' '));
    assert.equal(r.stdout, base.stdout, args.join(' '));
  }
});

test('TS-NOGO-01: a .env in the working directory is never read', (t) => {
  const dir = fixture({ '.env': 'A=notint\nGARBAGE\n', 's.json': '{"A":{"type":"int","required":true}}', 'clean.env': 'A=1\n' });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = run(['--schema', 's.json', 'clean.env'], dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.stdout, '');
});

test('TS-ERR-USAGE: usage errors exit 2 with envlint: and usage: on stderr', (t) => {
  const dir = fixture({ 's.json': '{}', 'a.env': '', 'b.env': '' });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const args of [[], ['a.env', '--schema'], ['--schema', 's.json'], ['--schema', 's.json', 'a.env', 'b.env'], ['--bogus', '--schema', 's.json', 'a.env'], ['--schema=', 'a.env']]) {
    const r = run(args, dir);
    assert.equal(r.status, 2, `args: ${JSON.stringify(args)}`);
    assert.match(r.stderr, /^envlint: /, `args: ${JSON.stringify(args)}`);
    assert.match(r.stderr, /usage:/, `args: ${JSON.stringify(args)}`);
    assert.equal(r.stdout, '');
  }
});

test('TS-INV-03: no ANSI escapes, exits with stdin closed', (t) => {
  const dir = fixture(FINDINGS);
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const args of [['--schema', 's.json', 'app.env'], ['--bogus']]) {
    const r = run(args, dir);
    assert.equal(r.error, undefined);
    assert.notEqual(r.signal, 'SIGTERM');
    assert.doesNotMatch(r.stdout + r.stderr, /\x1b\[/);
  }
  assert.doesNotMatch(readFileSync(BIN, 'utf8'), /process\.stdin/);
});

test('TS-INV-03: ESC in an env value, env key or schema key never reaches the output raw', (t) => {
  const dir = fixture({
    's.json': JSON.stringify({ A: { type: 'int' }, '\x1b[32mK': { required: true } }),
    'app.env': 'A=\x1b[31mred\n\x1b[1mB=1\n',
  });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const r = run(['--schema', 's.json', 'app.env'], dir);
  assert.equal(r.status, 1);
  assert.equal(r.stdout.trimEnd().split('\n').length, 3, r.stdout);
  assert.doesNotMatch(r.stdout + r.stderr, /[\x00-\x09\x0b-\x1f\x7f-\x9f]/);
  assert.match(r.stdout, /\\x1b\[31mred/);
});
