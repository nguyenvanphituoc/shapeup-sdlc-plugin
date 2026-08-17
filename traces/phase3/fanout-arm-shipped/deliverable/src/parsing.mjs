// Parsing engine: pure text -> { pairs, problems }. Never imports Rules.

/**
 * @typedef {{ key: string, value: string, line: number }} EnvPair
 * @typedef {{ line: number, text: string }} ParseProblem
 */

const EXPORT_PREFIX_RE = /^export\s+(.*)$/;

/**
 * Strip matching surrounding quotes from a value. If the value starts with a
 * quote but does not end with the same quote, it is left untouched.
 * @param {string} value
 * @returns {string}
 */
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

/**
 * @param {string} text
 * @returns {{ pairs: EnvPair[], problems: ParseProblem[] }}
 */
export function parseEnv(text) {
  const pairs = [];
  const problems = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNo = i + 1;
    const trimmed = rawLine.trim();

    if (trimmed === '') continue;
    if (trimmed.startsWith('#')) continue;

    let candidate = trimmed;
    const exportMatch = EXPORT_PREFIX_RE.exec(trimmed);
    if (exportMatch) {
      candidate = exportMatch[1];
    }

    const eqIndex = candidate.indexOf('=');
    if (eqIndex === -1) {
      problems.push({ line: lineNo, text: rawLine });
      continue;
    }

    const key = candidate.slice(0, eqIndex).trim();
    if (key === '') {
      problems.push({ line: lineNo, text: rawLine });
      continue;
    }

    const rawValue = candidate.slice(eqIndex + 1).trim();
    const value = stripQuotes(rawValue);

    pairs.push({ key, value, line: lineNo });
  }

  return { pairs, problems };
}
