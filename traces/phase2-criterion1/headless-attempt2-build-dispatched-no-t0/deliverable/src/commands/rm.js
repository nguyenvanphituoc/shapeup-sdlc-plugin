'use strict';

// `todo rm <n>` — removes the item at 1-based display index <n>.
// Per shapeup/todo-cli/spec/usecases/UC-RemoveTodo.md and
// shapeup/todo-cli/spec/ux-behavior.md#Command-rm-n.

const store = require('../store');
const todoList = require('../domain/todo-list');

const STORE_PATH = './.todo.json';
const INDEX_RE = /^[1-9][0-9]*$/;

/**
 * @param {string[]} args - process.argv.slice(3), e.g. ["1"]
 * @returns {number} exit code (0 success, 1 error)
 */
function rm(args) {
  const raw = args[0];

  if (raw === undefined) {
    console.error('todo rm: index is required');
    return 1;
  }

  let list;
  try {
    list = store.load();
  } catch (err) {
    if (err instanceof store.StoreCorruptedError) {
      console.error(`todo: store file is corrupted (${STORE_PATH}) — fix or remove it`);
      return 1;
    }
    throw err;
  }

  if (!INDEX_RE.test(raw)) {
    console.error(`todo rm: '${raw}' is not a valid index`);
    return 1;
  }

  const n = Number(raw);
  if (n < 1 || n > list.items.length) {
    console.error(`todo rm: no item at index ${n}`);
    return 1;
  }

  const item = list.items[n - 1];
  const updated = todoList.removeAt(list, n);
  store.save(updated);

  console.log(`todo: [${n}] "${item.text}" removed`);
  return 0;
}

module.exports = rm;
