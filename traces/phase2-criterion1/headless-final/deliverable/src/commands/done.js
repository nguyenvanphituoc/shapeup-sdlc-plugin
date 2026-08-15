'use strict';

// `todo done <n>` command — marks the item at 1-based display index <n> as done.
// Store I/O follows the contract in shapeup/todo-cli/spec/contracts/todo-store.contract.md:
// JSON file at ./.todo.json (cwd-relative), atomic write via temp-file + rename,
// ENOENT -> empty list, unparseable/wrong-shape -> StoreCorruptedError.
// Scope substrate for this command is self-contained (no shared store module).

const fs = require('fs');
const path = require('path');
const { completeAt } = require('../domain/todo-list.js');

const STORE_FILENAME = '.todo.json';

class StoreCorruptedError extends Error {}

function isValidShape(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  if (!Array.isArray(parsed.items)) return false;
  return parsed.items.every(
    (item) => item && typeof item === 'object' && 'id' in item && 'text' in item
  );
}

function loadStore(storePath) {
  let raw;
  try {
    raw = fs.readFileSync(storePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { nextId: 1, items: [] };
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new StoreCorruptedError(`store file is corrupted (${storePath}) — fix or remove it`);
  }

  if (!isValidShape(parsed)) {
    throw new StoreCorruptedError(`store file is corrupted (${storePath}) — fix or remove it`);
  }

  return parsed;
}

function saveStore(storePath, list) {
  const tmpPath = `${storePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify({ nextId: list.nextId, items: list.items }));
  fs.renameSync(tmpPath, storePath);
}

/**
 * Run the `done <n>` command.
 * @param {string[]} args - argv after the "done" subcommand, e.g. ["1"]
 * @param {{cwd?: string, stdout?: {write: Function}, stderr?: {write: Function}}} [options]
 * @returns {Promise<number>} exit code
 */
async function run(args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const storePath = path.join(cwd, STORE_FILENAME);

  const raw = args[0];

  // Validate presence — before any store touch.
  if (raw === undefined) {
    stderr.write('todo done: index is required\n');
    return 1;
  }

  // Validate numeric-ness (positive integer) — before any store touch.
  if (!/^[1-9][0-9]*$/.test(raw)) {
    stderr.write(`todo done: '${raw}' is not a valid index\n`);
    return 1;
  }

  const n = parseInt(raw, 10);

  let list;
  try {
    list = loadStore(storePath);
  } catch (err) {
    if (err instanceof StoreCorruptedError) {
      stderr.write(`todo: store file is corrupted (${storePath}) — fix or remove it\n`);
      return 1;
    }
    throw err;
  }

  // Validate range — before any store mutation.
  if (n < 1 || n > list.items.length) {
    stderr.write(`todo done: no item at index ${n}\n`);
    return 1;
  }

  const updated = completeAt(list, n);
  saveStore(storePath, updated);

  const item = updated.items[n - 1];
  stdout.write(`Marked done: [${n}] ${item.text}\n`);
  return 0;
}

module.exports = { run, StoreCorruptedError };
