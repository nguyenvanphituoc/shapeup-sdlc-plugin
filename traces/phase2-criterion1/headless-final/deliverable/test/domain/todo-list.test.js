'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createEmpty, addItem, completeAt, removeAt } = require('../../src/domain/todo-list.js');

test('createEmpty returns { nextId: 1, items: [] }', () => {
  assert.deepEqual(createEmpty(), { nextId: 1, items: [] });
});

test('add assigns increasing ids', () => {
  let list = createEmpty();
  list = addItem(list, 'first');
  list = addItem(list, 'second');
  assert.equal(list.items[0].id, 1);
  assert.equal(list.items[1].id, 2);
  assert.equal(list.nextId, 3);
});

test('addItem on an empty list assigns id 1', () => {
  const list = addItem(createEmpty(), 'first');
  assert.equal(list.items[0].id, 1);
});

test('complete on an already-done item is idempotent (no throw, stays done)', () => {
  let list = createEmpty();
  list = addItem(list, 'first');
  list = completeAt(list, 1);
  assert.equal(list.items[0].done, true);
  assert.doesNotThrow(() => {
    list = completeAt(list, 1);
  });
  assert.equal(list.items[0].done, true);
});

test('remove does not reuse the removed item id on a subsequent add', () => {
  let list = createEmpty();
  list = addItem(list, 'first');
  list = addItem(list, 'second');
  list = removeAt(list, 1); // remove 'first' (id 1)
  list = addItem(list, 'third');
  assert.equal(list.items.map((i) => i.id).includes(1), false);
  assert.equal(list.items[list.items.length - 1].id, 3);
  assert.equal(list.nextId, 4);
});

test('completeAt at index 1 (first item) operates on the correct item', () => {
  let list = createEmpty();
  list = addItem(list, 'a');
  list = addItem(list, 'b');
  list = completeAt(list, 1);
  assert.equal(list.items[0].done, true);
  assert.equal(list.items[1].done, false);
});

test('completeAt at index items.length (last item) operates on the correct item', () => {
  let list = createEmpty();
  list = addItem(list, 'a');
  list = addItem(list, 'b');
  list = completeAt(list, list.items.length);
  assert.equal(list.items[1].done, true);
  assert.equal(list.items[0].done, false);
});

test('removeAt at index 1 (first item) removes the correct item', () => {
  let list = createEmpty();
  list = addItem(list, 'a');
  list = addItem(list, 'b');
  list = removeAt(list, 1);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].text, 'b');
});

test('removeAt at index items.length (last item) removes the correct item', () => {
  let list = createEmpty();
  list = addItem(list, 'a');
  list = addItem(list, 'b');
  list = removeAt(list, list.items.length);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].text, 'a');
});
