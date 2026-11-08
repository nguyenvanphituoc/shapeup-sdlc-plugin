// Pure schema rules engine — contracts C2 (Schema) and C3 (Finding) in
// shapeup/envlint/spec/domain-model.md. No imports, no I/O: the global URL only.

const RULE_FIELDS = ['required', 'type', 'enum'];
const TYPES = ['string', 'int', 'bool', 'url'];

const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

export function checkSchema(schema) {
  if (!isPlainObject(schema)) return ['schema must be a JSON object'];
  const errors = [];
  for (const [key, rule] of Object.entries(schema)) {
    if (!isPlainObject(rule)) {
      errors.push(`${key}: rule must be an object`);
      continue;
    }
    for (const field of Object.keys(rule)) {
      if (!RULE_FIELDS.includes(field)) errors.push(`${key}: unknown rule field "${field}"`);
    }
    if ('required' in rule && typeof rule.required !== 'boolean') {
      errors.push(`${key}: "required" must be a boolean`);
    }
    if ('type' in rule && !TYPES.includes(rule.type)) {
      errors.push(`${key}: "type" must be one of ${TYPES.join(', ')}`);
    }
    if ('enum' in rule &&
        !(Array.isArray(rule.enum) && rule.enum.length > 0 && rule.enum.every((m) => typeof m === 'string'))) {
      errors.push(`${key}: "enum" must be a non-empty array of strings`);
    }
  }
  return errors;
}

function isUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== '';
}

const PREDICATES = {
  string: () => true,
  int: (v) => /^-?[0-9]+$/.test(v),
  bool: (v) => v === 'true' || v === 'false',
  url: isUrl,
};

export function checkPairs(pairs, schema) {
  const index = new Map();
  for (const pair of pairs) index.set(pair.key, pair); // last occurrence wins

  const lined = [];
  const missing = [];
  for (const [key, rule] of Object.entries(schema)) {
    const pair = index.get(key);
    if (!pair) {
      if (rule.required === true) {
        missing.push({ key, line: null, rule: 'required', message: 'required key is missing' });
      }
      continue;
    }
    if (rule.type !== undefined && !PREDICATES[rule.type](pair.value)) {
      lined.push({ key, line: pair.line, rule: 'type', message: `expected ${rule.type}, got "${pair.value}"` });
    }
    if (rule.enum !== undefined && !rule.enum.includes(pair.value)) {
      lined.push({ key, line: pair.line, rule: 'enum', message: `expected one of ${rule.enum.join(', ')}, got "${pair.value}"` });
    }
  }
  lined.sort((a, b) => a.line - b.line); // stable: type stays before enum on one line
  return [...lined, ...missing];
}
