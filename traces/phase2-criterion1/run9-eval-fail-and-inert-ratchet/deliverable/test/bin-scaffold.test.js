'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BIN_PATH = path.join(__dirname, '..', 'bin', 'todo.js');

function runCli(args) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-bin-test-'));
  return spawnSync(process.execPath, [BIN_PATH, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: tmpHome },
  });
}

test('node bin/todo.js with no subcommand prints usage to stderr and exits 1', () => {
  const result = runCli([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: todo <add\|list\|done\|rm>/);
});

test('node bin/todo.js frobnicate (unknown command) prints error and exits 1', () => {
  const result = runCli(['frobnicate']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error: unknown command "frobnicate"/);
});

test('node bin/todo.js add reaches its stub branch without throwing', () => {
  const result = runCli(['add']);
  assert.notEqual(result.signal, 'SIGABRT');
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /Error: unknown command/);
});

test('node bin/todo.js list reaches its stub branch without throwing', () => {
  // `list` on an empty store is a real success path (TASK-004), not the TASK-001
  // stub baseline the other commands still are — exits 0, prints "No todos yet.".
  const result = runCli(['list']);
  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, /Error: unknown command/);
});

test('node bin/todo.js done reaches its stub branch without throwing', () => {
  const result = runCli(['done']);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /Error: unknown command/);
});

test('node bin/todo.js rm reaches its stub branch without throwing', () => {
  const result = runCli(['rm']);
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /Error: unknown command/);
});

test('bin/todo.js has a #!/usr/bin/env node shebang and is executable', () => {
  const contents = fs.readFileSync(BIN_PATH, 'utf8');
  assert.equal(contents.split('\n')[0], '#!/usr/bin/env node');
  const mode = fs.statSync(BIN_PATH).mode;
  assert.ok(mode & 0o111, 'bin/todo.js should have at least one executable bit set');
});
