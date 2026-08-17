// Parsing engine — pure function, text in, { pairs, problems } out.
// Never imports Rules (src/rules.mjs) or the CLI (bin/envlint.mjs).

/**
 * @typedef {{ key: string, value: string, line: number }} EnvPair
 * @typedef {{ line: number, text: string }} ParseProblem
 */

const ASSIGNMENT_RE = /^(?:export\s+)?([^=\s][^=]*?)\s*=\s*(.*)$/;

/**
 * Strip matching surrounding quotes (single or double) from a value.
 * A leading quote with no matching trailing quote is left untouched.
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
  /** @type {EnvPair[]} */
  const pairs = [];
  /** @type {ParseProblem[]} */
  const problems = [];

  if (text === '') {
    return { pairs, problems };
  }

  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNumber = i + 1;
    const trimmed = rawLine.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const match = ASSIGNMENT_RE.exec(trimmed);
    if (!match) {
      problems.push({ line: lineNumber, text: rawLine });
      continue;
    }

    const key = match[1].trim();
    const rawValue = match[2].trim();
    const value = stripQuotes(rawValue);

    pairs.push({ key, value, line: lineNumber });
  }

  return { pairs, problems };
}
