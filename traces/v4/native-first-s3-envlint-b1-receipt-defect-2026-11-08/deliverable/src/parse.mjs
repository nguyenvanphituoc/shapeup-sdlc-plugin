// Pure .env parser — implements UC-ParseEnvText (shapeup/envlint/spec/usecases/UC-ParseEnvText.md).
// Pair / ParseProblem shapes: shapeup/envlint/spec/domain-model.md#Value Objects.

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const AFTER_QUOTE_RE = /^\s*(#.*)?$/;
const ESCAPES = { n: '\n', '"': '"', '\\': '\\' };

function closeQuoted(value, rest) {
  return AFTER_QUOTE_RE.test(rest) ? { value } : { error: 'unexpected text after closing quote' };
}

function parseValue(raw) {
  if (raw.startsWith("'")) {
    const end = raw.indexOf("'", 1);
    if (end === -1) return { error: 'unterminated single quote' };
    return closeQuoted(raw.slice(1, end), raw.slice(end + 1));
  }
  if (raw.startsWith('"')) {
    let value = '';
    for (let i = 1; i < raw.length; i++) {
      const c = raw[i];
      if (c === '"') return closeQuoted(value, raw.slice(i + 1));
      if (c === '\\' && i + 1 < raw.length && ESCAPES[raw[i + 1]] !== undefined) {
        value += ESCAPES[raw[i + 1]];
        i++;
        continue;
      }
      value += c;
    }
    return { error: 'unterminated double quote' };
  }
  const cut = raw.search(/\s#/);
  return { value: (cut === -1 ? raw : raw.slice(0, cut)).trimEnd() };
}

export function parse(text) {
  const pairs = [];
  const problems = [];
  text.split('\n').forEach((rawLine, i) => {
    const line = i + 1;
    let s = (rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine).trim();
    if (s === '' || s.startsWith('#')) return;
    const exp = /^export\s+/.exec(s);
    if (exp) s = s.slice(exp[0].length);
    const eq = s.indexOf('=');
    if (eq === -1) {
      problems.push({ line, message: 'expected KEY=value' });
      return;
    }
    const key = s.slice(0, eq).trim();
    if (!KEY_RE.test(key)) {
      problems.push({ line, message: 'invalid key' });
      return;
    }
    const result = parseValue(s.slice(eq + 1).trimStart());
    if (result.error) problems.push({ line, message: result.error });
    else pairs.push({ key, value: result.value, line });
  });
  return { pairs, problems };
}
