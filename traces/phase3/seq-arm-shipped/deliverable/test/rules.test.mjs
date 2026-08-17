import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRules } from '../lib/rules.mjs';

function pairsFrom(obj) {
  const m = new Map();
  for (const [key, { value, line }] of Object.entries(obj)) {
    m.set(key, { key, value, line });
  }
  return m;
}

test('TS-UC02-01: int type — "01" passes; "1.5", "1e3", "" fail', () => {
  const schema = { A: { type: 'int' }, B: { type: 'int' }, C: { type: 'int' }, D: { type: 'int' } };
  const pairs = pairsFrom({
    A: { value: '01', line: 1 },
    B: { value: '1.5', line: 2 },
    C: { value: '1e3', line: 3 },
    D: { value: '', line: 4 },
  });
  const { findings } = checkRules({ pairs, problems: [] }, schema);
  const failedKeys = findings.map((f) => f.key);
  assert.equal(failedKeys.includes('A'), false);
  assert.equal(failedKeys.includes('B'), true);
  assert.equal(failedKeys.includes('C'), true);
  assert.equal(failedKeys.includes('D'), true);
});

test('TS-UC02-01b: int also accepts "0" and "-1"', () => {
  const schema = { A: { type: 'int' }, B: { type: 'int' } };
  const pairs = pairsFrom({ A: { value: '0', line: 1 }, B: { value: '-1', line: 2 } });
  const { findings } = checkRules({ pairs, problems: [] }, schema);
  assert.equal(findings.length, 0);
});

test('TS-UC02-02: bool accepts true/false/1/0 case-insensitively; rejects "yes"', () => {
  const schema = { A: { type: 'bool' }, B: { type: 'bool' }, C: { type: 'bool' }, D: { type: 'bool' }, E: { type: 'bool' } };
  const pairs = pairsFrom({
    A: { value: 'TRUE', line: 1 },
    B: { value: 'false', line: 2 },
    C: { value: '1', line: 3 },
    D: { value: '0', line: 4 },
    E: { value: 'yes', line: 5 },
  });
  const { findings } = checkRules({ pairs, problems: [] }, schema);
  const failedKeys = findings.map((f) => f.key);
  assert.equal(failedKeys.includes('A'), false);
  assert.equal(failedKeys.includes('B'), false);
  assert.equal(failedKeys.includes('C'), false);
  assert.equal(failedKeys.includes('D'), false);
  assert.equal(failedKeys.includes('E'), true);
});

test('TS-UC02-03: url accepts http/https, rejects ftp and unparsable strings without throwing', () => {
  const schema = {
    A: { type: 'url' },
    B: { type: 'url' },
    C: { type: 'url' },
    D: { type: 'url' },
    E: { type: 'url' },
  };
  const pairs = pairsFrom({
    A: { value: 'http://a.com', line: 1 },
    B: { value: 'https://a.com', line: 2 },
    C: { value: 'ftp://a.com', line: 3 },
    D: { value: 'not a url', line: 4 },
    E: { value: 'http://', line: 5 },
  });
  let result;
  assert.doesNotThrow(() => {
    result = checkRules({ pairs, problems: [] }, schema);
  });
  const failedKeys = result.findings.map((f) => f.key);
  assert.equal(failedKeys.includes('A'), false);
  assert.equal(failedKeys.includes('B'), false);
  assert.equal(failedKeys.includes('C'), true);
  assert.equal(failedKeys.includes('D'), true);
  assert.equal(failedKeys.includes('E'), true);
});

test('TS-UC02-04: string type accepts any value including empty', () => {
  const schema = { A: { type: 'string' }, B: { type: 'string' } };
  const pairs = pairsFrom({ A: { value: 'anything', line: 1 }, B: { value: '', line: 2 } });
  const { findings } = checkRules({ pairs, problems: [] }, schema);
  assert.equal(findings.length, 0);
});

test('TS-UC02-05: enum accepts an exact listed value, rejects anything else', () => {
  const schema = { A: { enum: ['dev', 'prod'] }, B: { enum: ['dev', 'prod'] } };
  const pairs = pairsFrom({ A: { value: 'dev', line: 1 }, B: { value: 'staging', line: 2 } });
  const { findings } = checkRules({ pairs, problems: [] }, schema);
  const failedKeys = findings.map((f) => f.key);
  assert.equal(failedKeys.includes('A'), false);
  assert.equal(failedKeys.includes('B'), true);
});

