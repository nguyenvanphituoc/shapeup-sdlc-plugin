'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BIN_PATH = path.join(__dirname, '..', '..', 'bin', 'todo.js');

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-done-test-'));
}

function storeFile(home) {
  return path.join(home, '.todo.json');
}

function seedStore(home, items) {
  fs.writeFileSync(storeFile(home), JSON.stringify(items));
}

function readStore(home) {
  return JSON.parse(fs.readFileSync(storeFile(home), 'utf8'));
}

function runCli(home, args) {
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
}

test('done 1 on a store with >=1 item marks it done, saves, prints Done, exits 0', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'buy milk', done: false }]);

  const result = runCli(home, ['done', '1']);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'Done: "1) buy milk"');
  assert.deepEqual(readStore(home), [{ text: 'buy milk', done: true }]);
});

test('running done 1 a second time is idempotent: same message, exit 0, no error', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'buy milk', done: false }]);

  runCli(home, ['done', '1']);
  const second = runCli(home, ['done', '1']);

  assert.equal(second.status, 0);
  assert.equal(second.stdout.trim(), 'Done: "1) buy milk"');
  assert.deepEqual(readStore(home), [{ text: 'buy milk', done: true }]);
});

test('done with no index exits 1 with E_MISSING_INDEX to stderr, store unchanged', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'buy milk', done: false }]);

  const result = runCli(home, ['done']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error: missing index/);
  assert.deepEqual(readStore(home), [{ text: 'buy milk', done: false }]);
});

test('done abc exits 1 with E_INVALID_INDEX to stderr, store unchanged', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'buy milk', done: false }]);

  const result = runCli(home, ['done', 'abc']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /is not a valid index/);
  assert.deepEqual(readStore(home), [{ text: 'buy milk', done: false }]);
});

test('done 2.5 and done 3abc are both rejected as E_INVALID_INDEX', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'a', done: false }, { text: 'b', done: false }, { text: 'c', done: false }]);

  const decimal = runCli(home, ['done', '2.5']);
  const trailing = runCli(home, ['done', '3abc']);

  assert.equal(decimal.status, 1);
  assert.match(decimal.stderr, /is not a valid index/);
  assert.equal(trailing.status, 1);
  assert.match(trailing.stderr, /is not a valid index/);
});

test('done "" (empty-string arg) is rejected as E_INVALID_INDEX, never treated as index 0', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'buy milk', done: false }]);

  const result = runCli(home, ['done', '']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /is not a valid index/);
  assert.deepEqual(readStore(home), [{ text: 'buy milk', done: false }]);
});

test('min value (1, with >=1 item): accepted, marks the first item done', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'first', done: false }, { text: 'second', done: false }]);

  const result = runCli(home, ['done', '1']);

  assert.equal(result.status, 0);
  assert.equal(readStore(home)[0].done, true);
  assert.equal(readStore(home)[1].done, false);
});

test('max value (items.length): accepted, marks the last item done', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'first', done: false }, { text: 'second', done: false }]);

  const result = runCli(home, ['done', '2']);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'Done: "2) second"');
  assert.equal(readStore(home)[1].done, true);
  assert.equal(readStore(home)[0].done, false);
});

test('below min (0 or negative) rejected E_INDEX_OUT_OF_RANGE', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'only', done: false }]);

  const zero = runCli(home, ['done', '0']);
  const negative = runCli(home, ['done', '-1']);

  assert.equal(zero.status, 1);
  assert.match(zero.stderr, /no todo at index/);
  assert.equal(negative.status, 1);
  assert.match(negative.stderr, /no todo at index/);
  assert.deepEqual(readStore(home), [{ text: 'only', done: false }]);
});

test('above max (items.length + 1) rejected E_INDEX_OUT_OF_RANGE', () => {
  const home = tmpHome();
  seedStore(home, [{ text: 'only', done: false }]);

  const result = runCli(home, ['done', '2']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no todo at index/);
  assert.deepEqual(readStore(home), [{ text: 'only', done: false }]);
});

test('empty store (done 1 with 0 items) rejected E_INDEX_OUT_OF_RANGE', () => {
  const home = tmpHome();
  seedStore(home, []);

  const result = runCli(home, ['done', '1']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /no todo at index/);
  assert.deepEqual(readStore(home), []);
});

test('corrupted store: done <n> exits 1 with a corrupted-store message, store untouched', () => {
  const home = tmpHome();
  fs.writeFileSync(storeFile(home), 'not valid json,,,');

  const result = runCli(home, ['done', '1']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /corrupt/i);
  assert.equal(fs.readFileSync(storeFile(home), 'utf8'), 'not valid json,,,');
});
