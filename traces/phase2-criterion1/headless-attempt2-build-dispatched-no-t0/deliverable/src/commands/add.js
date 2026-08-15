'use strict';

// Command: `add <text>` — implements UC-AddTodo Steps 1-6.
// Reads/writes the store via `../store.js` (TASK-003, foundation scope) and
// mutates the in-memory list via `../domain/todo-list.js` (TASK-002,
// foundation scope). Neither module is owned by this scope; both are called
// read-only per their contract.

const { addItem } = require('../domain/todo-list.js');
const store = require('../store.js');

/**
 * @param {string[]} args - raw args after the `add` subcommand, e.g. ["Buy", "milk"]
 * @returns {number} process exit code
 */
function run(args) {
  const text = (args || []).join(' ').trim();

  if (text.length === 0) {
    process.stderr.write('todo add: text is required\n');
    return 1;
  }

  let list;
  try {
    list = store.load();
  } catch (err) {
    if (err && err.name === 'StoreCorruptedError') {
      process.stderr.write(
        `todo: store file is corrupted (${store.STORE_PATH || './.todo.json'}) — fix or remove it\n`
      );
      return 1;
    }
    throw err;
  }

  const updated = addItem(list, text);
  const newItem = updated.items[updated.items.length - 1];

  try {
    store.save(updated);
  } catch (err) {
    process.stderr.write('todo add: failed to save store\n');
    return 1;
  }

  process.stdout.write(`Added [${newItem.id}] ${newItem.text}\n`);
  return 0;
}

module.exports = { run };
