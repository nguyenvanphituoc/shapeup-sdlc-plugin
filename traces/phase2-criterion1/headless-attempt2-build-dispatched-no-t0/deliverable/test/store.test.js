'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const STORE_PATH = path.join(process.cwd(), '.todo.json');
const TMP_PATH = path.join(process.cwd(), '.todo.json.tmp');

function cleanup() {
  for (const p of [STORE_PATH, TMP_PATH]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

test('load() on a missing file returns { nextId: 1, items: [] }, never null, never throws', () => {
  cleanup();
  const { load } = require('../src/store.js');
  let result;
  assert.doesNotThrow(() => {
    result = load();
  });
  assert.notEqual(result, null);
  assert.deepEqual(result, { nextId: 1, items: [] });
  cleanup();
});

test('save(list) writes via temp file + rename, and round-trips through load()', () => {
  cleanup();
  const { save, load } = require('../src/store.js');
  const list = {
    nextId: 3,
    items: [
      { id: 1, text: 'Buy milk', done: false },
      { id: 2, text: 'Write pitch', done: true },
    ],
  };
  save(list);
  assert.ok(fs.existsSync(STORE_PATH));
  assert.ok(!fs.existsSync(TMP_PATH));
  const loaded = load();
  assert.deepEqual(loaded, list);
  cleanup();
});

test('load() on a store with items: [] (valid empty JSON) returns that empty list, not an error', () => {
  cleanup();
  const { save, load } = require('../src/store.js');
  save({ nextId: 1, items: [] });
  const loaded = load();
  assert.deepEqual(loaded, { nextId: 1, items: [] });
  cleanup();
});

test('load() on a file that fails JSON.parse throws StoreCorruptedError', () => {
  cleanup();
  const { load, StoreCorruptedError } = require('../src/store.js');
  fs.writeFileSync(STORE_PATH, '{not valid json');
  assert.throws(() => load(), StoreCorruptedError);
  cleanup();
});

test('load() on a file with wrong shape (items not an array) throws StoreCorruptedError', () => {
  cleanup();
  const { load, StoreCorruptedError } = require('../src/store.js');
  fs.writeFileSync(STORE_PATH, JSON.stringify({ nextId: 1, items: 'nope' }));
  assert.throws(() => load(), StoreCorruptedError);
  cleanup();
});

test('load() on a file with an item missing id/text throws StoreCorruptedError', () => {
  cleanup();
  const { load, StoreCorruptedError } = require('../src/store.js');
  fs.writeFileSync(
    STORE_PATH,
    JSON.stringify({ nextId: 1, items: [{ text: 'no id here' }] })
  );
  assert.throws(() => load(), StoreCorruptedError);
  cleanup();
});
