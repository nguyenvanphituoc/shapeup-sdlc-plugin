'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_FILE = '.todo.json';
const TMP_FILE = '.todo.json.tmp';

function withTempCwd(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-store-test-'));
  const prevCwd = process.cwd();
  process.chdir(dir);
  try {
    fn(dir);
  } finally {
    process.chdir(prevCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function freshStoreModule() {
  const storePath = require.resolve('../src/store.js');
  delete require.cache[storePath];
  return require(storePath);
}

test('load() on a missing file returns { nextId: 1, items: [] }', () => {
  withTempCwd(() => {
    const store = freshStoreModule();
    const result = store.load();
    assert.notEqual(result, null);
    assert.deepEqual(result, { nextId: 1, items: [] });
    assert.doesNotThrow(() => store.load());
  });
});

test('load() on a store with items: [] (valid empty JSON) returns that empty list, not an error', () => {
  withTempCwd(() => {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ nextId: 1, items: [] }));
    const store = freshStoreModule();
    const result = store.load();
    assert.deepEqual(result, { nextId: 1, items: [] });
  });
});

test('load() on a file that fails JSON.parse throws StoreCorruptedError', () => {
  withTempCwd(() => {
    fs.writeFileSync(STORE_FILE, '{ this is not valid json');
    const store = freshStoreModule();
    assert.throws(() => store.load(), store.StoreCorruptedError);
  });
});

test('load() on a file with wrong shape (items not an array) throws StoreCorruptedError', () => {
  withTempCwd(() => {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ nextId: 1, items: 'nope' }));
    const store = freshStoreModule();
    assert.throws(() => store.load(), store.StoreCorruptedError);
  });
});

test('load() on a file with an item missing id/text throws StoreCorruptedError', () => {
  withTempCwd(() => {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ nextId: 2, items: [{ id: 1 }] }));
    const store = freshStoreModule();
    assert.throws(() => store.load(), store.StoreCorruptedError);
  });
});

test('save() writes via temp file then renames into place; round-trip save->load returns the same data', () => {
  withTempCwd(() => {
    const store = freshStoreModule();
    const list = { nextId: 3, items: [{ id: 1, text: 'a', done: false }, { id: 2, text: 'b', done: true }] };
    store.save(list);
    assert.equal(fs.existsSync(TMP_FILE), false);
    assert.equal(fs.existsSync(STORE_FILE), true);
    const loaded = store.load();
    assert.deepEqual(loaded, list);
  });
});
