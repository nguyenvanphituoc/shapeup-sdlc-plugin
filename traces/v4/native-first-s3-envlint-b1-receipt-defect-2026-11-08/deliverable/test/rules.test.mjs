import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSchema, evaluate } from '../src/rules.mjs';

const judge = (type, value) => evaluate([{ key: 'K', value, line: 1 }], { K: { type } });
const accepts = (type, value) => judge(type, value).length === 0;

test('exports validateSchema and evaluate as functions', () => {
  assert.equal(typeof validateSchema, 'function');
  assert.equal(typeof evaluate, 'function');
});

test('TS-INV-01: arguments unchanged; no fs/net/parse import in src/rules.mjs', () => {
  const pairs = [{ key: 'A', value: 'x', line: 1 }, { key: 'A', value: '1', line: 2 }];
  const schema = { A: { required: true, type: 'int', enum: ['1'] }, B: { required: true } };
  const pairsBefore = structuredClone(pairs);
  const schemaBefore = structuredClone(schema);
  validateSchema(schema);
  evaluate(pairs, schema);
  assert.deepEqual(pairs, pairsBefore);
  assert.deepEqual(schema, schemaBefore);
});

test('TS-NOGO-01: src/rules.mjs imports nothing (no parse.mjs, fs, net, http, dns, fetch)', () => {
  const src = readFileSync(new URL('../src/rules.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /^\s*import\b/m);
  assert.doesNotMatch(src, /\bimport\s*\(/);
  assert.doesNotMatch(src, /parse\.mjs['"]/);
  assert.doesNotMatch(src, /node:(fs|net|http|https|dns)/);
  assert.doesNotMatch(src, /\bfetch\s*\(/);
});

test('TS-INV-02: int accepts/rejects exactly as listed', () => {
  for (const v of ['42', '-1', '+3', '9007199254740993']) assert.ok(accepts('int', v), `int should accept ${JSON.stringify(v)}`);
  for (const v of ['', ' 7', '1e3', '0x10', '3.0', 'abc']) assert.ok(!accepts('int', v), `int should reject ${JSON.stringify(v)}`);
});

test('TS-INV-02: bool accepts/rejects exactly as listed', () => {
  for (const v of ['true', 'false', 'FALSE', 'True', '1', '0']) assert.ok(accepts('bool', v), `bool should accept ${JSON.stringify(v)}`);
  for (const v of ['', 'yes', 'on', '2']) assert.ok(!accepts('bool', v), `bool should reject ${JSON.stringify(v)}`);
});

test('TS-INV-02: url accepts/rejects exactly as listed', () => {
  for (const v of ['https://a.b', 'http://localhost:3000', 'postgres://u:p@h:5432/db']) {
    assert.ok(accepts('url', v), `url should accept ${JSON.stringify(v)}`);
  }
  for (const v of ['', 'not a url', 'localhost:3000', 'mailto:x@y', 'http:/x', 'https://']) {
    assert.ok(!accepts('url', v), `url should reject ${JSON.stringify(v)}`);
  }
});

test('string accepts any value, including empty', () => {
  for (const v of ['', 'anything', ' 7']) assert.ok(accepts('string', v));
});

test('TS-INV-03: empty value is present for required and still type-checked', () => {
  const f = evaluate([{ key: 'A', value: '', line: 3 }], { A: { required: true, type: 'int' } });
  assert.deepEqual(f, [{ key: 'A', line: 3, code: 'INVALID_TYPE', message: 'expected int, got ""' }]);
});

test('TS-ERR-MISSING_REQUIRED: required key absent → one finding, line null', () => {
  const f = evaluate([{ key: 'OTHER', value: 'x', line: 1 }], { A: { required: true } });
  assert.deepEqual(f, [{ key: 'A', line: null, code: 'MISSING_REQUIRED', message: 'required key is missing' }]);
});

test('absent non-required key yields nothing; unknown pair keys ignored', () => {
  assert.deepEqual(evaluate([{ key: 'Z', value: 'x', line: 1 }], { A: { type: 'int' }, B: { required: false } }), []);
});

test('TS-ERR-INVALID_TYPE: PORT=abc with int → finding at the pair line', () => {
  const f = evaluate([{ key: 'PORT', value: 'abc', line: 4 }], { PORT: { type: 'int' } });
  assert.deepEqual(f, [{ key: 'PORT', line: 4, code: 'INVALID_TYPE', message: 'expected int, got "abc"' }]);
});

test('TS-ERR-NOT_IN_ENUM: MODE=prod outside enum → finding at the pair line; case-sensitive', () => {
  const f = evaluate([{ key: 'MODE', value: 'prod', line: 7 }], { MODE: { enum: ['dev', 'test'] } });
  assert.deepEqual(f, [{ key: 'MODE', line: 7, code: 'NOT_IN_ENUM', message: 'expected one of dev, test; got "prod"' }]);
  const g = evaluate([{ key: 'MODE', value: 'Dev', line: 2 }], { MODE: { enum: ['dev', 'test'] } });
  assert.equal(g.length, 1);
  assert.equal(g[0].code, 'NOT_IN_ENUM');
  assert.equal(g[0].line, 2);
  assert.deepEqual(evaluate([{ key: 'MODE', value: 'dev', line: 2 }], { MODE: { enum: ['dev', 'test'] } }), []);
});

test('a value can yield both INVALID_TYPE and NOT_IN_ENUM', () => {
  const f = evaluate([{ key: 'N', value: 'x', line: 1 }], { N: { type: 'int', enum: ['1', '2'] } });
  assert.deepEqual(f.map((x) => x.code), ['INVALID_TYPE', 'NOT_IN_ENUM']);
});

test('TS-ERR-SCHEMA_INVALID: every malformed shape → ≥1 message; valid → []', () => {
  const bad = [
    [], null, 'str', 42,
    { A: { type: 'float' } },
    { A: { enum: [] } },
    { A: { enum: [1] } },
    { A: { enum: 'dev' } },
    { A: { required: 'yes' } },
    { A: { foo: 1 } },
    { A: 'rule' },
    { A: null },
    { A: [] },
  ];
  for (const s of bad) {
    const m = validateSchema(s);
    assert.ok(Array.isArray(m) && m.length >= 1, `expected messages for ${JSON.stringify(s)}`);
  }
  assert.deepEqual(validateSchema([]), ['schema must be a JSON object']);
  assert.deepEqual(validateSchema({ A: { foo: 1 } }), ['A: unknown property foo']);
  assert.deepEqual(validateSchema({ A: { type: 'float' } }), ['A: unknown type float']);
  assert.deepEqual(validateSchema({}), []);
  assert.deepEqual(
    validateSchema({ A: { required: true, type: 'int' }, B: { type: 'url' }, C: { enum: ['dev', 'test'] }, D: {} }),
    [],
  );
});

test('TS-REQ-duplicate: last pair for a key is the one judged', () => {
  const schema = { A: { type: 'int' } };
  assert.deepEqual(evaluate([{ key: 'A', value: 'x', line: 1 }, { key: 'A', value: '1', line: 2 }], schema), []);
  const f = evaluate([{ key: 'A', value: '1', line: 1 }, { key: 'A', value: 'x', line: 2 }], schema);
  assert.equal(f.length, 1);
  assert.equal(f[0].line, 2);
});

test('findings are returned in schema key order', () => {
  const f = evaluate(
    [{ key: 'B', value: 'x', line: 1 }],
    { C: { required: true }, B: { type: 'int' }, A: { required: true } },
  );
  assert.deepEqual(f.map((x) => x.key), ['C', 'B', 'A']);
});
