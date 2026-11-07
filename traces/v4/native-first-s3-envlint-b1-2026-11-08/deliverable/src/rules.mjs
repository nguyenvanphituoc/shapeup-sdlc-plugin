// Schema rules for envlint — pure: no file system, no network, no parse import.
// Contract: shapeup/envlint/spec/usecases/UC-CheckRules.md (Schema, Finding).

const TYPES = ['string', 'int', 'bool', 'url'];

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Returns a list of reasons the schema is invalid; [] means valid (PD-7).
export function checkSchema(schema) {
  if (!isObject(schema)) return ['schema must be a JSON object of KEY → rule'];
  const reasons = [];
  for (const [key, rule] of Object.entries(schema)) {
    if (!isObject(rule)) {
      reasons.push(`${key}: rule must be an object`);
      continue;
    }
    if ('required' in rule && typeof rule.required !== 'boolean') {
      reasons.push(`${key}: required must be a boolean`);
    }
    if ('type' in rule && !TYPES.includes(rule.type)) {
      reasons.push(`${key}: type must be one of ${TYPES.join(', ')}`);
    }
    if ('enum' in rule && !(Array.isArray(rule.enum) && rule.enum.every((e) => typeof e === 'string'))) {
      reasons.push(`${key}: enum must be an array of strings`);
    }
  }
  return reasons;
}

function isUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const TYPE_CHECKS = {
  string: () => true,
  int: (v) => /^-?[0-9]+$/.test(v),
  bool: (v) => v === 'true' || v === 'false',
  url: isUrl,
};

// Returns one Finding per violation, in schema key order.
export function check(pairs, schema) {
  const last = new Map();
  for (const pair of pairs) last.set(pair.key, pair);

  const findings = [];
  for (const [key, rule] of Object.entries(schema)) {
    const pair = last.get(key);
    if (!pair) {
      if (rule.required === true) {
        findings.push({ key, line: null, rule: 'required', message: 'required key is missing' });
      }
      continue;
    }
    if (rule.type && !TYPE_CHECKS[rule.type](pair.value)) {
      findings.push({ key, line: pair.line, rule: 'type', message: `expected ${rule.type}, got "${pair.value}"` });
    }
    if (rule.enum && !rule.enum.includes(pair.value)) {
      findings.push({ key, line: pair.line, rule: 'enum', message: `expected one of ${rule.enum.join(', ')}, got "${pair.value}"` });
    }
  }
  return findings;
}
