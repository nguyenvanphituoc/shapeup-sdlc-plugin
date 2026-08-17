// Rules engine: {pairs, problems} + schema in, Finding[] out. Never imports Parsing.

function isIntValid(value) {
  return /^-?\d+$/.test(value);
}

function isBoolValid(value) {
  return /^(true|false|1|0)$/i.test(value);
}

function isUrlValid(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValueValid(rule, value) {
  if (rule.type === 'int') return isIntValid(value);
  if (rule.type === 'bool') return isBoolValid(value);
  if (rule.type === 'url') return isUrlValid(value);
  if (rule.type === 'string') return true;
  if (rule.enum) return rule.enum.includes(value);
  return true;
}

/**
 * @param {{key: string, value: string, line: number}[]} pairs
 * @param {{line: number, text: string}[]} problems
 * @param {Object.<string, {required?: boolean, type?: string, enum?: string[]}>} schema
 * @returns {{line: number, key: string, message: string}[]}
 */
export function evaluate(pairs, problems, schema) {
  const findings = [];

  for (const problem of problems) {
    findings.push({
      line: problem.line,
      key: problem.text.slice(0, 30),
      message: 'not a KEY=VALUE assignment',
    });
  }

  // Dedup pairs: last occurrence in file order wins, per key.
  const lastByKey = new Map();
  for (const pair of pairs) {
    lastByKey.set(pair.key, pair);
  }

  for (const key of Object.keys(schema)) {
    const rule = schema[key];
    const pair = lastByKey.get(key);

    if (!pair) {
      if (rule.required) {
        findings.push({ line: 0, key, message: `${key} is required but missing` });
      }
      continue;
    }

    if (!isValueValid(rule, pair.value)) {
      findings.push({ line: pair.line, key, message: `${key} is invalid` });
    }
  }

  return findings;
}
