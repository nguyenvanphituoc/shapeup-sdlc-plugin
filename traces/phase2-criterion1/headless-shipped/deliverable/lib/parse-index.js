'use strict';

class MissingIndexError extends Error {
  constructor() {
    super('missing index');
    this.name = 'MissingIndexError';
    this.code = 'E_MISSING_INDEX';
  }
}

class InvalidIndexError extends Error {
  constructor(raw) {
    super(`"${raw}" is not a valid index`);
    this.name = 'InvalidIndexError';
    this.code = 'E_INVALID_INDEX';
  }
}

class IndexOutOfRangeError extends Error {
  constructor(n, itemsLength) {
    super(`no todo at index ${n}`);
    this.name = 'IndexOutOfRangeError';
    this.code = 'E_INDEX_OUT_OF_RANGE';
  }
}

const INTEGER_RE = /^-?\d+$/;

// Parses a raw CLI argument into a validated 1-based index against a store of
// `itemsLength` items. Never uses bare Number()/parseInt() coercion — only a
// strict integer regex is accepted.
function parseIndex(raw, itemsLength) {
  // Only a genuinely absent argument is "missing" — an empty-string arg (`done ""`) must
  // fall through to the strict integer check below and come out E_INVALID_INDEX, never be
  // folded into E_MISSING_INDEX (see AC: `done ""` is rejected as E_INVALID_INDEX).
  if (raw === undefined || raw === null) {
    throw new MissingIndexError();
  }

  if (!INTEGER_RE.test(raw)) {
    throw new InvalidIndexError(raw);
  }

  const n = parseInt(raw, 10);

  if (n < 1 || n > itemsLength) {
    throw new IndexOutOfRangeError(n, itemsLength);
  }

  return n;
}

module.exports = {
  parseIndex,
  MissingIndexError,
  InvalidIndexError,
  IndexOutOfRangeError,
};
