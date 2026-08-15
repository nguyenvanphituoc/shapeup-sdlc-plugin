'use strict';

// TodoStoreRepository — JSON file persistence at ./.todo.json (cwd-relative).
// Per shapeup/todo-cli/spec/contracts/todo-store.contract.md, de-risked by
// .shapeup/todo-cli/orient/spike-persistence.md. Node core `fs` only.

const fs = require('node:fs');

const STORE_PATH = './.todo.json';
const TMP_PATH = './.todo.json.tmp';

class StoreCorruptedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoreCorruptedError';
  }
}

class StoreWriteError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StoreWriteError';
    this.cause = cause;
  }
}

function isValidShape(data) {
  if (data === null || typeof data !== 'object') return false;
  if (!Array.isArray(data.items)) return false;
  return data.items.every(
    (item) =>
      item !== null &&
      typeof item === 'object' &&
      Object.prototype.hasOwnProperty.call(item, 'id') &&
      Object.prototype.hasOwnProperty.call(item, 'text')
  );
}

function load() {
  let raw;
  try {
    raw = fs.readFileSync(STORE_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { nextId: 1, items: [] };
    }
    throw err;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new StoreCorruptedError(`store file at ${STORE_PATH} is not valid JSON`);
    }
    throw err;
  }

  if (!isValidShape(data)) {
    throw new StoreCorruptedError(`store file at ${STORE_PATH} has an invalid shape`);
  }

  return { nextId: data.nextId, items: data.items };
}

function save(list) {
  const payload = JSON.stringify({ nextId: list.nextId, items: list.items });
  try {
    fs.writeFileSync(TMP_PATH, payload);
  } catch (err) {
    throw new StoreWriteError('failed to write temp store file', err);
  }
  try {
    fs.renameSync(TMP_PATH, STORE_PATH);
  } catch (err) {
    throw new StoreWriteError('failed to rename temp store file into place', err);
  }
}

module.exports = { load, save, StoreCorruptedError, StoreWriteError };
