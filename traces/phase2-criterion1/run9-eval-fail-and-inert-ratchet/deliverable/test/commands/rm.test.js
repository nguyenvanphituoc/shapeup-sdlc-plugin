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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-rm-test-'));
}

function storePath(home) {
  return path.join(home, '.todo.json');
}

function seed(home, items) {
  fs.writeFileSync(storePath(home), JSON.stringify(items));
}

test('rm 1 on a store with 1 item removes it, saves, prints, exits 0', () => {
  const home = tempHome();
  runCli(['add', 'buy milk'], home);
  const result = runCli(['rm', '1'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Removed: "1\) buy milk"/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, []);
});

test('rm with no index exits 1 with E_MISSING_INDEX, store unchanged', () => {
  const home = tempHome();
  seed(home, [{ text: 'buy milk', done: false }]);
  const result = runCli(['rm'], home);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_MISSING_INDEX/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [{ text: 'buy milk', done: false }]);
});

test('rm abc exits 1 with E_INVALID_INDEX, store unchanged', () => {
  const home = tempHome();
  seed(home, [{ text: 'buy milk', done: false }]);
  const result = runCli(['rm', 'abc'], home);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_INVALID_INDEX/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [{ text: 'buy milk', done: false }]);
});

test('removing a middle item shifts later items left, leaves others unchanged', () => {
  const home = tempHome();
  seed(home, [
    { text: 'A', done: false },
    { text: 'B', done: true },
    { text: 'C', done: false },
  ]);
  const result = runCli(['rm', '2'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Removed: "2\) B"/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [
    { text: 'A', done: false },
    { text: 'C', done: false },
  ]);
});

test('at min value (1) with >=1 item: accepted, removes the first item', () => {
  const home = tempHome();
  seed(home, [
    { text: 'A', done: false },
    { text: 'B', done: false },
  ]);
  const result = runCli(['rm', '1'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Removed: "1\) A"/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [{ text: 'B', done: false }]);
});

test('at max value (items.length): accepted, removes the last item', () => {
  const home = tempHome();
  seed(home, [
    { text: 'A', done: false },
    { text: 'B', done: false },
  ]);
  const result = runCli(['rm', '2'], home);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Removed: "2\) B"/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [{ text: 'A', done: false }]);
});

test('below min (0) is rejected E_INDEX_OUT_OF_RANGE, store unchanged', () => {
  const home = tempHome();
  seed(home, [{ text: 'A', done: false }]);
  const result = runCli(['rm', '0'], home);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_INDEX_OUT_OF_RANGE/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [{ text: 'A', done: false }]);
});

test('below min (negative) is rejected E_INDEX_OUT_OF_RANGE, store unchanged', () => {
  const home = tempHome();
  seed(home, [{ text: 'A', done: false }]);
  const result = runCli(['rm', '-1'], home);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_INDEX_OUT_OF_RANGE/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [{ text: 'A', done: false }]);
});

test('above max (items.length + 1) is rejected E_INDEX_OUT_OF_RANGE, store unchanged', () => {
  const home = tempHome();
  seed(home, [{ text: 'A', done: false }]);
  const result = runCli(['rm', '2'], home);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_INDEX_OUT_OF_RANGE/);
  const items = JSON.parse(fs.readFileSync(storePath(home), 'utf8'));
  assert.deepEqual(items, [{ text: 'A', done: false }]);
});

test('empty store: rm 1 is rejected E_INDEX_OUT_OF_RANGE, no file created', () => {
  const home = tempHome();
  const result = runCli(['rm', '1'], home);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /E_INDEX_OUT_OF_RANGE/);
  assert.equal(fs.existsSync(storePath(home)), false);
});
