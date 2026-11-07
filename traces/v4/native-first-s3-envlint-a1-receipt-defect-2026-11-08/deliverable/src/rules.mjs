// Pure schema rules: check(pairs, schema) -> findings. Shape per the env-pairs contract.

const TYPE_CHECKS = {
  string: () => true,
  int: (v) => /^-?\d+$/.test(v),
  bool: (v) => v === 'true' || v === 'false',
  url: (v) => {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  },
};

export function check(pairs, schema) {
  const findings = [];
  const present = new Set(pairs.map((p) => p.key));

  for (const [key, rule] of Object.entries(schema)) {
    if (rule && rule.required === true && !present.has(key)) {
      findings.push({ key, line: null, code: 'MISSING_REQUIRED', message: `${key} is required but missing` });
    }
  }

  for (const { key, value, line } of pairs) {
    if (!Object.hasOwn(schema, key)) continue;
    const rule = schema[key] || {};
    const test = TYPE_CHECKS[rule.type];
    if (rule.type && test && !test(value)) {
      findings.push({ key, line, code: 'TYPE_MISMATCH', message: `${key} must be ${rule.type}, got "${value}"` });
    }
    if (Array.isArray(rule.enum) && !rule.enum.includes(value)) {
      findings.push({ key, line, code: 'NOT_IN_ENUM', message: `${key} must be one of ${rule.enum.join(', ')}, got "${value}"` });
    }
  }

  return findings;
}
