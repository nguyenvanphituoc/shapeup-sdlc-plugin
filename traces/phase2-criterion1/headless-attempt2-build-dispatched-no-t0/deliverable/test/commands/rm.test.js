'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const rm = require('../../src/commands/rm');

const STORE_FILE = '.todo.json';

function withTempCwd(fn) {
  const prevCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-rm-'));
  process.chdir(tmpDir);
  try {
    return fn(tmpDir);
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function writeStore(list) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(list));
}

function readStore() {
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function storeExists() {
  return fs.existsSync(STORE_FILE);
}

function captureConsole(fn) {
  const logs = [];
  const errors = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (msg) => logs.push(msg);
  console.error = (msg) => errors.push(msg);
  try {
    const code = fn();
    return { code, logs, errors };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

test('removes a valid item, saves store, exit 0', () => {
  withTempCwd(() => {
    writeStore({
      nextId: 3,
      items: [
        { id: 1, text: 'Buy milk', done: false },
        { id: 2, text: 'Write pitch', done: false },
      ],
    });

    const { code, logs } = captureConsole(() => rm(['1']));

    assert.equal(code, 0);
    assert.equal(logs.length, 1);
    const saved = readStore();
    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0].id, 2);
  });
});

test('nextId is unchanged (never decremented) after removal', () => {
  withTempCwd(() => {
    writeStore({
      nextId: 3,
      items: [
        { id: 1, text: 'Buy milk', done: false },
        { id: 2, text: 'Write pitch', done: false },
      ],
    });

    captureConsole(() => rm(['1']));

    const saved = readStore();
    assert.equal(saved.nextId, 3);
  });
});

test('n = 0 is rejected as INVALID_INDEX, no store write', () => {
  withTempCwd(() => {
    writeStore({ nextId: 2, items: [{ id: 1, text: 'Buy milk', done: false }] });

    const { code, errors } = captureConsole(() => rm(['0']));

    assert.equal(code, 1);
    assert.match(errors[0], /not a valid index/);
    const saved = readStore();
    assert.equal(saved.items.length, 1);
  });
});

test('n = list.length is accepted (removes last item)', () => {
  withTempCwd(() => {
    writeStore({
      nextId: 3,
      items: [
        { id: 1, text: 'Buy milk', done: false },
        { id: 2, text: 'Write pitch', done: false },
      ],
    });

    const { code } = captureConsole(() => rm(['2']));

    assert.equal(code, 0);
    const saved = readStore();
    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0].id, 1);
  });
});

test('n = list.length + 1 is rejected as INDEX_OUT_OF_RANGE, no store write', () => {
  withTempCwd(() => {
    writeStore({ nextId: 2, items: [{ id: 1, text: 'Buy milk', done: false }] });

    const { code, errors } = captureConsole(() => rm(['2']));

    assert.equal(code, 1);
    assert.match(errors[0], /no item at index 2/);
    const saved = readStore();
    assert.equal(saved.items.length, 1);
  });
});

test('any positive n on an empty list is rejected as INDEX_OUT_OF_RANGE', () => {
  withTempCwd(() => {
    // no store file at all -> load() resolves to an empty list
    const { code, errors } = captureConsole(() => rm(['1']));

    assert.equal(code, 1);
    assert.match(errors[0], /no item at index 1/);
    assert.equal(storeExists(), false);
  });
});

test('n = "abc" is rejected as INVALID_INDEX, no store write', () => {
  withTempCwd(() => {
    writeStore({ nextId: 2, items: [{ id: 1, text: 'Buy milk', done: false }] });

    const { code, errors } = captureConsole(() => rm(['abc']));

    assert.equal(code, 1);
    assert.match(errors[0], /not a valid index/);
    const saved = readStore();
    assert.equal(saved.items.length, 1);
  });
});

test('n = "-1" is rejected as INVALID_INDEX, no store write', () => {
  withTempCwd(() => {
    writeStore({ nextId: 2, items: [{ id: 1, text: 'Buy milk', done: false }] });

    const { code, errors } = captureConsole(() => rm(['-1']));

    assert.equal(code, 1);
    assert.match(errors[0], /not a valid index/);
    const saved = readStore();
    assert.equal(saved.items.length, 1);
  });
});

test('missing <n> is rejected as MISSING_INDEX, no store write', () => {
  withTempCwd(() => {
    writeStore({ nextId: 2, items: [{ id: 1, text: 'Buy milk', done: false }] });

    const { code, errors } = captureConsole(() => rm([]));

    assert.equal(code, 1);
    assert.match(errors[0], /index is required/);
    const saved = readStore();
    assert.equal(saved.items.length, 1);
  });
});
