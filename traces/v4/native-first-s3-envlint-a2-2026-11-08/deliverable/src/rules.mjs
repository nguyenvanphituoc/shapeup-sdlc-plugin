// Pure schema rules: pairs + schema in, { findings, schemaErrors } out. No IO.
const FIELDS = ["required", "type", "enum"];
const TYPES = ["string", "int", "bool", "url"];

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validateSchema(schema) {
  if (!isObject(schema)) return ["schema must be a JSON object"];
  const errors = [];
  for (const [key, rule] of Object.entries(schema)) {
    if (!isObject(rule)) {
      errors.push(`${key}: rule must be an object`);
      continue;
    }
    for (const [field, val] of Object.entries(rule)) {
      if (!FIELDS.includes(field)) errors.push(`${key}: unknown field "${field}"`);
      else if (field === "required" && typeof val !== "boolean") errors.push(`${key}: required must be a boolean`);
      else if (field === "type" && !TYPES.includes(val)) errors.push(`${key}: unknown type ${JSON.stringify(val)}`);
      else if (field === "enum" && !(Array.isArray(val) && val.every((e) => typeof e === "string")))
        errors.push(`${key}: enum must be an array of strings`);
    }
  }
  return errors;
}

function isUrl(value) {
  if (!value.includes("://")) return false;
  try {
    return new URL(value).host !== "";
  } catch {
    return false;
  }
}

const TYPE_CHECKS = {
  string: () => true,
  int: (v) => /^-?[0-9]+$/.test(v),
  bool: (v) => v === "true" || v === "false",
  url: isUrl,
};

export function checkRules(pairs, schema) {
  const schemaErrors = validateSchema(schema);
  if (schemaErrors.length) return { findings: [], schemaErrors };

  const byKey = new Map();
  for (const p of Array.isArray(pairs) ? pairs : []) byKey.set(p.key, p);

  const findings = [];
  for (const [key, rule] of Object.entries(schema)) {
    const pair = byKey.get(key);
    if (!pair) {
      if (rule.required === true) findings.push({ key, line: null, rule: "required", message: "required key is missing" });
      continue;
    }
    if (rule.type && !TYPE_CHECKS[rule.type](pair.value)) {
      findings.push({ key, line: pair.line, rule: "type", message: `expected ${rule.type}, got "${pair.value}"` });
    }
    if (rule.enum && !rule.enum.includes(pair.value)) {
      findings.push({ key, line: pair.line, rule: "enum", message: `expected one of ${rule.enum.join("|")}, got "${pair.value}"` });
    }
  }
  return { findings, schemaErrors: [] };
}
