'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../../src/commands/list.js');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todo-list-test-'));
}

function writeStore(dir, data) {
  fs.writeFileSync(path.join(dir, '.todo.json'), JSON.stringify(data));
}

function captureStreams() {
  const out = [];
  const err = [];
  return {
    stdout: { write: (s) => out.push(s) },
    stderr: { write: (s) => err.push(s) },
    out,
    err,
  };
}

test('lists two items with correct 1-based indices and done markers, exit code 0', async () => {
  const dir = makeTmpDir();
  writeStore(dir, {
    nextId: 3,
    items: [
      { id: 1, text: 'first', done: false },
      { id: 2, text: 'second', done: true },
    ],
  });
  const { stdout, stderr, out, err } = captureStreams();

  const code = await run([], { cwd: dir, stdout, stderr });

  assert.equal(code, 0);
  assert.equal(err.length, 0);
  assert.equal(out.length, 2);
  assert.equal(out[0], '[1] [ ] first\n');
  assert.equal(out[1], '[2] [x] second\n');
});

test('missing store file prints explicit "no todos yet" message, exit code 0', async () => {
  const dir = makeTmpDir();
  const { stdout, stderr, out, err } = captureStreams();

  const code = await run([], { cwd: dir, stdout, stderr });

  assert.equal(code, 0);
  assert.equal(err.length, 0);
  assert.equal(out.length, 1);
  assert.match(out[0], /no todos yet/);
  assert.notEqual(out[0].trim(), '');
});

test('empty items array prints explicit "no todos yet" message, exit code 0', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 1, items: [] });
  const { stdout, stderr, out, err } = captureStreams();

  const code = await run([], { cwd: dir, stdout, stderr });

  assert.equal(code, 0);
  assert.equal(err.length, 0);
  assert.equal(out.length, 1);
  assert.match(out[0], /no todos yet/);
});

test('corrupted store file is rejected with STORE_CORRUPTED, no stack trace leaked to stdout, exit code 1', async () => {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, '.todo.json'), 'not json {{{');
  const { stdout, stderr, out, err } = captureStreams();

  const code = await run([], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.equal(out.length, 0);
  assert.equal(err.length, 1);
  assert.match(err[0], /store file is corrupted/);
  assert.doesNotMatch(err[0], /at Object|\.js:\d+/);
});

test('wrong-shape store file is rejected with STORE_CORRUPTED, exit code 1', async () => {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, '.todo.json'), JSON.stringify({ foo: 'bar' }));
  const { stdout, stderr, out, err } = captureStreams();

  const code = await run([], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.equal(out.length, 0);
  assert.match(err[0], /store file is corrupted/);
});

test('stdout contains no ANSI escape codes', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 2, items: [{ id: 1, text: 'a', done: false }] });
  const { stdout, stderr, out } = captureStreams();

  await run([], { cwd: dir, stdout, stderr });

  // eslint-disable-next-line no-control-regex
  assert.doesNotMatch(out[0], /\x1b\[/);
});
