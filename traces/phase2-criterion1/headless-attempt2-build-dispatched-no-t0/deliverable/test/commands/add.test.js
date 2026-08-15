'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { run } = require('../../src/commands/add.js');

function withTempCwd(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-cli-add-'));
  const prevCwd = process.cwd();
  process.chdir(dir);
  try {
    fn(dir);
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function captureOutput(fn) {
  let stdout = '';
  let stderr = '';
  const origOut = process.stdout.write;
  const origErr = process.stderr.write;
  process.stdout.write = (chunk) => {
    stdout += chunk;
    return true;
  };
  process.stderr.write = (chunk) => {
    stderr += chunk;
    return true;
  };
  try {
    const exitCode = fn();
    return { exitCode, stdout, stderr };
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
}

test('add a valid item: creates store, writes item, confirms on stdout, exit 0', () => {
  withTempCwd(() => {
    const { exitCode, stdout, stderr } = captureOutput(() => run(['Buy', 'milk']));

    assert.equal(exitCode, 0);
    assert.equal(stderr, '');
    assert.match(stdout, /Buy milk/);

    const raw = fs.readFileSync('./.todo.json', 'utf8');
    const data = JSON.parse(raw);
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].text, 'Buy milk');
    assert.equal(data.items[0].done, false);
  });
});

test('reject empty text (no args): no store write, stderr names text is required, exit 1', () => {
  withTempCwd(() => {
    const { exitCode, stderr } = captureOutput(() => run([]));

    assert.equal(exitCode, 1);
    assert.match(stderr, /text is required/);
    assert.equal(fs.existsSync('./.todo.json'), false);
  });
});

test('reject whitespace-only text: no store write, stderr names text is required, exit 1', () => {
  withTempCwd(() => {
    const { exitCode, stderr } = captureOutput(() => run(['   ']));

    assert.equal(exitCode, 1);
    assert.match(stderr, /text is required/);
    assert.equal(fs.existsSync('./.todo.json'), false);
  });
});

test('id is never reused: add, add, rm-equivalent (direct store edit), add again', () => {
  withTempCwd(() => {
    captureOutput(() => run(['first']));
    captureOutput(() => run(['second']));

    // simulate removal of item id 1 directly on the store (rm command is out of scope here)
    const data = JSON.parse(fs.readFileSync('./.todo.json', 'utf8'));
    data.items = data.items.filter((i) => i.id !== 1);
    fs.writeFileSync('./.todo.json', JSON.stringify(data));

    captureOutput(() => run(['third']));

    const after = JSON.parse(fs.readFileSync('./.todo.json', 'utf8'));
    const ids = after.items.map((i) => i.id);
    assert.ok(!ids.includes(1) || after.items.find((i) => i.text === 'third').id !== 1);
    assert.equal(after.items.find((i) => i.text === 'third').id, 3);
  });
});
