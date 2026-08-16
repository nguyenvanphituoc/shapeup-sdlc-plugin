'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BIN_PATH = path.join(__dirname, '..', '..', 'bin', 'todo.js');

function runCli(args, home) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
}

function tempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-add-test-'));
}

function storePath(home) {
  return path.join(home, '.todo.json');
}

test('add on empty/missing store exits 0 and prints Added: "1) buy milk"', () => {
  const home = tempHome();
  const result = runCli(['add', 'buy milk'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Added: "1\) buy milk"/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [{ text: 'buy milk', done: false }]);
});

test('a second add appends, resulting in 2 items in original order', () => {
  const home = tempHome();
  runCli(['add', 'buy milk'], home);
  const second = runCli(['add', 'walk dog'], home);
  assert.equal(second.status, 0);
  assert.match(second.stdout, /Added: "2\) walk dog"/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [
    { text: 'buy milk', done: false },
    { text: 'walk dog', done: false },
  ]);
});

test('add with no text exits 1, prints E_MISSING_TEXT message to stderr, no store file created', () => {
  const home = tempHome();
  const result = runCli(['add'], home);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_MISSING_TEXT/);
  assert.equal(fs.existsSync(storePath(home)), false);
});

test('add with whitespace-only text is treated as missing text', () => {
  const home = tempHome();
  const result = runCli(['add', '   '], home);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_MISSING_TEXT/);
  assert.equal(fs.existsSync(storePath(home)), false);
});

test('add reports a clean error (no stack trace) when the store cannot be written', { skip: process.platform === 'win32' }, () => {
  const home = tempHome();
  runCli(['add', 'seed'], home);
  fs.chmodSync(storePath(home), 0o444);
  fs.chmodSync(home, 0o555);
  try {
    const result = runCli(['add', 'second'], home);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /^Error: could not save todo store: /);
    assert.equal(result.stderr.includes('    at '), false);
  } finally {
    fs.chmodSync(home, 0o755);
    fs.chmodSync(storePath(home), 0o644);
  }
});

test('text is stored trimmed, interior whitespace preserved', () => {
  const home = tempHome();
  const result = runCli(['add', '  buy   milk  '], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Added: "1\) buy   milk"/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [{ text: 'buy   milk', done: false }]);
});
