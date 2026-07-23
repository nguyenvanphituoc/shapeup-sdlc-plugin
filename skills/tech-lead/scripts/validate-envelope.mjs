#!/usr/bin/env node
// Envelope schema gate (pure-skill architecture v1.0, plan P0).
//
// The lesson already in the repo: structured artifacts + deterministic tooling beat prose
// conventions (t0-verify.mjs is the most reliable component in the harness). This script makes
// the WorkOrder/WorkResult ports mechanically checkable: a malformed order never reaches a
// worker, a malformed result never reaches ingest.
//
// Zero dependencies, zero network — same discipline as the oracles and gate-l2.mjs. Implements
// the JSON-Schema subset the shipped schemas use (type, required, properties, items, enum,
// pattern, $ref) rather than pulling in a validator dependency. $ref supports two forms:
//   #/$defs/Name                       — a definition in the SAME schema document
//   domain.schema.json#/$defs/Name     — a definition in a SIBLING file (the central domain
//                                        registry; resolved against the schema's own dir,
//                                        falling back to skills/tech-lead/schemas/)
//
// Usage (CLI):    node skills/tech-lead/scripts/validate-envelope.mjs <envelope.json> <schema.json>
//                 exit 0 = valid, 1 = invalid (errors printed one per line)
// Usage (hook):   PreToolUse on Skill|Agent — when the tool input carries `--order <path>`,
//                 the order file is validated against schemas/work-order.schema.json; an
//                 invalid or missing order DENIES the dispatch (fail-closed on a malformed
//                 order, fail-open when no --order is present — standalone runs stay free).

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMAS_DIR = resolve(HERE, "../schemas");

/** Validate `data` against the JSON-Schema subset used by the envelope schemas.
 *  `schemaDir` is where cross-file $refs (e.g. "domain.schema.json#/$defs/X") resolve from;
 *  defaults to the shipped schemas dir so in-memory schemas keep working.
 *  Returns { valid, errors: ["<path>: <message>", ...] }. */
export function validate(data, schema, schemaDir = SCHEMAS_DIR) {
  const errors = [];
  walk(data, schema, "$", errors, { doc: schema, dir: schemaDir }, 0);
  return { valid: errors.length === 0, errors };
}

// --- $ref resolution ---------------------------------------------------------
// ctx = { doc, dir }: the schema DOCUMENT the current subschema belongs to (same-doc
// `#/...` pointers resolve inside it) and the directory sibling files load from.
const REF_DOC_CACHE = new Map();
function loadRefDoc(file, dir, path, errors) {
  for (const base of [dir, SCHEMAS_DIR]) {
    const abs = resolve(base, file);
    if (REF_DOC_CACHE.has(abs)) return REF_DOC_CACHE.get(abs);
    if (existsSync(abs)) {
      try {
        const entry = { doc: JSON.parse(readFileSync(abs, "utf8")), dir: dirname(abs) };
        REF_DOC_CACHE.set(abs, entry);
        return entry;
      } catch (e) {
        errors.push(`${path}: $ref file ${file} is not readable JSON (${e.message})`);
        return null;
      }
    }
  }
  errors.push(`${path}: $ref file not found: ${file}`);
  return null;
}

function resolveRef(ref, ctx, path, errors) {
  const [file, pointer = ""] = ref.split("#");
  const target = file ? loadRefDoc(file, ctx.dir, path, errors) : ctx;
  if (!target) return null;
  let node = target.doc;
  for (const seg of pointer.split("/").filter(Boolean)) {
    node = node && typeof node === "object" ? node[seg.replace(/~1/g, "/").replace(/~0/g, "~")] : undefined;
  }
  if (!node || typeof node !== "object") {
    errors.push(`${path}: $ref "${ref}" resolves to nothing`);
    return null;
  }
  return { schema: node, ctx: target };
}

