'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run } = require('../../src/commands/add.js');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todo-add-test-'));
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

test('add a valid item on an empty/missing store: writes item, confirms, exit code 0', async () => {
  const dir = makeTmpDir();
  const { stdout, stderr, out, err } = captureStreams();

  const code = await run(['Buy', 'milk'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0);
  const saved = readStore(dir);
  assert.equal(saved.items.length, 1);
  assert.equal(saved.items[0].text, 'Buy milk');
  assert.equal(saved.items[0].done, false);
  assert.equal(err.length, 0);
  assert.match(out[0], /Buy milk/);
});

test('add appends to an existing store without disturbing existing items', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 2, items: [{ id: 1, text: 'first', done: false }] });
  const { stdout, stderr, out } = captureStreams();

  const code = await run(['second'], { cwd: dir, stdout, stderr });

  assert.equal(code, 0);
  const saved = readStore(dir);
  assert.equal(saved.items.length, 2);
  assert.equal(saved.items[0].text, 'first');
  assert.equal(saved.items[1].text, 'second');
  assert.equal(saved.items[1].id, 2);
  assert.match(out[0], /second/);
});

test('no text argument is rejected as MISSING_TEXT, no store write', async () => {
  const dir = makeTmpDir();
  const { stdout, stderr, err } = captureStreams();

  const code = await run([], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /text is required/);
  assert.equal(storeExists(dir), false);
});

test('whitespace-only text is rejected as MISSING_TEXT, no store write', async () => {
  const dir = makeTmpDir();
  const { stdout, stderr, err } = captureStreams();

  const code = await run(['   '], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /text is required/);
  assert.equal(storeExists(dir), false);
});

test('whitespace-only text against an existing store leaves it unchanged', async () => {
  const dir = makeTmpDir();
  writeStore(dir, { nextId: 2, items: [{ id: 1, text: 'a', done: false }] });
  const before = readStore(dir);
  const { stdout, stderr, err } = captureStreams();

  const code = await run(['   '], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /text is required/);
  assert.deepEqual(readStore(dir), before);
});

test('corrupted store file is rejected with STORE_CORRUPTED, no stack trace leaked to stdout', async () => {
  const dir = makeTmpDir();
  fs.writeFileSync(path.join(dir, '.todo.json'), 'not json {{{');
  const { stdout, stderr, err, out } = captureStreams();

  const code = await run(['x'], { cwd: dir, stdout, stderr });

  assert.equal(code, 1);
  assert.match(err[0], /store file is corrupted/);
  assert.equal(out.length, 0);
});

test('ids are never reused, even after items are removed from the store', async () => {
  const dir = makeTmpDir();
  const s1 = captureStreams();
  await run(['first'], { cwd: dir, stdout: s1.stdout, stderr: s1.stderr });
  const s2 = captureStreams();
  await run(['second'], { cwd: dir, stdout: s2.stdout, stderr: s2.stderr });

  // simulate removal of item 1, leaving nextId untouched
  const afterRemoval = readStore(dir);
  writeStore(dir, {
    nextId: afterRemoval.nextId,
    items: afterRemoval.items.filter((item) => item.id !== 1),
  });

  const s3 = captureStreams();
  const code = await run(['third'], { cwd: dir, stdout: s3.stdout, stderr: s3.stderr });

  assert.equal(code, 0);
  const saved = readStore(dir);
  const thirdItem = saved.items.find((item) => item.text === 'third');
  assert.notEqual(thirdItem.id, 1);
  assert.equal(saved.items.some((item) => item.id === 1), false);
});
