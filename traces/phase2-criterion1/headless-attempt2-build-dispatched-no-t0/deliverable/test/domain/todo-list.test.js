'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createEmpty,
  addItem,
  completeAt,
  removeAt,
} = require('../../src/domain/todo-list.js');

test('createEmpty returns { nextId: 1, items: [] }', () => {
  assert.deepEqual(createEmpty(), { nextId: 1, items: [] });
});

test('addItem on an empty list assigns id 1', () => {
  const list = addItem(createEmpty(), 'Buy milk');
  assert.equal(list.items[0].id, 1);
  assert.equal(list.items[0].text, 'Buy milk');
  assert.equal(list.items[0].done, false);
  assert.equal(list.nextId, 2);
});

test('add assigns increasing ids', () => {
  let list = createEmpty();
  list = addItem(list, 'first');
  list = addItem(list, 'second');
  list = addItem(list, 'third');
  assert.deepEqual(
    list.items.map((i) => i.id),
    [1, 2, 3]
  );
});

test('completeAt at index 1 (first item) marks the correct item done', () => {
  let list = createEmpty();
  list = addItem(list, 'first');
  list = addItem(list, 'second');
  list = completeAt(list, 1);
  assert.equal(list.items[0].done, true);
  assert.equal(list.items[1].done, false);
});

test('completeAt at index items.length (last item) marks the correct item done', () => {
  let list = createEmpty();
  list = addItem(list, 'first');
  list = addItem(list, 'second');
  list = addItem(list, 'third');
  list = completeAt(list, list.items.length);
  assert.equal(list.items[2].done, true);
  assert.equal(list.items[0].done, false);
  assert.equal(list.items[1].done, false);
});

test('complete on an already-done item is idempotent (no throw, stays done)', () => {
  let list = createEmpty();
  list = addItem(list, 'first');
  list = completeAt(list, 1);
  assert.doesNotThrow(() => {
    list = completeAt(list, 1);
  });
  assert.equal(list.items[0].done, true);
});

test('removeAt at index 1 (first item) removes the correct item', () => {
  let list = createEmpty();
  list = addItem(list, 'first');
  list = addItem(list, 'second');
  list = removeAt(list, 1);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].text, 'second');
});

test('removeAt at index items.length (last item) removes the correct item', () => {
  let list = createEmpty();
  list = addItem(list, 'first');
  list = addItem(list, 'second');
  list = addItem(list, 'third');
  list = removeAt(list, list.items.length);
  assert.equal(list.items.length, 2);
  assert.deepEqual(
    list.items.map((i) => i.text),
    ['first', 'second']
  );
});

test('remove does not reuse the removed item id on a subsequent add', () => {
  let list = createEmpty();
  list = addItem(list, 'first'); // id 1
  list = addItem(list, 'second'); // id 2
  list = removeAt(list, 1); // remove id 1
  list = addItem(list, 'third');
  assert.deepEqual(
    list.items.map((i) => i.id),
    [2, 3]
  );
  assert.equal(list.nextId, 4);
});
