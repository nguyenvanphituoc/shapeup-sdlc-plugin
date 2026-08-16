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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-list-test-'));
}

function storePath(home) {
  return path.join(home, '.todo.json');
}

test('list on missing store prints "No todos yet." and exits 0', () => {
  const home = tempHome();
  const result = runCli(['list'], home);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'No todos yet.\n');
});

test('list on store containing [] prints "No todos yet." and exits 0, identical to missing store', () => {
  const home = tempHome();
  fs.writeFileSync(storePath(home), '[]');
  const result = runCli(['list'], home);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'No todos yet.\n');
});

test('list with items prints one line per item, 1-based, in store order', () => {
  const home = tempHome();
  fs.writeFileSync(
    storePath(home),
    JSON.stringify([
      { text: 'buy milk', done: false },
      { text: 'write spec', done: true },
    ])
  );
  const result = runCli(['list'], home);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '1) [ ] buy milk\n2) [x] write spec\n');
});

test('list never writes to the store, even for a corrupted store', () => {
  const home = tempHome();
  const corrupted = '{not valid json';
  fs.writeFileSync(storePath(home), corrupted);
  const before = fs.readFileSync(storePath(home), 'utf8');
  const result = runCli(['list'], home);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error:/);
  const after = fs.readFileSync(storePath(home), 'utf8');
  assert.equal(after, before);
});

test('list does not crash when an item is missing the done field, treats it as falsy', () => {
  const home = tempHome();
  fs.writeFileSync(storePath(home), JSON.stringify([{ text: 'no done field' }]));
  const result = runCli(['list'], home);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '1) [ ] no done field\n');
});
