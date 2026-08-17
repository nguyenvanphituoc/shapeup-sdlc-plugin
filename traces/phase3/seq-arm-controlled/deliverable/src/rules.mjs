// Rules engine — pure function: {pairs, problems} + schema in, Finding[] out.
// Never imports src/parsing.mjs (see TASK-002 Implementation Notes).

const INT_RE = /^-?\d+$/;
const TRUE_BOOL = new Set(["true", "1"]);
const FALSE_BOOL = new Set(["false", "0"]);

/**
 * Validate a single value against a schema rule's `type` constraint.
 * @param {string} value
 * @param {string} type
 * @returns {boolean}
 */
function checkType(value, type) {
  switch (type) {
    case "int":
      return INT_RE.test(value);
    case "bool": {
      const lower = value.toLowerCase();
      return TRUE_BOOL.has(lower) || FALSE_BOOL.has(lower);
    }
    case "url": {
      let parsed;
      try {
        parsed = new URL(value);
      } catch {
        return false;
      }
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }
    case "string":
      return true;
    default:
      return true;
  }
}

/**
 * Evaluate parsed env pairs and parse problems against a schema.
 * @param {{key: string, value: string, line: number}[]} pairs
 * @param {{line: number, text: string}[]} problems
 * @param {Object.<string, {required?: boolean, type?: string, enum?: string[]}>} schema
 * @returns {{line: number, key: string, message: string}[]}
 */
export function evaluate(pairs, problems, schema) {
  const findings = [];

  // E4: every ParseProblem becomes exactly one Finding.
  for (const problem of problems) {
    findings.push({
      line: problem.line,
      key: problem.text.slice(0, 30),
      message: "not a KEY=VALUE assignment",
    });
  }

  // INV-02: dedup — only the LAST occurrence in file order is evaluated.
  const winning = new Map();
  for (const pair of pairs) {
    winning.set(pair.key, pair);
  }

  for (const [schemaKey, rule] of Object.entries(schema)) {
    const pair = winning.get(schemaKey);

    if (!pair) {
      // required + absent from file entirely (after dedup) -> Finding, line 0.
      if (rule && rule.required) {
        findings.push({ line: 0, key: schemaKey, message: `${schemaKey} is required` });
      }
      continue;
    }

    const { value } = pair;

    if (rule && rule.type) {
      if (!checkType(value, rule.type)) {
        findings.push({
          line: pair.line,
          key: schemaKey,
          message: `${schemaKey} does not match type "${rule.type}"`,
        });
        continue;
      }
    }

    if (rule && rule.enum) {
      if (!rule.enum.includes(value)) {
        findings.push({
          line: pair.line,
          key: schemaKey,
          message: `${schemaKey} is not one of: ${rule.enum.join(", ")}`,
        });
      }
    }
  }

  return findings;
}
