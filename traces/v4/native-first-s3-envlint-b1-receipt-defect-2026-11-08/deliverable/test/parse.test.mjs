import { test } from 'node:test';
import assert from 'node:assert';
import { parse } from '../src/parse.mjs';

const problem = (text) => parse(text).problems;

test('returns { pairs, problems } with KEY=value at its 1-based line', () => {
  assert.deepStrictEqual(parse('KEY=value'), { pairs: [{ key: 'KEY', value: 'value', line: 1 }], problems: [] });
});

test('TS-INV-01 parse is deterministic', () => {
  const text = 'A=1\n# c\nB="x\\ny"\nbad line\n';
  assert.deepStrictEqual(parse(text), parse(text));
});

test('TS-INV-02 / REQ-27 ${VAR} and $VAR are returned literally', () => {
  assert.deepStrictEqual(parse('A=${B}\nC=$D').pairs, [
    { key: 'A', value: '${B}', line: 1 },
    { key: 'C', value: '$D', line: 2 },
  ]);
});

test('TS-INV-03 / REQ-13 line numbers survive blanks and comments', () => {
  const r = parse('A=1\n\n# comment\nnope\n   \nB=2');
  assert.deepStrictEqual(r.pairs, [
    { key: 'A', value: '1', line: 1 },
    { key: 'B', value: '2', line: 6 },
  ]);
  assert.deepStrictEqual(r.problems, [{ line: 4, message: 'expected KEY=value' }]);
});

test('TS-ERR-NO_EQUALS', () => {
  assert.deepStrictEqual(parse('JUSTAKEY'), { pairs: [], problems: [{ line: 1, message: 'expected KEY=value' }] });
});

test('TS-ERR-INVALID_KEY', () => {
  assert.deepStrictEqual(problem('1BAD=x'), [{ line: 1, message: 'invalid key' }]);
  assert.deepStrictEqual(problem('OK=1\nBA-D=x'), [{ line: 2, message: 'invalid key' }]);
});

test('TS-ERR-UNTERMINATED_SINGLE', () => {
  assert.deepStrictEqual(problem("A='abc"), [{ line: 1, message: 'unterminated single quote' }]);
});

test('TS-ERR-UNTERMINATED_DOUBLE', () => {
  assert.deepStrictEqual(problem('A="abc'), [{ line: 1, message: 'unterminated double quote' }]);
  assert.deepStrictEqual(problem('A="abc\\"'), [{ line: 1, message: 'unterminated double quote' }]);
});

test('TS-ERR-TRAILING_AFTER_QUOTE', () => {
  assert.deepStrictEqual(problem("A='x' y"), [{ line: 1, message: 'unexpected text after closing quote' }]);
  assert.deepStrictEqual(problem('A="x"y'), [{ line: 1, message: 'unexpected text after closing quote' }]);
});

test('a line yields a problem or a pair, never both', () => {
  assert.deepStrictEqual(parse("A='x' y").pairs, []);
});

test('TS-REQ-forms', () => {
  const text = ['KEY=value', 'export KEY=value', "A='x # y'", 'B="a\\nb"', 'C=v # c', '# c', ''].join('\n');
  assert.deepStrictEqual(parse(text), {
    pairs: [
      { key: 'KEY', value: 'value', line: 1 },
      { key: 'KEY', value: 'value', line: 2 },
      { key: 'A', value: 'x # y', line: 3 },
      { key: 'B', value: 'a\nb', line: 4 },
      { key: 'C', value: 'v', line: 5 },
    ],
    problems: [],
  });
});

test('REQ-15 single quotes are literal; double quotes unescape \\n \\" \\\\ only', () => {
  assert.deepStrictEqual(parse("A='a\\nb \"q\"'").pairs, [{ key: 'A', value: 'a\\nb "q"', line: 1 }]);
  assert.deepStrictEqual(parse('B="say \\"hi\\" \\\\ \\t # not comment"').pairs, [
    { key: 'B', value: 'say "hi" \\ \\t # not comment', line: 1 },
  ]);
  assert.deepStrictEqual(parse('C="v" # trailing comment').pairs, [{ key: 'C', value: 'v', line: 1 }]);
});

test('REQ-12 unquoted trailing comment stripped; # without preceding space kept', () => {
  assert.deepStrictEqual(parse('A=x#y\nB=x   # c').pairs, [
    { key: 'A', value: 'x#y', line: 1 },
    { key: 'B', value: 'x', line: 2 },
  ]);
});

test('TS-REQ-empty / REQ-6', () => {
  assert.deepStrictEqual(parse(''), { pairs: [], problems: [] });
  assert.deepStrictEqual(parse('# only\n  # comments\n'), { pairs: [], problems: [] });
});

test('CRLF matches LF; KEY= yields empty value; duplicates kept', () => {
  const lf = 'A=1\nexport B="x"\nC=\nA=2\n';
  assert.deepStrictEqual(parse(lf.replaceAll('\n', '\r\n')), parse(lf));
  assert.deepStrictEqual(parse(lf).pairs, [
    { key: 'A', value: '1', line: 1 },
    { key: 'B', value: 'x', line: 2 },
    { key: 'C', value: '', line: 3 },
    { key: 'A', value: '2', line: 4 },
  ]);
});
