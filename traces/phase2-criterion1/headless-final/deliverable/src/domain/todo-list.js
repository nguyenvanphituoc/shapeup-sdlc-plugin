'use strict';

// TodoList aggregate — pure in-memory logic, no file I/O.
// Owns id assignment (nextId, monotonic, never reused).

function createEmpty() {
  return { nextId: 1, items: [] };
}

function addItem(list, text) {
  const newItem = { id: list.nextId, text, done: false };
  return {
    nextId: list.nextId + 1,
    items: [...list.items, newItem],
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
