// Schema validation and rule evaluation — pure, no I/O.
// Contract: shapeup/envlint/spec/domain-model.md (Module Interfaces, Value Types)
// and shapeup/envlint/spec/usecases/UC-EvaluateRules.md (Steps).
// Written against the Pair shape { key, value, line }; imports no other module.

const TYPES = ['string', 'int', 'bool', 'url'];
const RULE_PROPS = ['required', 'type', 'enum'];

function isPlainObject(v) {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

const PREDICATES = {
  string: () => true,
  int: (v) => /^[+-]?[0-9]+$/.test(v),
  bool: (v) => /^(true|false|1|0)$/i.test(v),
  url: (v) => {
    if (!v.includes('://') || !URL.canParse(v)) return false;
    return new URL(v).host !== '';
  },
};

export function validateSchema(schema) {
  if (!isPlainObject(schema)) return ['schema must be a JSON object'];
  const messages = [];
  for (const key of Object.keys(schema)) {
    const rule = schema[key];
    if (!isPlainObject(rule)) {
      messages.push(`${key}: rule must be an object`);
      continue;
    }
    if (Object.hasOwn(rule, 'required') && typeof rule.required !== 'boolean') {
      messages.push(`${key}: required must be true or false`);
    }
    if (Object.hasOwn(rule, 'type') && !TYPES.includes(rule.type)) {
      messages.push(`${key}: unknown type ${rule.type}`);
    }
    if (
      Object.hasOwn(rule, 'enum') &&
      !(Array.isArray(rule.enum) && rule.enum.length > 0 && rule.enum.every((e) => typeof e === 'string'))
    ) {
      messages.push(`${key}: enum must be a non-empty array of strings`);
    }
    for (const prop of Object.keys(rule)) {
      if (!RULE_PROPS.includes(prop)) messages.push(`${key}: unknown property ${prop}`);
    }
  }
  return messages;
}

export function evaluate(pairs, schema) {
  const last = new Map();
  for (const pair of pairs) last.set(pair.key, pair);

  const findings = [];
  for (const key of Object.keys(schema)) {
    const rule = schema[key];
    const pair = last.get(key);
    if (!pair) {
      if (rule.required === true) {
        findings.push({ key, line: null, code: 'MISSING_REQUIRED', message: 'required key is missing' });
      }
      continue;
    }
    if (rule.type !== undefined && !PREDICATES[rule.type](pair.value)) {
      findings.push({
        key,
        line: pair.line,
        code: 'INVALID_TYPE',
        message: `expected ${rule.type}, got "${pair.value}"`,
      });
    }
    if (rule.enum !== undefined && !rule.enum.includes(pair.value)) {
      findings.push({
        key,
        line: pair.line,
        code: 'NOT_IN_ENUM',
        message: `expected one of ${rule.enum.join(', ')}; got "${pair.value}"`,
      });
    }
  }
  return findings;
}
