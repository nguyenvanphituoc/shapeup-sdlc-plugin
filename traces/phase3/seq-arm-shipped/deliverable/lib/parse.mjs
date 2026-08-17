const ASSIGNMENT_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function stripQuotes(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return value.slice(1, -1);
    }
  }
  return value;
}

export function parseEnv(text) {
  const pairs = new Map();
  const problems = [];

  const lines = text.split('\n');

  lines.forEach((rawLine, index) => {
    const line = index + 1;
    const trimmedLeading = rawLine.replace(/^\s*/, '');

    if (trimmedLeading === '' || trimmedLeading.startsWith('#')) {
      return;
    }

    const match = ASSIGNMENT_RE.exec(rawLine);
    if (!match) {
      problems.push({ line, rawText: rawLine });
      return;
    }

    const key = match[1].trim();
    let value = match[2].trim();
    value = stripQuotes(value);

    pairs.set(key, { key, value, line });
  });

  return { pairs, problems };
}
