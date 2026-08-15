'use strict';

// TodoList domain module — pure in-memory logic, no file I/O (see TASK-004).
// `nextId` is a monotonic counter: never decremented, never reused after
// removal (INV-01). Index arguments are 1-based display indices and are
// assumed already validated in-range by the caller (CLI command layer).

function createEmpty() {
  return { nextId: 1, items: [] };
}

function addItem(list, text) {
  const item = { id: list.nextId, text, done: false };
  return {
    nextId: list.nextId + 1,
    items: [...list.items, item],
  };
}

function completeAt(list, index1based) {
  const items = list.items.map((item, i) =>
    i === index1based - 1 ? { ...item, done: true } : item
  );
  return { nextId: list.nextId, items };
}

function removeAt(list, index1based) {
  const items = list.items.filter((_, i) => i !== index1based - 1);
  return { nextId: list.nextId, items };
}

module.exports = { createEmpty, addItem, completeAt, removeAt };
