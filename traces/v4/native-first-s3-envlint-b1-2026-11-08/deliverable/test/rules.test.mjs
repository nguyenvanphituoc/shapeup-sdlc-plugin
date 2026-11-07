import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkSchema, check } from '../src/rules.mjs';

test('exports checkSchema and check', () => {
  assert.equal(typeof checkSchema, 'function');
  assert.equal(typeof check, 'function');
});

test('TS-INV-01: rules.mjs imports no fs, network or parse module', () => {
  const src = readFileSync(new URL('../src/rules.mjs', import.meta.url), 'utf8');
  const imports = [...src.matchAll(/(?:import|from)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of imports) {
    assert.doesNotMatch(spec, /^(node:)?(fs|fs\/promises|http|https|http2|net|tls|dgram|dns)$/);
    assert.doesNotMatch(spec, /parse(\.mjs)?$/);
  }
  assert.doesNotMatch(src, /\brequire\s*\(|\bfetch\s*\(/);
});

test('TS-ERR-SCHEMA_INVALID: invalid shapes return reasons, valid returns []', () => {
  for (const bad of [[], { A: 1 }, { A: { type: 'float' } }, { A: { enum: 'x' } }, null, 'x', { A: { required: 'yes' } }, { A: { enum: [1] } }]) {
    const reasons = checkSchema(bad);
    assert.ok(Array.isArray(reasons) && reasons.length > 0, `expected reasons for ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(checkSchema({}), []);
  assert.deepEqual(checkSchema({ A: { required: true, type: 'int', enum: ['1', '2'] }, B: {} }), []);
});

test('TS-ERR-RULE_REQUIRED: missing required key → required finding, line null', () => {
  const findings = check([], { A: { required: true } });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].key, 'A');
  assert.equal(findings[0].rule, 'required');
  assert.equal(findings[0].line, null);
  assert.equal(typeof findings[0].message, 'string');
  assert.deepEqual(check([], { A: { required: false } }), []);
  assert.deepEqual(check([], { A: { type: 'int' } }), []);
});

test('TS-ERR-RULE_TYPE: bad values yield type findings with the pair line', () => {
  for (const [type, value] of [['int', '1.5'], ['bool', 'yes'], ['url', 'localhost']]) {
    const findings = check([{ key: 'K', value, line: 7 }], { K: { type } });
    assert.equal(findings.length, 1, `${type} ${value}`);
    assert.equal(findings[0].rule, 'type');
    assert.equal(findings[0].line, 7);
    assert.equal(findings[0].key, 'K');
  }
  for (const [type, value] of [['int', '-3'], ['bool', 'true'], ['bool', 'false'], ['url', 'https://x.y'], ['string', 'anything'], ['string', '']]) {
    assert.deepEqual(check([{ key: 'K', value, line: 1 }], { K: { type } }), [], `${type} ${value}`);
  }
});

test('TS-ERR-RULE_ENUM: value outside enum → enum finding; listed value → none', () => {
  const schema = { E: { enum: ['a', 'b'] } };
  const findings = check([{ key: 'E', value: 'c', line: 3 }], schema);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'enum');
  assert.equal(findings[0].line, 3);
  assert.deepEqual(check([{ key: 'E', value: 'a', line: 3 }], schema), []);
});

test('TS-INV-02: url judged by new URL() only, synchronously, no connection', () => {
  const result = check([{ key: 'U', value: 'https://nonexistent.invalid', line: 1 }], { U: { type: 'url' } });
  assert.ok(Array.isArray(result), 'returns synchronously, not a promise');
  assert.deepEqual(result, []);
  const src = readFileSync(new URL('../src/rules.mjs', import.meta.url), 'utf8');
  assert.match(src, /new URL\(/);
});

test('TS-REQ-duplicate-last: the last occurrence of a key is judged', () => {
  const pairs = [{ key: 'A', value: 'x', line: 1 }, { key: 'A', value: '1', line: 2 }];
  assert.deepEqual(check(pairs, { A: { type: 'int' } }), []);
  const reversed = [{ key: 'A', value: '1', line: 1 }, { key: 'A', value: 'x', line: 2 }];
  const findings = check(reversed, { A: { type: 'int' } });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});

test('keys not in schema are ignored; findings follow schema key order', () => {
  const pairs = [{ key: 'Z', value: 'q', line: 1 }, { key: 'B', value: 'no', line: 2 }];
  const findings = check(pairs, { A: { required: true }, B: { type: 'bool' } });
  assert.deepEqual(findings.map((f) => [f.key, f.rule]), [['A', 'required'], ['B', 'type']]);
});
