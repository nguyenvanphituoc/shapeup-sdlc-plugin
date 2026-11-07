import test from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../src/rules.mjs';

const p = (key, value, line = 1) => ({ key, value, line });

test('empty input yields no findings', () => {
  assert.deepEqual(check([], {}), []);
});

test('missing required key has line null', () => {
  const f = check([], { A: { required: true } });
  assert.equal(f.length, 1);
  assert.equal(f[0].code, 'MISSING_REQUIRED');
  assert.equal(f[0].key, 'A');
  assert.equal(f[0].line, null);
});

test('type mismatches carry the pair line', () => {
  const schema = { N: { type: 'int' }, B: { type: 'bool' }, U: { type: 'url' } };
  const f = check([p('N', 'abc', 1), p('B', 'yes', 2), p('U', 'not a url', 3)], schema);
  assert.deepEqual(f.map((x) => [x.key, x.code, x.line]), [
    ['N', 'TYPE_MISMATCH', 1],
    ['B', 'TYPE_MISMATCH', 2],
    ['U', 'TYPE_MISMATCH', 3],
  ]);
});

test('valid typed values produce no findings', () => {
  const schema = { N: { type: 'int' }, B: { type: 'bool' }, C: { type: 'bool' }, U: { type: 'url' }, S: { type: 'string' } };
  const pairs = [p('N', '-42'), p('B', 'true'), p('C', 'false'), p('U', 'https://a.b'), p('S', 'anything at all')];
  assert.deepEqual(check(pairs, schema), []);
});

test('url on an unreachable host is accepted on shape alone', () => {
  assert.deepEqual(check([p('U', 'https://example.invalid/x')], { U: { type: 'url' } }), []);
});

test('enum rejects values outside the list', () => {
  const f = check([p('E', 'staging', 4)], { E: { enum: ['dev', 'prod'] } });
  assert.equal(f.length, 1);
  assert.equal(f[0].code, 'NOT_IN_ENUM');
  assert.equal(f[0].line, 4);
  assert.deepEqual(check([p('E', 'dev')], { E: { enum: ['dev', 'prod'] } }), []);
});

test('every finding carries key and line', () => {
  const f = check([p('N', 'x', 7)], { N: { type: 'int' }, M: { required: true } });
  for (const x of f) {
    assert.ok('key' in x && 'line' in x);
  }
});
