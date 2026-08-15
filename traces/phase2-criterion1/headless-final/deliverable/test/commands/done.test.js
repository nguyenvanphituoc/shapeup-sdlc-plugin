'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../../src/commands/done.js');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todo-done-test-'));
}

function writeStore(dir, data) {
  fs.writeFileSync(path.join(dir, '.todo.json'), JSON.stringify(data));
}

function readStore(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.todo.json'), 'utf8'));
}

function storeExists(dir) {
  return fs.existsSync(path.join(dir, '.todo.json'));
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

test('valid index marks the item done, saves, prints confirmation, exit code 0', async () => {
  const dir = makeTmpDir();
  writeStore(dir, {
    nextId: 3,
    items: [
      { id: 1, text: 'first', done: false },
      { id: 2, text: 'second', done: false },
    ],
  });
  const { stdout, stderr, out, err } = captureStreams();

  const code = await run(['1'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0);
  const saved = readStore(dir);
  assert.equal(saved.items[0].done, true);
  assert.equal(saved.items[1].done, false);
  assert.equal(err.length, 0);
  assert.match(out[0], /first/);
});

test('n = 0 is rejected as INVALID_INDEX, no store write', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 2, items: [{ id: 1, text: 'a', done: false }] });
  const before = readStore(dir);
  const { stdout, stderr, err } = captureStreams();

  const code = await run(['0'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /not a valid index/);
  assert.deepEqual(readStore(dir), before);
});

test('n = list.length is accepted (last item)', async () => {
  const dir = makeTmpDir();
  writeStore(dir, {
    nextId: 3,
    items: [
      { id: 1, text: 'a', done: false },
      { id: 2, text: 'b', done: false },
    ],
  });
  const { stdout, stderr } = captureStreams();

  const code = await run(['2'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0);
  const saved = readStore(dir);
  assert.equal(saved.items[1].done, true);
  assert.equal(saved.items[0].done, false);
});

test('n = list.length + 1 is rejected as INDEX_OUT_OF_RANGE, no store write', async () => {
  const dir = makeTmpDir();
  writeStore(dir, {
    nextId: 2,
    items: [{ id: 1, text: 'a', done: false }],
  });
  const before = readStore(dir);
  const { stdout, stderr, err } = captureStreams();

  const code = await run(['2'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /no item at index 2/);
  assert.deepEqual(readStore(dir), before);
});

test('any positive n on an empty list is rejected as INDEX_OUT_OF_RANGE', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 1, items: [] });
  const { stdout, stderr, err } = captureStreams();

  const code = await run(['1'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /no item at index 1/);
});

test('n = "abc" is rejected as INVALID_INDEX, no store write', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 2, items: [{ id: 1, text: 'a', done: false }] });
  const before = readStore(dir);
  const { stdout, stderr, err } = captureStreams();

  const code = await run(['abc'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /not a valid index/);
  assert.deepEqual(readStore(dir), before);
});

test('n = "1.5" is rejected as INVALID_INDEX, no store write', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 2, items: [{ id: 1, text: 'a', done: false }] });
  const before = readStore(dir);
  const { stdout, stderr, err } = captureStreams();

  const code = await run(['1.5'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /not a valid index/);
  assert.deepEqual(readStore(dir), before);
});

test('missing index (no argv) is rejected, no store write', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 2, items: [{ id: 1, text: 'a', done: false }] });
  const before = readStore(dir);
  const { stdout, stderr, err } = captureStreams();

  const code = await run([], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /index is required/);
  assert.deepEqual(readStore(dir), before);
});

test('missing store file behaves as an empty list -> INDEX_OUT_OF_RANGE, no crash', async () => {
  const dir = makeTmpDir();
  const { stdout, stderr, err } = captureStreams();

  const code = await run(['1'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /no item at index 1/);
  assert.equal(storeExists(dir), false);
});

test('corrupted store file is rejected with STORE_CORRUPTED, no stack trace leaked to stdout', async () => {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, '.todo.json'), 'not json {{{');
  const { stdout, stderr, err, out } = captureStreams();

  const code = await run(['1'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /store file is corrupted/);
  assert.equal(out.length, 0);
});

test('re-running done on an already-done item is idempotent (no error)', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 2, items: [{ id: 1, text: 'a', done: false }] });
  const s1 = captureStreams();
  await run(['1'], { cwd: dir, stdout: s1.stdout, stderr: s1.stderr });

  const s2 = captureStreams();
  const code = await run(['1'], { cwd: dir, stdout: s2.stdout, stderr: s2.stderr });

  assert.equal(code, 0);
  assert.equal(s2.err.length, 0);
  const saved = readStore(dir);
  assert.equal(saved.items[0].done, true);
});