test('TS-UC02-06: KEY= (empty value) passes string, fails int/bool/url/enum', () => {
  const schema = {
    S: { type: 'string' },
    I: { type: 'int' },
    B: { type: 'bool' },
    U: { type: 'url' },
    E: { enum: ['a', 'b'] },
  };
  const pairs = pairsFrom({
    S: { value: '', line: 1 },
    I: { value: '', line: 2 },
    B: { value: '', line: 3 },
    U: { value: '', line: 4 },
    E: { value: '', line: 5 },
  });
  const { findings } = checkRules({ pairs, problems: [] }, schema);
  const failedKeys = findings.map((f) => f.key);
  assert.equal(failedKeys.includes('S'), false);
  assert.equal(failedKeys.includes('I'), true);
  assert.equal(failedKeys.includes('B'), true);
  assert.equal(failedKeys.includes('U'), true);
  assert.equal(failedKeys.includes('E'), true);
});

test('TS-UC02-07: key present in file but absent from schema → no finding', () => {
  const schema = {};
  const pairs = pairsFrom({ EXTRA: { value: 'x', line: 1 } });
  const { findings, checked } = checkRules({ pairs, problems: [] }, schema);
  assert.equal(findings.length, 0);
  assert.equal(checked, 0);
});

test('TS-UC02-08: zero-assignment input + required key → finding, line 0, ok false', () => {
  const schema = { REQ: { required: true, type: 'string' } };
  const pairs = pairsFrom({});
  const { findings, ok } = checkRules({ pairs, problems: [] }, schema);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].key, 'REQ');
  assert.equal(findings[0].line, 0);
  assert.equal(ok, false);
});

test('TS-UC02-09: checked === Object.keys(schema).length regardless of pairs contents', () => {
  const schema = { A: { type: 'string' }, B: { type: 'int' }, C: { required: true } };
  assert.equal(checkRules({ pairs: pairsFrom({}), problems: [] }, schema).checked, 3);
  assert.equal(
    checkRules({ pairs: pairsFrom({ A: { value: 'x', line: 1 } }), problems: [] }, schema).checked,
    3
  );
  assert.equal(checkRules({ pairs: new Map(), problems: [] }, {}).checked, 0);
});

test('TS-UC02-10: duplicate key resolution already done upstream — checks only last value', () => {
  // pairs already holds the winning (last) value per lib/parse.mjs contract.
  const schema = { KEY: { type: 'int' } };
  const pairs = pairsFrom({ KEY: { value: '42', line: 2 } });
  const { findings } = checkRules({ pairs, problems: [] }, schema);
  assert.equal(findings.length, 0);
});

test('TS-UC02-11: url check never performs a network request (string/protocol shape only)', () => {
  const schema = { A: { type: 'url' } };
  const pairs = pairsFrom({ A: { value: 'https://example.invalid.doesnotexist', line: 1 } });
  const { findings } = checkRules({ pairs, problems: [] }, schema);
  assert.equal(findings.length, 0);
});

test('problems become findings with empty key and "not a KEY=VALUE assignment"', () => {
  const problems = [{ line: 2, rawText: 'nonsense' }];
  const { findings } = checkRules({ pairs: new Map(), problems }, {});
  assert.equal(findings.length, 1);
  assert.equal(findings[0].key, '');
  assert.equal(findings[0].line, 2);
  assert.equal(findings[0].message, 'not a KEY=VALUE assignment');
});

test('empty schema and empty pairs → ok true, checked 0, findings empty', () => {
  const { findings, checked, ok } = checkRules({ pairs: new Map(), problems: [] }, {});
  assert.equal(findings.length, 0);
  assert.equal(checked, 0);
  assert.equal(ok, true);
});

test('lib/rules.mjs has zero imports of lib/parse.mjs', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../lib/rules.mjs', import.meta.url), 'utf8');
  assert.equal(/from\s+['"].*parse\.mjs['"]/.test(src), false);
});
