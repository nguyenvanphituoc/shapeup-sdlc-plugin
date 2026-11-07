// Pure rules check: data in, findings out. No other modules, no network.
const INT = /^-?[0-9]+$/;

function badUrl(v) {
  try {
    return new URL(v).host === "";
  } catch {
    return true;
  }
}

export function check(pairs, schema) {
  const byKey = new Map();
  for (const p of pairs || []) byKey.set(p.key, p); // last assignment wins
  const located = [];
  const missing = [];
  for (const key of Object.keys(schema || {})) {
    const rule = schema[key] || {};
    const pair = byKey.get(key);
    if (!pair) {
      if (rule.required === true) missing.push({ key, line: null, message: "required key is missing" });
      continue;
    }
    const v = pair.value;
    const add = (message) => located.push({ key, line: pair.line, message });
    if (rule.type === "int" && !INT.test(v)) add(`expected int, got "${v}"`);
    else if (rule.type === "bool" && v !== "true" && v !== "false") add(`expected bool, got "${v}"`);
    else if (rule.type === "url" && badUrl(v)) add(`expected url, got "${v}"`);
    if (Array.isArray(rule.enum) && !rule.enum.includes(v)) {
      add(`expected one of ${rule.enum.join("|")}, got "${v}"`);
    }
  }
  located.sort((a, b) => a.line - b.line);
  return [...located, ...missing];
}
