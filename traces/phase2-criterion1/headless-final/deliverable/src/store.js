'use strict';

const fs = require('fs');

const STORE_PATH = './.todo.json';
const TMP_PATH = './.todo.json.tmp';

class StoreCorruptedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoreCorruptedError';
  }
}

class StoreWriteError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoreWriteError';
  }
}

function isValidShape(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (!Array.isArray(parsed.items)) return false;
  for (const item of parsed.items) {
    if (!item || typeof item !== 'object') return false;
    if (item.id === undefined || item.text === undefined) return false;
  }
  return true;
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

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new StoreCorruptedError('store file is not valid JSON');
    }
    throw err;
  }

  if (!isValidShape(parsed)) {
    throw new StoreCorruptedError('store file has an invalid shape');
  }

  return parsed;
}

function save(list) {
  const data = JSON.stringify({ nextId: list.nextId, items: list.items });
  try {
    fs.writeFileSync(TMP_PATH, data);
  } catch (err) {
    throw new StoreWriteError('failed to write temp store file');
  }
  try {
    fs.renameSync(TMP_PATH, STORE_PATH);
  } catch (err) {
    throw new StoreWriteError('failed to rename temp store file into place');
  }
}

module.exports = { load, save, StoreCorruptedError, StoreWriteError };
