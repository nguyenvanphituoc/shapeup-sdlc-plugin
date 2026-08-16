'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

class StoreCorruptedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoreCorruptedError';
    this.code = 'E_STORE_CORRUPTED';
  }
}

class StoreReadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoreReadError';
    this.code = 'E_STORE_READ_FAILED';
  }
}

class StoreWriteError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoreWriteError';
    this.code = 'E_STORE_WRITE_FAILED';
  }
}

function storePath() {
  return path.join(os.homedir(), '.todo.json');
}

function load() {
  let raw;
  try {
    raw = fs.readFileSync(storePath(), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw new StoreReadError(`could not read todo store: ${err.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new StoreCorruptedError(`todo store is corrupted (${storePath()}) — fix or delete the file`);
  }

  if (!Array.isArray(parsed)) {
    throw new StoreCorruptedError(`todo store is corrupted (${storePath()}) — fix or delete the file`);
  }

  return parsed;
}

function save(items) {
  const json = JSON.stringify(items);
  try {
    fs.writeFileSync(storePath(), json);
  } catch (err) {
    throw new StoreWriteError(`could not save todo store: ${err.message}`);
  }
}

module.exports = {
  load,
  save,
  storePath,
  StoreCorruptedError,
  StoreReadError,
  StoreWriteError,
};
