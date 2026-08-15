'use strict';

// `todo list` — prints every item as `[<n>] [x|  ] <text>` at its 1-based
// display index (RULE-03). Per shapeup/todo-cli/spec/usecases/UC-ListTodos.md
// and shapeup/todo-cli/spec/ux-behavior.md#Command-list.

const store = require('../store');

const STORE_PATH = './.todo.json';

/**
 * @returns {number} exit code (0 success, 1 error)
 */
function list() {
  let data;
  try {
    data = store.load();
  } catch (err) {
    if (err instanceof store.StoreCorruptedError) {
      console.error(`todo: store file is corrupted (${STORE_PATH}) — fix or remove it`);
      return 1;
    }
    throw err;
  }

  if (data.items.length === 0) {
    console.log('todo: no todos yet');
    return 0;
  }

  data.items.forEach((item, idx) => {
    console.log(`[${idx + 1}] [${item.done ? 'x' : ' '}] ${item.text}`);
  });
  return 0;
}

module.exports = list;