function typeOf(v) {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function walk(data, schema, path, errors, ctx, refDepth) {
  if (!schema || typeof schema !== "object") return;
  if (schema.$ref) {
    if (refDepth > 16) { errors.push(`${path}: $ref chain too deep (cycle?) at "${schema.$ref}"`); return; }
    const resolved = resolveRef(schema.$ref, ctx, path, errors);
    if (resolved) walk(data, resolved.schema, path, errors, resolved.ctx, refDepth + 1);
    return; // $ref replaces the subschema (draft 2020-12 sibling keywords not used here)
  }
  if (Array.isArray(schema.anyOf)) {
    // Additive-union support (spine v1.3: acceptance_criteria = string | {text, covers?}).
    // Valid iff ≥1 branch validates with zero errors; each branch is tried against a throwaway
    // error collection so a failing branch never leaks into the report.
    const matched = schema.anyOf.some((sub) => {
      const branchErrors = [];
      walk(data, sub, path, branchErrors, ctx, refDepth);
      return branchErrors.length === 0;
    });
    if (!matched) errors.push(`${path}: ${JSON.stringify(data)} matches none of the ${schema.anyOf.length} allowed shapes (anyOf)`);
    return; // anyOf is terminal here (no sibling keywords combined with it in the shipped schemas)
  }
  if (schema.type) {
    const t = typeOf(data);
    const okType = schema.type === "number" ? t === "number" || t === "integer" : t === schema.type;
    if (!okType) {
      errors.push(`${path}: expected ${schema.type}, got ${t}`);
      return; // deeper checks are meaningless on the wrong type
    }
  }
  if (schema.enum && !schema.enum.some((v) => v === data)) {
    errors.push(`${path}: value ${JSON.stringify(data)} not in enum [${schema.enum.join(", ")}]`);
  }
  if (schema.pattern && typeof data === "string" && !new RegExp(schema.pattern).test(data)) {
    errors.push(`${path}: "${data}" does not match pattern ${schema.pattern}`);
  }
  if (typeOf(data) === "object") {
    for (const req of schema.required || []) {
      if (!(req in data)) errors.push(`${path}: missing required field "${req}"`);
    }
    for (const [key, sub] of Object.entries(schema.properties || {})) {
      if (key in data) walk(data[key], sub, `${path}.${key}`, errors, ctx, 0);
    }
  }
  if (typeOf(data) === "array" && schema.items) {
    data.forEach((item, i) => walk(item, schema.items, `${path}[${i}]`, errors, ctx, 0));
  }
}

/** Load + validate an envelope file against a schema file. Throws on unreadable JSON.
 *  Cross-file $refs resolve relative to the schema file's own directory. */
export function validateFile(envelopePath, schemaPath) {
  const data = JSON.parse(readFileSync(envelopePath, "utf8"));
  const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
  return validate(data, schema, dirname(resolve(schemaPath)));
}

// ---------------------------------------------------------------------------
// Entry point: CLI when args are given, PreToolUse hook when fed stdin JSON.
// ---------------------------------------------------------------------------
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv[2]) {
    // CLI mode
    const [envelopePath, schemaPath] = process.argv.slice(2);
    if (!schemaPath) {
      console.error("usage: validate-envelope.mjs <envelope.json> <schema.json>");
      process.exit(2);
    }
    try {
      const { valid, errors } = validateFile(resolve(envelopePath), resolve(schemaPath));
      if (valid) {
        console.log(`✅ ${envelopePath} is a valid ${JSON.parse(readFileSync(resolve(schemaPath), "utf8")).title || "envelope"}`);
        process.exit(0);
      }
      for (const e of errors) console.error(`  ✗ ${e}`);
      process.exit(1);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      process.exit(1);
    }
  } else {
    // Hook mode (PreToolUse). Deny contract identical to gate-l2.mjs.
    const defer = () => process.exit(0);
    const raw = await new Promise((res) => {
      let d = "";
      process.stdin.on("data", (c) => (d += c));
      process.stdin.on("end", () => res(d));
      process.stdin.on("error", () => res(""));
    });
    let p;
    try { p = JSON.parse(raw || "{}"); } catch { defer(); }
    if (p.tool_name !== "Skill" && p.tool_name !== "Agent") defer();
    const haystack = [p.tool_input?.skill_args, p.tool_input?.args, p.tool_input?.prompt]
      .filter(Boolean).join(" ");
    const m = haystack.match(/--order(?:\s+|=)(?:"([^"]+)"|'([^']+)'|(\S+))/);
    if (!m) defer(); // no order threaded → not an orchestrated dispatch, nothing to gate
    const orderPath = resolve(p.cwd || process.cwd(), m[1] || m[2] || m[3]);
    const deny = (reason) => {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      }));
      process.exit(0);
    };
    if (!existsSync(orderPath)) {
      deny(`WorkOrder gate — order file not found: ${orderPath}. Compile it first (compile-order.mjs) — a worker must never be dispatched against a dangling order.`);
    }
    try {
      const { valid, errors } = validateFile(orderPath, join(SCHEMAS_DIR, "work-order.schema.json"));
      if (!valid) {
        deny(`WorkOrder gate — ${orderPath} fails schema validation: ${errors.slice(0, 5).join("; ")}. A malformed order never reaches a worker; fix the order (or compile-order.mjs) and re-dispatch.`);
      }
    } catch (e) {
      deny(`WorkOrder gate — ${orderPath} is not readable JSON (${e.message}).`);
    }
    defer();
  }
}
