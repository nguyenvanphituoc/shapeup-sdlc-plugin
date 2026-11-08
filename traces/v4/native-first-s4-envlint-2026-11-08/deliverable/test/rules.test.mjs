import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkSchema, checkPairs } from '../src/rules.mjs';

// Pairs are hand-built in the C1 shape — never produced by the parser.
const p = (key, value, line) => ({ key, value, line });
const one = (rule, value) => checkPairs([p('K', value, 1)], { K: rule });

test('exports checkSchema and checkPairs', () => {
  assert.equal(typeof checkSchema, 'function');
  assert.equal(typeof checkPairs, 'function');
});

test('TS-INV-01: rules.mjs has no import and no network/fs reference; url by shape only', () => {
  const src = readFileSync(new URL('../src/rules.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /^\s*import\b/m);
  assert.doesNotMatch(src, /\bimport\s*\(/);
  assert.doesNotMatch(src, /\brequire\s*\(/);
  assert.doesNotMatch(src, /\b(fetch|XMLHttpRequest|node:|http|https|net|dns|fs)\s*[.(]/);
  assert.deepEqual(one({ type: 'url' }, 'http://unreachable.invalid'), []);
});

test('TS-ERR-REQUIRED_MISSING: required key absent → required finding with line null', () => {
  assert.deepEqual(checkPairs([], { PORT: { required: true, type: 'int' } }), [
    { key: 'PORT', line: null, rule: 'required', message: 'required key is missing' },
  ]);
  assert.deepEqual(checkPairs([], { PORT: { required: false } }), []);
  assert.deepEqual(checkPairs([], { PORT: { type: 'int' } }), []);
});

test('TS-ERR-TYPE_MISMATCH: int', () => {
  for (const v of ['1.0', '0x10', '1e3', '', ' 7']) {
    assert.deepEqual(one({ type: 'int' }, v), [
      { key: 'K', line: 1, rule: 'type', message: `expected int, got "${v}"` },
    ], v);
  }
});

test('TS-REQ-type-boundary: int accepts -5, 0, 42', () => {
  for (const v of ['-5', '0', '42']) assert.deepEqual(one({ type: 'int' }, v), [], v);
});

test('bool accepts only true/false; string accepts anything', () => {
  assert.deepEqual(one({ type: 'bool' }, 'true'), []);
  assert.deepEqual(one({ type: 'bool' }, 'false'), []);
  for (const v of ['yes', 'TRUE', '1', '']) {
    assert.equal(one({ type: 'bool' }, v).length, 1, v);
    assert.equal(one({ type: 'bool' }, v)[0].rule, 'type');
  }
  for (const v of ['', 'anything at all', '${VAR}']) assert.deepEqual(one({ type: 'string' }, v), [], v);
});

test('url accepts http(s) with hostname; rejects other shapes; no network', () => {
  for (const v of ['https://a.example/x', 'http://unreachable.invalid']) {
    assert.deepEqual(one({ type: 'url' }, v), [], v);
  }
  for (const v of ['localhost:3000', 'javascript:alert(1)', 'file:///etc', 'not a url', '']) {
    assert.deepEqual(one({ type: 'url' }, v), [
      { key: 'K', line: 1, rule: 'type', message: `expected url, got "${v}"` },
    ], v);
  }
});

test('TS-ERR-ENUM_MISMATCH: enum is exact and case-sensitive', () => {
  const rule = { enum: ['dev', 'prod'] };
  assert.deepEqual(one(rule, 'dev'), []);
  assert.deepEqual(one(rule, 'prod'), []);
  assert.deepEqual(one(rule, 'Dev'), [
    { key: 'K', line: 1, rule: 'enum', message: 'expected one of dev, prod, got "Dev"' },
  ]);
  assert.equal(one(rule, 'staging')[0].rule, 'enum');
  assert.equal(one(rule, ' dev').length, 1);
});

test('type and enum both reported for one key, type first', () => {
  assert.deepEqual(one({ type: 'int', enum: ['1', '2'] }, 'x').map((f) => f.rule), ['type', 'enum']);
});

test('TS-INV-02: duplicate key → only the last occurrence is checked, its line reported', () => {
  const schema = { A: { type: 'int' } };
  assert.deepEqual(checkPairs([p('A', '1', 1), p('B', 'x', 2), p('A', 'nope', 3)], schema), [
    { key: 'A', line: 3, rule: 'type', message: 'expected int, got "nope"' },
  ]);
  assert.deepEqual(checkPairs([p('A', 'nope', 1), p('A', '7', 3)], schema), []);
});

test('TS-INV-03: keys not in the schema produce no finding', () => {
  assert.deepEqual(checkPairs([p('EXTRA', 'whatever', 1)], { A: { type: 'int' } }), []);
});

test('order: lined findings ascending by line, then required in schema key order', () => {
  const schema = {
    Z: { required: true },
    B: { type: 'int' },
    Y: { required: true },
    A: { type: 'bool' },
  };
  const out = checkPairs([p('B', 'x', 5), p('A', 'x', 2)], schema);
  assert.deepEqual(out.map((f) => [f.key, f.line]), [['A', 2], ['B', 5], ['Z', null], ['Y', null]]);
});

test('TS-ERR-SCHEMA_INVALID: checkSchema rejects structural faults', () => {
  const bad = [
    [],
    null,
    'str',
    42,
    { A: { type: 'float' } },
    { A: { enum: [] } },
    { A: { enum: ['a', 1] } },
    { A: { enum: 'dev' } },
    { A: { required: 'yes' } },
    { A: { min: 1 } },
    { A: null },
    { A: [] },
    { A: 'int' },
  ];
  for (const s of bad) {
    const errs = checkSchema(s);
    assert.ok(Array.isArray(errs) && errs.length > 0, JSON.stringify(s));
    assert.ok(errs.every((e) => typeof e === 'string'));
  }
});

test('checkSchema accepts {} and a valid schema', () => {
  assert.deepEqual(checkSchema({}), []);
  assert.deepEqual(checkSchema({
    PORT: { required: true, type: 'int' },
    MODE: { enum: ['dev', 'prod'] },
    API_URL: { type: 'url' },
    DEBUG: { type: 'bool', required: false },
    NAME: {},
  }), []);
});

test('INV-04: neither function throws for an accepted schema and C1 pairs', () => {
  const schema = { A: { type: 'url', enum: ['x'] }, B: { required: true } };
  assert.deepEqual(checkSchema(schema), []);
  assert.doesNotThrow(() => checkPairs([p('A', '::::', 1), p('C', '', 2)], schema));
});
