import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../lib/parse.mjs';

test('TS-UC01-01: comment and blank lines produce no pairs/problems entry', () => {
  const { pairs, problems } = parseEnv('# a comment\n\nKEY=value\n');
  assert.equal(pairs.size, 1);
  assert.equal(problems.length, 0);
  assert.equal(pairs.get('KEY').value, 'value');
});

test('TS-UC01-02: export KEY=value parses identically to KEY=value', () => {
  const a = parseEnv('export KEY=value');
  const b = parseEnv('KEY=value');
  assert.equal(a.pairs.get('KEY').value, b.pairs.get('KEY').value);
  assert.equal(a.pairs.get('KEY').key, 'KEY');
});

test('TS-UC01-03: KEY="value" strips matching double quotes', () => {
  const { pairs } = parseEnv('KEY="value"');
  assert.equal(pairs.get('KEY').value, 'value');
});

test("TS-UC01-04: KEY='value' strips matching single quotes", () => {
  const { pairs } = parseEnv("KEY='value'");
  assert.equal(pairs.get('KEY').value, 'value');
});

test('TS-UC01-05: KEY="value (unterminated) keeps leading quote', () => {
  const { pairs } = parseEnv('KEY="value');
  assert.equal(pairs.get('KEY').value, '"value');
});

test('TS-UC01-06: whitespace around key and value trimmed', () => {
  const { pairs } = parseEnv('  SPACED  =  hi  ');
  assert.equal(pairs.has('SPACED'), true);
  assert.equal(pairs.get('SPACED').value, 'hi');
});

test('TS-UC01-07: duplicate key - later assignment wins, no problems entry', () => {
  const { pairs, problems } = parseEnv('KEY=first\nKEY=second\n');
  assert.equal(pairs.get('KEY').value, 'second');
  assert.equal(pairs.get('KEY').line, 2);
  assert.equal(problems.length, 0);
});

test('TS-UC01-08: malformed line added to problems with correct line and rawText', () => {
  const { problems } = parseEnv('KEY=value\nnot a valid line\n');
  assert.equal(problems.length, 1);
  assert.equal(problems[0].line, 2);
  assert.equal(problems[0].rawText, 'not a valid line');
});

test('TS-UC01-09: zero-assignment input returns empty pairs and problems', () => {
  const empty = parseEnv('');
  assert.equal(empty.pairs.size, 0);
  assert.equal(empty.problems.length, 0);

  const commentsOnly = parseEnv('# comment\n\n# another\n');
  assert.equal(commentsOnly.pairs.size, 0);
  assert.equal(commentsOnly.problems.length, 0);
});

test('TS-UC01-10: never throws for any string input', () => {
  assert.doesNotThrow(() => parseEnv(''));
  assert.doesNotThrow(() => parseEnv('==='));
  assert.doesNotThrow(() => parseEnv('\0\0\0'));
  assert.doesNotThrow(() => parseEnv('KEY=""'));
});

test('empty value after quote-stripping', () => {
  const { pairs } = parseEnv('KEY=""');
  assert.equal(pairs.get('KEY').value, '');
});
