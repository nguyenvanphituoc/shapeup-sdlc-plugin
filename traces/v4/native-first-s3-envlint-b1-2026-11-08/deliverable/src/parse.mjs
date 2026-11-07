// Pure .env parser (UC-ParseEnv). Shapes per shapeup/envlint/spec/domain-model.md#Value Objects:
//   EnvPair      { key, value, line }   line is 1-based
//   ParseProblem { line, message }      line is 1-based
// Pure: no imports at all (INV-01). Never throws on string input (INV-02).

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parse(text) {
  const pairs = [];
  const problems = [];
  const lines = String(text ?? "").split(/\r?\n/);

  lines.forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;

    const body = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
    const eq = body.indexOf("=");
    if (eq === -1) {
      problems.push({ line, message: 'PARSE_NO_EQUALS: line has no "="' });
      return;
    }

    const key = body.slice(0, eq).trim();
    if (!KEY_RE.test(key)) {
      problems.push({ line, message: `PARSE_BAD_KEY: invalid key "${key}"` });
      return;
    }

    let value = body.slice(eq + 1).trim();
    const q = value[0];
    if (q === '"' || q === "'") {
      if (value.length < 2 || value[value.length - 1] !== q) {
        problems.push({ line, message: `PARSE_UNCLOSED_QUOTE: unclosed ${q} quote` });
        return;
      }
      value = value.slice(1, -1);
    }

    pairs.push({ key, value, line });
  });

  return { pairs, problems };
}
