'use strict';

// `todo list` command — prints every item with its 1-based display index and done state.
// Store I/O follows the contract in shapeup/todo-cli/spec/contracts/todo-store.contract.md:
// JSON file at ./.todo.json (cwd-relative), ENOENT -> empty list, unparseable/wrong-shape ->
// StoreCorruptedError. Scope substrate for this command is self-contained (no shared store module).

const fs = require('fs');
const path = require('path');

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

/**
 * Run the `list` command.
 * @param {string[]} args - argv after the "list" subcommand (unused)
 * @param {{cwd?: string, stdout?: {write: Function}, stderr?: {write: Function}}} [options]
 * @returns {Promise<number>} exit code
 */
async function run(args, options = {}) {
  const cwd = options.cwd || process.cwd();
  const stdout = options.stdout || process.stdout;
  const stderr = options.stderr || process.stderr;
  const storePath = path.join(cwd, STORE_FILENAME);

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

  if (list.items.length === 0) {
    stdout.write('no todos yet\n');
    return 0;
  }

  list.items.forEach((item, idx) => {
    const marker = item.done ? 'x' : ' ';
    stdout.write(`[${idx + 1}] [${marker}] ${item.text}\n`);
  });
  return 0;
}

module.exports = { run, StoreCorruptedError };
