'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'bin', 'todo.js');

function freshHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-integration-test-'));
}

function storeFile(home) {
  return path.join(home, '.todo.json');
}

function run(home, args) {
  return spawnSync(process.execPath, [BIN, ...args], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });
}

test('Happy-path round-trip across all four commands', () => {
  const home = freshHome();

  let res = run(home, ['add', 'buy milk']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /1\) buy milk/);

  res = run(home, ['add', 'write spec']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /2\) write spec/);

  res = run(home, ['list']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /1\) \[ \] buy milk/);
  assert.match(res.stdout, /2\) \[ \] write spec/);

  res = run(home, ['done', '1']);
  assert.equal(res.status, 0);

  res = run(home, ['list']);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /1\) \[x\] buy milk/);
  assert.match(res.stdout, /2\) \[ \] write spec/);

  res = run(home, ['rm', '2']);
  assert.equal(res.status, 0);

  res = run(home, ['list']);
  assert.equal(res.status, 0);
  const lines = res.stdout.trim().split('\n');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /1\) \[x\] buy milk/);
});

test('Empty list is not an error', () => {
  const home = freshHome();

  const res = run(home, ['list']);
  assert.equal(res.status, 0);
  assert.equal(res.stdout.trim(), 'No todos yet.');
});

test('Bad index is rejected without crashing', () => {
  const home = freshHome();
  run(home, ['add', 'only item']);
  const before = fs.readFileSync(storeFile(home), 'utf8');

  for (const args of [['done', '99'], ['done', 'abc'], ['done', '0'], ['rm']]) {
    const res = run(home, args);
    assert.equal(res.status, 1, `expected exit 1 for ${args.join(' ')}`);
    assert.ok(res.stderr.trim().length > 0, `expected stderr for ${args.join(' ')}`);
    assert.doesNotMatch(res.stderr, /at Object\.<anonymous>/);
    assert.doesNotMatch(res.stderr, /\.js:\d+:\d+/);
    const after = fs.readFileSync(storeFile(home), 'utf8');
    assert.equal(after, before, `store must be unchanged after ${args.join(' ')}`);
  }
});

test('Corrupted store fails clean, not with a stack trace', () => {
  const home = freshHome();
  const corrupted = '{not valid json,,,';
  fs.writeFileSync(storeFile(home), corrupted);

  for (const args of [['list'], ['add', 'x'], ['done', '1'], ['rm', '1']]) {
    const res = run(home, args);
    assert.equal(res.status, 1, `expected exit 1 for ${args.join(' ')}`);
    assert.match(res.stderr, /corrupt/i, `expected stderr to name the store corrupted for ${args.join(' ')}`);
    assert.doesNotMatch(res.stderr, /SyntaxError/);
    assert.doesNotMatch(res.stderr, /at Object\.<anonymous>/);
    const after = fs.readFileSync(storeFile(home), 'utf8');
    assert.equal(after, corrupted, `corrupted file must be left byte-for-byte unchanged after ${args.join(' ')}`);
  }
});
