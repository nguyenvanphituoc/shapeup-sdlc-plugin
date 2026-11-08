// Pure .env parser. Contract: shapeup/envlint/spec/domain-model.md, C1 (ParseResult).
// No imports, no I/O: text in, { pairs, problems } out.

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const EXPORT_RE = /^export[ \t]+/;

export function parseEnv(text) {
  const pairs = [];
  const problems = [];
  let src = String(text);
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);

  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = i + 1;
    let raw = lines[i];
    if (raw.endsWith('\r')) raw = raw.slice(0, -1);

    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const body = trimmed.replace(EXPORT_RE, '');
    const eq = body.indexOf('=');
    if (eq === -1) {
      problems.push({ line, message: "missing '='" });
      continue;
    }

    const key = body.slice(0, eq).trim();
    if (!KEY_RE.test(key)) {
      problems.push({ line, message: 'invalid key' });
      continue;
    }

    let value = body.slice(eq + 1).trim();
    const q = value[0];
    if (q === '"' || q === "'") {
      if (value.length < 2 || value[value.length - 1] !== q) {
        problems.push({ line, message: 'unterminated quote' });
        continue;
      }
      value = value.slice(1, -1);
    }

    pairs.push({ key, value, line });
  }

  return { pairs, problems };
}
