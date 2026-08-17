import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../src/parsing.mjs';

test('comments and blank lines produce neither a pair nor a problem', () => {
  const { pairs, problems } = parseEnv('# a comment\n\nKEY=value\n   \n# another');
  assert.deepEqual(pairs, [{ key: 'KEY', value: 'value', line: 3 }]);
  assert.deepEqual(problems, []);
});

test('export KEY=value parses identically to KEY=value', () => {
  const a = parseEnv('export KEY=value');
  const b = parseEnv('KEY=value');
  assert.deepEqual(a.pairs, [{ key: 'KEY', value: 'value', line: 1 }]);
  assert.deepEqual(b.pairs, [{ key: 'KEY', value: 'value', line: 1 }]);
});

test('export KEY="value" strips both export prefix and matching quotes', () => {
  const { pairs } = parseEnv('export KEY="value"');
  assert.deepEqual(pairs, [{ key: 'KEY', value: 'value', line: 1 }]);
});

test('KEY="value" / KEY=\'value\' strip matching surrounding quotes only', () => {
  const dbl = parseEnv('KEY="value"');
  const sgl = parseEnv("KEY='value'");
  assert.equal(dbl.pairs[0].value, 'value');
  assert.equal(sgl.pairs[0].value, 'value');
});

test('KEY="value (no closing quote) is left untouched', () => {
  const { pairs } = parseEnv('KEY="value');
  assert.equal(pairs[0].value, '"value');
});

test('whitespace around KEY and value is trimmed (outside quotes)', () => {
  const { pairs } = parseEnv('  KEY  =   value  ');
  assert.deepEqual(pairs, [{ key: 'KEY', value: 'value', line: 1 }]);
});

test('invalid line produces a ParseProblem with correct line number and raw untrimmed text', () => {
  const { problems, pairs } = parseEnv('KEY=value\nnot an assignment at all\nOTHER=1');
  assert.deepEqual(pairs, [
    { key: 'KEY', value: 'value', line: 1 },
    { key: 'OTHER', value: '1', line: 3 },
  ]);
  assert.deepEqual(problems, [{ line: 2, text: 'not an assignment at all' }]);
});

test('ParseProblem preserves raw untrimmed indentation', () => {
  const { problems } = parseEnv('   not valid   ');
  assert.deepEqual(problems, [{ line: 1, text: '   not valid   ' }]);
});

test('a key assigned more than once produces one EnvPair per occurrence, in file order', () => {
  const { pairs } = parseEnv('PORT=abc\nPORT=8080');
  assert.deepEqual(pairs, [
    { key: 'PORT', value: 'abc', line: 1 },
    { key: 'PORT', value: '8080', line: 2 },
  ]);
});

test('every EnvPair/ParseProblem carries the correct 1-based line number', () => {
  const { pairs, problems } = parseEnv('A=1\nB=2\nbad line\nC=3');
  assert.equal(pairs[0].line, 1);
  assert.equal(pairs[1].line, 2);
  assert.equal(problems[0].line, 3);
  assert.equal(pairs[2].line, 4);
});

test('line 1 is reported as 1, and last line with no trailing newline is parsed and numbered', () => {
  const { pairs } = parseEnv('A=1\nB=2');
  assert.equal(pairs[0].line, 1);
  assert.equal(pairs[1].line, 2);
});

test('an entirely empty file returns { pairs: [], problems: [] }', () => {
  const result = parseEnv('');
  assert.deepEqual(result, { pairs: [], problems: [] });
});

test('a file that is only comments/blank lines returns { pairs: [], problems: [] }', () => {
  const result = parseEnv('# comment\n\n   \n# another comment');
  assert.deepEqual(result, { pairs: [], problems: [] });
});
