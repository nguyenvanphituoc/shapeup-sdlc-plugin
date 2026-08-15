'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const list = require('../../src/commands/list');

const STORE_FILE = '.todo.json';

function withTempCwd(fn) {
  const prevCwd = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-list-'));
  process.chdir(tmpDir);
  try {
    return fn(tmpDir);
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function writeStore(data) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(data));
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

test('lists items with 1-based index and done markers, exit 0', () => {
  withTempCwd(() => {
    writeStore({
      nextId: 3,
      items: [
        { id: 1, text: 'Buy milk', done: false },
        { id: 2, text: 'Write pitch', done: true },
      ],
    });

    const { code, logs } = captureConsole(() => list());

    assert.equal(code, 0);
    assert.equal(logs.length, 2);
    assert.equal(logs[0], '[1] [ ] Buy milk');
    assert.equal(logs[1], '[2] [x] Write pitch');
  });
});

test('missing store file prints an explicit non-blank "no todos yet" message, exit 0', () => {
  withTempCwd(() => {
    const { code, logs } = captureConsole(() => list());

    assert.equal(code, 0);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /no todos yet/);
    assert.notEqual(logs[0].trim(), '');
  });
});

test('empty items array prints the same "no todos yet" message, exit 0', () => {
  withTempCwd(() => {
    writeStore({ nextId: 1, items: [] });

    const { code, logs } = captureConsole(() => list());

    assert.equal(code, 0);
    assert.equal(logs.length, 1);
    assert.match(logs[0], /no todos yet/);
  });
});

test('corrupted store file: stderr message, no stack trace, exit code 1, does not print empty-list message', () => {
  withTempCwd(() => {
    fs.writeFileSync(STORE_FILE, '{ not valid json');

    const { code, logs, errors } = captureConsole(() => list());

    assert.equal(code, 1);
    assert.equal(logs.length, 0);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /store file is corrupted/);
    assert.doesNotMatch(errors[0], /at Object/);
  });
});
