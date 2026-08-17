const INT_RE = /^-?\d+$/;
const BOOL_RE = /^(true|false|1|0)$/i;

function checkType(value, rule) {
  if (Array.isArray(rule.enum)) {
    return rule.enum.includes(value);
  }
  const type = rule.type || 'string';
  switch (type) {
    case 'string':
      return true;
    case 'int':
      return INT_RE.test(value);
    case 'bool':
      return BOOL_RE.test(value);
    case 'url': {
      try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }
    default:
      return true;
  }
}

export function checkRules({ pairs, problems }, schema) {
  const findings = [];

  for (const p of problems) {
    findings.push({ key: '', line: p.line, message: 'not a KEY=VALUE assignment' });
  }

  for (const [key, rule] of Object.entries(schema)) {
    const entry = pairs.get(key);
    if (rule.required && !entry) {
      findings.push({ key, line: 0, message: 'required key missing' });
      continue;
    }
    if (entry) {
      const ok = checkType(entry.value, rule);
      if (!ok) {
        findings.push({ key, line: entry.line, message: `value does not satisfy type "${rule.type || 'string'}"` });
      }
    }
  }

  return {
    findings,
    checked: Object.keys(schema).length,
    ok: findings.length === 0,
  };
}
