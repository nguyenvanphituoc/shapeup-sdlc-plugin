import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../src/parsing.mjs';

test('comments and blank lines produce neither a pair nor a problem', () => {
  const { pairs, problems } = parseEnv('# a comment\n\nFOO=bar\n\n# another\n');
  assert.deepEqual(pairs, [{ key: 'FOO', value: 'bar', line: 3 }]);
  assert.deepEqual(problems, []);
});

test('export KEY=value parses identically to KEY=value', () => {
  const a = parseEnv('export FOO=bar');
  const b = parseEnv('FOO=bar');
  assert.deepEqual(a.pairs, [{ key: 'FOO', value: 'bar', line: 1 }]);
  assert.deepEqual(b.pairs, [{ key: 'FOO', value: 'bar', line: 1 }]);
});

test('export KEY="value" strips both export prefix and matching quotes', () => {
  const { pairs } = parseEnv('export FOO="bar"');
  assert.deepEqual(pairs, [{ key: 'FOO', value: 'bar', line: 1 }]);
});

test('KEY="value" / KEY=\'value\' strip matching surrounding quotes only', () => {
  const dq = parseEnv('FOO="bar"');
  const sq = parseEnv("FOO='bar'");
  assert.equal(dq.pairs[0].value, 'bar');
  assert.equal(sq.pairs[0].value, 'bar');
});

test('KEY="value (no closing quote) is left untouched', () => {
  const { pairs } = parseEnv('FOO="bar');
  assert.equal(pairs[0].value, '"bar');
});

test('whitespace around KEY and value is trimmed (outside quotes)', () => {
  const { pairs } = parseEnv('  FOO   =   bar  ');
  assert.deepEqual(pairs, [{ key: 'FOO', value: 'bar', line: 1 }]);
});

test('invalid line produces a ParseProblem with correct line number and raw untrimmed text', () => {
  const { problems } = parseEnv('FOO=bar\nnot an assignment at all\nBAZ=qux');
  assert.deepEqual(problems, [{ line: 2, text: 'not an assignment at all' }]);
});

test('ParseProblem preserves raw untrimmed indentation', () => {
  const { problems } = parseEnv('   not valid   ');
  assert.deepEqual(problems, [{ line: 1, text: '   not valid   ' }]);
});

test('a key assigned more than once produces one EnvPair per occurrence, in file order', () => {
  const { pairs } = parseEnv('FOO=one\nFOO=two');
  assert.deepEqual(pairs, [
    { key: 'FOO', value: 'one', line: 1 },
    { key: 'FOO', value: 'two', line: 2 },
  ]);
});

test('every EnvPair/ParseProblem carries the correct 1-based line number', () => {
  const { pairs, problems } = parseEnv('FOO=bar\nnope\nBAZ=qux');
  assert.equal(pairs[0].line, 1);
  assert.equal(problems[0].line, 2);
  assert.equal(pairs[1].line, 3);
});

test('line 1 is reported as 1, and last line with no trailing newline is parsed and numbered', () => {
  const { pairs } = parseEnv('FOO=bar\nBAZ=qux');
  assert.equal(pairs[0].line, 1);
  assert.equal(pairs[1].line, 2);
});

test('an entirely empty file returns { pairs: [], problems: [] }', () => {
  const result = parseEnv('');
  assert.deepEqual(result, { pairs: [], problems: [] });
});

test('a file that is only comments/blank lines returns { pairs: [], problems: [] }', () => {
  const result = parseEnv('# just comments\n\n   \n# more\n');
  assert.deepEqual(result, { pairs: [], problems: [] });
});
