// Fixtures for the pure .env parser (UC-01, contract C1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from '../src/parse.mjs';

test('returns {pairs, problems} arrays', () => {
  const r = parseEnv('A=1');
  assert.deepEqual(Object.keys(r).sort(), ['pairs', 'problems']);
  assert.ok(Array.isArray(r.pairs));
  assert.ok(Array.isArray(r.problems));
});

test('TS-INV-02: src/parse.mjs has no import and is deterministic', () => {
  const source = readFileSync(new URL('../src/parse.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /^\s*import\b/m);
  assert.doesNotMatch(source, /\bimport\s*\(/);
  assert.doesNotMatch(source, /\brequire\s*\(/);
  const text = 'A=1\nB="x"\nbad\n';
  assert.deepEqual(parseEnv(text), parseEnv(text));
});

test('KEY=value yields a pair on line 1', () => {
  assert.deepEqual(parseEnv('KEY=value'), {
    pairs: [{ key: 'KEY', value: 'value', line: 1 }],
    problems: [],
  });
});

test('comments and whitespace-only lines yield nothing', () => {
  assert.deepEqual(parseEnv('# comment\n   \n\t\n   # indented comment\n'), {
    pairs: [],
    problems: [],
  });
});

test('export KEY=value yields key KEY', () => {
  assert.deepEqual(parseEnv('export KEY=value').pairs, [{ key: 'KEY', value: 'value', line: 1 }]);
  assert.deepEqual(parseEnv('export\tKEY=v').pairs, [{ key: 'KEY', value: 'v', line: 1 }]);
});

test('quoted values yield verbatim inner text', () => {
  assert.deepEqual(parseEnv('A="x y"\nB=\'x y\'').pairs, [
    { key: 'A', value: 'x y', line: 1 },
    { key: 'B', value: 'x y', line: 2 },
  ]);
  assert.deepEqual(parseEnv('E=""').pairs, [{ key: 'E', value: '', line: 1 }]);
});

test('TS-ERR-UNTERMINATED_QUOTE', () => {
  assert.deepEqual(parseEnv('A="abc\nB=\'x\nC="x\'\nD="'), {
    pairs: [],
    problems: [
      { line: 1, message: 'unterminated quote' },
      { line: 2, message: 'unterminated quote' },
      { line: 3, message: 'unterminated quote' },
      { line: 4, message: 'unterminated quote' },
    ],
  });
});

test("TS-ERR-MISSING_EQUALS: line 2 without '='", () => {
  assert.deepEqual(parseEnv('A=1\nJUSTAKEY'), {
    pairs: [{ key: 'A', value: '1', line: 1 }],
    problems: [{ line: 2, message: "missing '='" }],
  });
});

test('TS-ERR-INVALID_KEY: 1BAD=x and =x', () => {
  assert.deepEqual(parseEnv('1BAD=x\n=x\nA-B=1'), {
    pairs: [],
    problems: [
      { line: 1, message: 'invalid key' },
      { line: 2, message: 'invalid key' },
      { line: 3, message: 'invalid key' },
    ],
  });
});

test('TS-INV-03: ${VAR} is never interpolated', () => {
  assert.deepEqual(parseEnv('A=${HOME}').pairs, [{ key: 'A', value: '${HOME}', line: 1 }]);
  assert.deepEqual(parseEnv('A=${HOME}/x').pairs, [{ key: 'A', value: '${HOME}/x', line: 1 }]);
});

test('TS-INV-01: lines are 1-based physical lines', () => {
  const r = parseEnv('# c\n\nA=1\n  \nbad\nexport B = two \n');
  assert.deepEqual(r.pairs, [
    { key: 'A', value: '1', line: 3 },
    { key: 'B', value: 'two', line: 6 },
  ]);
  assert.deepEqual(r.problems, [{ line: 5, message: "missing '='" }]);
});

test('duplicates are kept in file order', () => {
  assert.deepEqual(parseEnv('A=1\nA=2').pairs, [
    { key: 'A', value: '1', line: 1 },
    { key: 'A', value: '2', line: 2 },
  ]);
});

test('TS-INV-04: boundary inputs never throw', () => {
  for (const t of ['', '\n\n', '=', "'", '﻿', '\r\n']) {
    const r = parseEnv(t);
    assert.ok(Array.isArray(r.pairs) && Array.isArray(r.problems), JSON.stringify(t));
  }
  assert.deepEqual(parseEnv(''), { pairs: [], problems: [] });
  assert.deepEqual(parseEnv('='), { pairs: [], problems: [{ line: 1, message: 'invalid key' }] });
  assert.deepEqual(parseEnv("'"), { pairs: [], problems: [{ line: 1, message: "missing '='" }] });
});

test('BOM-prefixed text parses with correct lines', () => {
  assert.deepEqual(parseEnv('﻿A=1\nbad'), {
    pairs: [{ key: 'A', value: '1', line: 1 }],
    problems: [{ line: 2, message: "missing '='" }],
  });
});

test('CRLF text parses with correct lines and no stray \\r', () => {
  assert.deepEqual(parseEnv('A=1\r\nB="q"\r\nbad\r\n'), {
    pairs: [
      { key: 'A', value: '1', line: 1 },
      { key: 'B', value: 'q', line: 2 },
    ],
    problems: [{ line: 3, message: "missing '='" }],
  });
});
